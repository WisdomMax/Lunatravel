/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { TravelState, Message, Location, Place } from '../types';
import { chatWithAura, speakWithAura } from '../services/geminiService';
import { GeminiLiveService } from '../services/geminiLiveService';
import { AudioStreamer } from '../utils/audioStreamer';
import { INITIAL_LOCATION, SYSTEM_INSTRUCTION } from '../constants';

interface TravelContextType {
  state: TravelState;
  sendMessage: (text: string) => Promise<void>;
  moveTo: (location: Location, name?: string, goStreetView?: boolean) => void;
  setViewMode: (viewMode: 'map' | 'streetview') => void;
  playAudio: (base64: string) => void;
  stopAudio: () => void;
  isLiveMode: boolean;
  startLiveMode: () => Promise<void>;
  stopLiveMode: () => void;
  resetSession: () => void;
  takeTravelPhoto: (location: Location, heading: number, pitch: number, zoom: number) => Promise<void>;
}

const TravelContext = createContext<TravelContextType | undefined>(undefined);

export function TravelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TravelState>(() => {
    const saved = localStorage.getItem('luna_travel_state');
    const initialState = {
      currentLocation: INITIAL_LOCATION,
      history: [],
      isThinking: false,
      isSpeaking: false,
      nearbyPlaces: [],
      viewMode: 'map' as const,
      memory: {},
      photos: [],
      isGeneratingPhoto: false,
      persona: localStorage.getItem('luna_persona') || SYSTEM_INSTRUCTION
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialState,
          ...parsed,
          isThinking: false, // Reset runtime flags
          isSpeaking: false,
          isGeneratingPhoto: false
        };
      } catch (e) {
        console.error('Failed to load storage:', e);
      }
    }
    return initialState;
  });

  // PERSISTENCE: Save state to localStorage whenever history, location, memory or photos change
  useEffect(() => {
    const { history, currentLocation, memory, nearbyPlaces, photos, persona } = state;
    localStorage.setItem('luna_travel_state', JSON.stringify({
      history: history.slice(-20), // Only save recent history to avoid storage limits
      currentLocation,
      memory,
      nearbyPlaces,
      photos: photos.slice(0, 10), // Only save last 10 photos
      persona
    }));
  }, [state.history, state.currentLocation, state.memory, state.nearbyPlaces, state.photos, state.persona]);

  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveService, setLiveService] = useState<GeminiLiveService | null>(null);
  const [streamer] = useState(new AudioStreamer());

  const [audioElement] = useState(new Audio());

  const stopAudio = useCallback(() => {
    audioElement.pause();
    audioElement.currentTime = 0;

    // Live Mode Explicit Interrupt
    if (isLiveMode && liveService) {
      liveService.sendInterrupt();
    }
    streamer.clearPlayback();
    streamer.unmuteRecording(); // 정지 후 마이크 재개(다음 발화 대기)

    setState(prev => ({ ...prev, isSpeaking: false }));
  }, [audioElement, isLiveMode, liveService, streamer]);

  const playAudio = useCallback((base64: string) => {
    stopAudio();
    audioElement.src = `data:audio/mp3;base64,${base64}`;
    audioElement.play();
    setState(prev => ({ ...prev, isSpeaking: true }));
    audioElement.onended = () => {
      setState(prev => ({ ...prev, isSpeaking: false }));
    };
  }, [audioElement, stopAudio]);

  const setViewMode = useCallback((viewMode: 'map' | 'streetview') => {
    setState(prev => ({ ...prev, viewMode }));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      history: [...prev.history, userMessage],
      isThinking: true
    }));

    // If Live Mode is active, route through Live Service for concurrency
    if (isLiveMode && liveService) {
      liveService.sendText(text);
      setState(prev => ({ ...prev, isThinking: false }));
      return;
    }

    // Prepare history for REST API (Regular Chat)
    const apiHistory = state.history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model' as any,
      parts: [{ text: msg.text }]
    }));

    try {
      const { text: replyText, groundingMetadata, audioData } = await chatWithAura(text, apiHistory, state.currentLocation, state.persona);

      // Extract places from grounding if available
      const extractedPlaces: Place[] = [];
      const groundingChunks = groundingMetadata?.groundingChunks || [];

      if (groundingChunks) {
        for (const chunk of groundingChunks) {
          if (chunk.maps && chunk.maps.title) {
            const placeName = chunk.maps.title;
            const placeId = Math.random().toString(36).substr(2, 9);

            const newPlace: Place = {
              id: placeId,
              name: placeName,
              location: state.currentLocation, // Default, will be updated by geocoder
              type: placeName.toLowerCase().includes('restaurant') || placeName.toLowerCase().includes('cafe') ? 'restaurant' : 'attraction',
              url: chunk.maps.uri
            };
            extractedPlaces.push(newPlace);

            // Trigger Geocoding with LOCATION BIAS (prefer results near current travel location)
            if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({
                address: placeName,
                location: state.currentLocation
              }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  const loc = results[0].geometry.location;
                  const newLoc = { lat: loc.lat(), lng: loc.lng() };

                  setState(prev => ({
                    ...prev,
                    nearbyPlaces: prev.nearbyPlaces.map(p =>
                      p.id === placeId ? { ...p, location: newLoc } : p
                    )
                  }));

                  // Automatically move to the first suggested place for a wow effect
                  if (extractedPlaces[0]?.id === placeId) {
                    moveTo({ ...newLoc, name: placeName });
                  }
                }
              });
            }
          }
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: replyText,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        history: [...prev.history, aiMessage],
        isThinking: false,
        isSpeaking: !!audioData,
        nearbyPlaces: extractedPlaces.length > 0 ? [...prev.nearbyPlaces, ...extractedPlaces] : prev.nearbyPlaces
      }));

      // Play audio immediately
      if (audioData) {
        playAudio(audioData);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({ ...prev, isThinking: false }));
    }
  }, [state.history, state.currentLocation, playAudio, isLiveMode, liveService]);

  const syncLocationContext = useCallback((location: Location, name?: string) => {
    if (isLiveMode && liveService) {
      const locationText = `📍현재 지도 위치: ${name || location.name || '알 수 없는 장소'} (좌표: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`;
      liveService.sendText(locationText);
      console.log('[LunaLive] Location synced to model:', name || location.name);
    }
  }, [isLiveMode, liveService]);

  const moveTo = useCallback((location: Location, name?: string, goStreetView = false) => {
    setState(prev => {
      // If we are already there and in streetview, don't jitter
      const dist = Math.sqrt(
        Math.pow(location.lat - prev.currentLocation.lat, 2) +
        Math.pow(location.lng - prev.currentLocation.lng, 2)
      );
      if (dist < 0.00001 && prev.viewMode === 'streetview') return prev;

      return {
        ...prev,
        currentLocation: { ...location, name: name || location.name },
        // Only switch to streetview if explicitly requested (e.g. card click)
        viewMode: goStreetView ? 'streetview' : prev.viewMode
      };
    });

    // If name is NOT provided, attempt to reverse geocode
    if (!name && typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: location.lat, lng: location.lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const geocodedName = results[0].formatted_address;
          setState(prev => ({
            ...prev,
            currentLocation: { ...prev.currentLocation, name: geocodedName }
          }));
          // Sync geocoded name to model
          syncLocationContext(location, geocodedName);
        }
      });
    } else {
      // Sync explicitly provided name
      syncLocationContext(location, name);
    }
  }, [syncLocationContext]);

  const stopLiveMode = useCallback(() => {
    liveService?.disconnect();
    streamer.stopRecording();
    setIsLiveMode(false);
    setLiveService(null);
    setState(prev => ({ ...prev, isThinking: false, isSpeaking: false }));
    console.log('[LunaLive] Voice Talk stopped and state reset.');
  }, [liveService, streamer]);

  const resetSession = useCallback(() => {
    if (window.confirm('대화 내역과 주변 장소들을 초기화하고 경복궁에서 새로 시작할까요?')) {
      setState(prev => ({
        ...prev,
        history: [],
        nearbyPlaces: [],
        currentLocation: INITIAL_LOCATION,
        viewMode: 'map'
      }));
      localStorage.removeItem('luna_travel_state');
      window.location.reload(); // 확실한 위치 초기화를 위해 페이지 새로고침
      console.log('[Luna] Session Reset & Reloaded.');
    }
  }, []);

  const startLiveMode = useCallback(async () => {
    try {
      console.log('[LunaLive] Starting Live Mode...');
      setIsLiveMode(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      await streamer.resumeContext();

      let service: GeminiLiveService | null = null;

      const locationContext = `[MANDATORY CURRENT LOCATION]: ${state.currentLocation.name || 'London'} (Lat: ${state.currentLocation.lat.toFixed(4)}, Lng: ${state.currentLocation.lng.toFixed(4)}).`;
      const liveSystemInstruction = `${state.persona}\n\n${locationContext}`;

      service = new GeminiLiveService(
        apiKey,
        (msg) => {
          if (msg.error) {
            console.error("Live Error:", msg.error);
            stopLiveMode();
            return;
          }

          // [핵심 변경] 서버 측에서 사용자가 말을 끊었음(Interrupted)을 알려주거나, 프론트에서 끊김 신호 수신 시 큐 초기화
          if (msg.interrupted || (msg.serverContent && msg.serverContent.interrupted)) {
            console.log('[LunaLive] Interrupted by user! Clearing audio queue.');
            streamer.clearPlayback();
            setState(prev => ({ ...prev, isSpeaking: false }));
          }

          if (msg.text || msg.toolCall) {
            setState(prev => {
              let newState = { ...prev, isThinking: false };

              // 1. Handle Tool Calls
              if (msg.toolCall && msg.toolCall.name === 'show_place_on_map') {
                const { name, address, category } = msg.toolCall.args;

                // Avoid duplication
                const existingPlace = prev.nearbyPlaces.find(p => p.name === name);
                const placeId = existingPlace?.id || `tool-${Date.now()}`;

                if (!existingPlace) {
                  const newPlace: Place = {
                    id: placeId,
                    name,
                    location: { ...prev.currentLocation, address: address || '' },
                    type: category || (name.toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction')
                  };
                  newState.nearbyPlaces = [...prev.nearbyPlaces, newPlace];
                }

                // Add or update model message if not already praising the place in recent messages
                const history = [...newState.history];
                history.push({
                  id: `tool-msg-${Date.now()}`,
                  role: 'model',
                  text: `📍 오빠! [[PLACE: ${name}]] 여기로 가볼까? 대화창의 링크를 눌러봐!`,
                  timestamp: Date.now()
                });
                newState.history = history;

                if (typeof google !== 'undefined' && google.maps?.Geocoder) {
                  const geocoder = new google.maps.Geocoder();
                  // More robust search: combine name and address if available
                  const searchQuery = address ? `${name}, ${address}` : name;

                  geocoder.geocode({
                    address: searchQuery,
                    location: prev.currentLocation,
                    region: 'KR' // Priority for Korea
                  }, (results, status) => {
                    if (status === 'OK' && results?.[0]) {
                      const loc = results[0].geometry.location;
                      const newLoc = {
                        lat: loc.lat(),
                        lng: loc.lng(),
                        name: name, // Preserve the original name
                        address: results[0].formatted_address
                      };

                      setState(inner => ({
                        ...inner,
                        nearbyPlaces: inner.nearbyPlaces.map(p => p.id === placeId ? { ...p, location: newLoc } : p)
                      }));
                      // moveTo(newLoc, name, false); // 데이터 부재 시 먹통(Blank Screen) 이슈를 방지하고 텍스트 창의 버튼 클릭 시에만 이동하도록 강제 이동(moveTo) 호출 제거
                    }
                  });
                }
              }

              // 2. Handle Text Chunks (Live Transcript)
              if (msg.text) {
                // Determine a unique ID for this specific response turn to avoid duplication
                // If it's the model speaking, we use a session-based approach or timing
                const liveId = `live-turn-${newState.history.filter(m => m.id.startsWith('live-turn')).length}`;
                const history = [...prev.history];

                // If the last message is a live-turn and role is model, append to it
                const lastMsg = history[history.length - 1];
                if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-turn')) {
                  history[history.length - 1] = { ...lastMsg, text: lastMsg.text + msg.text };
                } else {
                  history.push({ id: `live-turn-${Date.now()}`, role: 'model', text: msg.text, timestamp: Date.now() });
                }

                newState.history = history;
                // Note: isSpeaking is handled by msg.audioData or msg.isEnd
              }

              return newState;
            });
          }

          if (msg.audioData) {
            // console.log('[LunaLive] Receiving audio chunk, length:', msg.audioData.length);
            streamer.playAudioChunk(msg.audioData).catch(e => console.error("Play error:", e));
            setState(prev => ({ ...prev, isSpeaking: true }));
          }

          if (msg.isEnd) {
            setState(prev => ({ ...prev, isSpeaking: false }));
          }

          if (msg.groundingMetadata) {
            const groundingChunks = msg.groundingMetadata.groundingChunks || [];
            for (const chunk of groundingChunks) {
              if (chunk.maps && chunk.maps.title) {
                const placeName = chunk.maps.title;
                const placeId = `live-ground-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

                const newPlace: Place = {
                  id: placeId,
                  name: placeName,
                  location: state.currentLocation,
                  type: placeName.toLowerCase().match(/restaurant|cafe|bar|pub|bistro/) ? 'restaurant' : 'attraction',
                  url: chunk.maps.uri
                };

                // Existing maps grounding logic
                setState(prev => ({
                  ...prev,
                  nearbyPlaces: [...prev.nearbyPlaces, newPlace],
                  history: [...prev.history, {
                    id: `ground-msg-${Date.now()}`,
                    role: 'model',
                    text: `🔍 루나가 찾아낸 곳: [[PLACE: ${placeName}]] (지도를 봐줘!)`,
                    timestamp: Date.now()
                  }]
                }));

                // Geocode grounding result
                if (typeof google !== 'undefined' && google.maps?.Geocoder) {
                  const geocoder = new google.maps.Geocoder();
                  geocoder.geocode({ address: placeName, location: state.currentLocation }, (results, status) => {
                    if (status === 'OK' && results?.[0]) {
                      const loc = results[0].geometry.location;
                      const newLoc = { lat: loc.lat(), lng: loc.lng(), address: results[0].formatted_address };
                      setState(inner => ({
                        ...inner,
                        nearbyPlaces: inner.nearbyPlaces.map(p => p.id === placeId ? { ...p, location: newLoc } : p)
                      }));
                      // moveTo(newLoc, placeName); // Grounding 시에도 강제 이동 제거. 텍스트 대화창의 링크 클릭으로만 이동.
                    }
                  });
                }
              }

              // Handle Web Search Grounding (googleSearch tool)
              if (chunk.web && chunk.web.title) {
                const { title, uri } = chunk.web;
                setState(prev => ({
                  ...prev,
                  history: [...prev.history, {
                    id: `web-ground-${Date.now()}`,
                    role: 'model',
                    text: `🌐 루나가 검색한 정보: [${title}](${uri})\n오빠, 이거 한 번 읽어봐!`,
                    timestamp: Date.now()
                  }]
                }));
              }
            }
          }
        },
        async () => {
          console.log("Live Connected");
          setIsLiveMode(true);
          const locationSnippet = `[Current Location]: ${state.currentLocation.name || 'Current Position'}`;
          service.sendInitialHistory([{ role: 'user', text: locationSnippet }, ...state.history], state.memory);
          await streamer.startRecording((base64) => service.sendAudio(base64));
        },
        () => {
          setIsLiveMode(false);
          streamer.stopRecording();
          setLiveService(null);
        },
        () => {
          streamer.clearPlayback();
          setState(prev => ({ ...prev, isSpeaking: false }));
        },
        liveSystemInstruction
      );

      service.connect();
      setLiveService(service);
    } catch (err: any) {
      console.error("Live start error:", err);
      setIsLiveMode(false);
    }
  }, [state.currentLocation, state.history, state.memory, streamer, stopLiveMode, moveTo]);

  const takeTravelPhoto = useCallback(async (location: Location, heading: number, pitch: number, zoom: number) => {
    setState(prev => ({ ...prev, isGeneratingPhoto: true }));
    try {
      const userPhoto = localStorage.getItem('user_photo');
      const lunaPhoto = localStorage.getItem('luna_photo');
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!userPhoto || !lunaPhoto) {
        throw new Error('사용자 사진 또는 루나 사진이 등록되지 않았습니다. 셋업 페이지에서 등록해주세요.');
      }

      // 1. Fetch Street View background image based on current POV
      console.log('[LunaPhoto] Fetching street view background...');
      const bgResponse = await fetch(`/api/streetview?lat=${location.lat}&lng=${location.lng}&key=${apiKey}`);
      const bgData = await bgResponse.json();
      const backgroundImage = bgData.base64;

      // 2. Call our synthesis API
      console.log('[LunaPhoto] Calling AI synthesis API...');
      const response = await fetch('/api/generate-travel-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundImage,
          userPhoto,
          lunaPhoto
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '사진 생성에 실패했습니다.');
      }

      const { base64: resultUrl } = await response.json();
      console.log('[LunaPhoto] Success! Adding to gallery.');

      const newPhoto = {
        id: Date.now().toString(),
        url: `data:image/jpeg;base64,${resultUrl}`,
        locationName: location.name || '알 수 없는 장소',
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        isGeneratingPhoto: false,
        photos: [newPhoto, ...prev.photos].slice(0, 10)
      }));

    } catch (error: any) {
      console.error('Failed to take travel photo:', error);
      setState(prev => ({ ...prev, isGeneratingPhoto: false }));
      alert(`📸 사진을 찍는 도중 문제가 발생했어요: ${error.message}`);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      liveService?.disconnect();
      streamer.stopRecording();
    };
  }, [liveService, streamer]);

  return (
    <TravelContext.Provider value={{
      state, sendMessage, moveTo, setViewMode, playAudio,
      stopAudio, isLiveMode, startLiveMode, stopLiveMode, resetSession,
      takeTravelPhoto
    }}>
      {children}
    </TravelContext.Provider>
  );
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (context === undefined) throw new Error('useTravel must be used within a TravelProvider');
  return context;
}
