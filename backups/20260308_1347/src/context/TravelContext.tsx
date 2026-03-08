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
}

const TravelContext = createContext<TravelContextType | undefined>(undefined);

export function TravelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TravelState>(() => {
    const saved = localStorage.getItem('aura_travel_state');
    const initialState = {
      currentLocation: INITIAL_LOCATION,
      history: [],
      isThinking: false,
      isSpeaking: false,
      nearbyPlaces: [],
      viewMode: 'map' as const,
      memory: {}
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialState,
          ...parsed,
          isThinking: false, // Reset runtime flags
          isSpeaking: false
        };
      } catch (e) {
        console.error('Failed to load storage:', e);
      }
    }
    return initialState;
  });

  // PERSISTENCE: Save state to localStorage whenever history, location or memory changes
  useEffect(() => {
    const { history, currentLocation, memory, nearbyPlaces } = state;
    localStorage.setItem('aura_travel_state', JSON.stringify({
      history: history.slice(-20), // Only save recent history to avoid storage limits
      currentLocation,
      memory,
      nearbyPlaces
    }));
  }, [state.history, state.currentLocation, state.memory, state.nearbyPlaces]);

  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveService, setLiveService] = useState<GeminiLiveService | null>(null);
  const [streamer] = useState(new AudioStreamer());

  const [audioElement] = useState(new Audio());

  const stopAudio = useCallback(() => {
    audioElement.pause();
    audioElement.currentTime = 0;
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, [audioElement]);

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
      const { text: replyText, groundingMetadata, audioData } = await chatWithAura(text, apiHistory, state.currentLocation);

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
        }
      });
    }
  }, []);

  const stopLiveMode = useCallback(() => {
    liveService?.disconnect();
    streamer.stopRecording();
    setIsLiveMode(false);
    setLiveService(null);
    setState(prev => ({ ...prev, isThinking: false, isSpeaking: false }));
    console.log('[AuraLive] Voice Talk stopped and state reset.');
  }, [liveService, streamer]);

  const resetSession = useCallback(() => {
    if (window.confirm('대화 내역과 추천 장소들을 모두 초기화할까요? (메모리는 유지됩니다)')) {
      setState(prev => ({
        ...prev,
        history: [],
        nearbyPlaces: []
      }));
      localStorage.removeItem('aura_travel_state');
      console.log('[Aura] Session Reset.');
    }
  }, []);

  const startLiveMode = useCallback(async () => {
    try {
      console.log('[AuraLive] Requesting microphone permission...');
      // 1. Give immediate feedback
      setIsLiveMode(true); // Turn green immediately to show it's trying

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Stop the temp stream immediately, streamer will open its own
      stream.getTracks().forEach(track => track.stop());
      console.log('[AuraLive] Microphone permission granted.');

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("Gemini API Key is missing");
        setIsLiveMode(false);
        return;
      }

      await streamer.resumeContext();

      const locationContext = `[MANDATORY CURRENT LOCATION]: ${state.currentLocation.name || 'London'} (Lat: ${state.currentLocation.lat.toFixed(4)}, Lng: ${state.currentLocation.lng.toFixed(4)}). 
YOU ARE CURRENTLY IN THIS CITY. SEARCH RESULTS AND SUGGESTIONS MUST BE WITHIN THIS CITY ONLY. DO NOT SUGGEST PLACES IN KOREA OR OTHER COUNTRIES UNLESS EXPLICITLY ASKED.`;

      const liveSystemInstruction = `${SYSTEM_INSTRUCTION}\n\n${locationContext}\n(IMPORTANT: Use the location information provided above as your primary anchor for all tools and search.)`;

      const service = new GeminiLiveService(
        apiKey,
        (msg) => {
          if (msg.error) {
            console.error("Live Service Error:", msg.error);
            alert(`Voice Talk Error: ${msg.error}`);
            stopLiveMode();
            return;
          }
          if (msg.audioData) {
            streamer.playAudioChunk(msg.audioData);
            setState(prev => ({ ...prev, isSpeaking: true }));
          }
          if (msg.text) {
            setState(prev => {
              const lastMsg = prev.history[prev.history.length - 1];
              // If last message was a live model message, append to it
              if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-')) {
                const updatedHistory = [...prev.history];
                updatedHistory[updatedHistory.length - 1] = {
                  ...lastMsg,
                  text: lastMsg.text + msg.text
                };
                return { ...prev, history: updatedHistory, isThinking: false };
              }

              // Otherwise, create a new live message
              const aiMessage: Message = {
                id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                role: 'model',
                text: msg.text,
                timestamp: Date.now()
              };
              return {
                ...prev,
                history: [...prev.history, aiMessage],
                isThinking: false
              };
            });
          }
          if (msg.groundingMetadata) {
            console.log('[AuraLive] Grounding Data Received:', msg.groundingMetadata);
            const groundingChunks = msg.groundingMetadata.groundingChunks || [];

            for (const chunk of groundingChunks) {
              if (chunk.maps && chunk.maps.title) {
                const placeName = chunk.maps.title;
                const placeId = `live-place-${Math.random().toString(36).substr(2, 5)}`;

                const newPlace: Place = {
                  id: placeId,
                  name: placeName,
                  location: state.currentLocation,
                  type: placeName.toLowerCase().includes('rest') || placeName.toLowerCase().includes('cafe') ? 'restaurant' : 'attraction',
                  url: chunk.maps.uri
                };

                // Immediate partial update to show "thinking/loading" or the name at least
                setState(prev => ({
                  ...prev,
                  nearbyPlaces: [...prev.nearbyPlaces, newPlace]
                }));

                // Geocode with LOCATION BIAS
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

                      // Auto-pan in Live Mode too
                      moveTo(newLoc, placeName);
                    }
                  });
                }
              }
            }
          }
          if (msg.isEnd) {
            setState(prev => {
              // --- 🟢 LIVE PLACE EXTRACTOR ---
              const lastLiveMsg = [...prev.history].reverse().find(m => m.role === 'model' && m.id.startsWith('live-'));
              if (lastLiveMsg && lastLiveMsg.text) {
                const text = lastLiveMsg.text;

                // PRIORITY 1: Structured [[PLACE: Name]] tags from system prompt instruction
                const tagPattern = /\[\[PLACE:\s*([^\]]+)\]\]/g;
                const extracted = new Set<string>();
                let tagMatch: RegExpExecArray | null;
                while ((tagMatch = tagPattern.exec(text)) !== null) {
                  const name = tagMatch[1].trim();
                  if (name.length > 2) extracted.add(name);
                }

                // PRIORITY 2: Regex fallback if no tags found
                if (extracted.size === 0) {
                  const patterns = [
                    /[""]([^""]{3,50})[""]/g,
                    /(?:visit|try|check out|head to|go to)\s+([A-Z][^\n,.!?]{3,40})/g,
                    /^\s*[-•]\s+([A-Z][^\n:]{4,50}?)(?:\s*[-–]|$)/gm,
                  ];
                  for (const re of patterns) {
                    const copy = new RegExp(re.source, re.flags);
                    let m: RegExpExecArray | null;
                    while ((m = copy.exec(text)) !== null) {
                      const name = m[1].trim();
                      if (name.length > 3 && name.length < 50) extracted.add(name);
                    }
                  }
                }

                if (extracted.size > 0) {
                  const currentLoc = prev.currentLocation;
                  Array.from(extracted).slice(0, 5).forEach(placeName => {
                    const placeId = `live-txt-${Math.random().toString(36).substr(2, 6)}`;
                    setState(inner => ({
                      ...inner,
                      nearbyPlaces: [...inner.nearbyPlaces, {
                        id: placeId,
                        name: placeName,
                        location: currentLoc,
                        type: placeName.toLowerCase().match(/restaurant|cafe|bar|pub|bistro|diner|brasserie/)
                          ? 'restaurant' : 'attraction',
                      }]
                    }));

                    if (typeof google !== 'undefined' && google.maps?.Geocoder) {
                      const geocoder = new google.maps.Geocoder();
                      geocoder.geocode({ address: `${placeName}`, location: currentLoc }, (results, status) => {
                        if (status === 'OK' && results?.[0]) {
                          const loc = results[0].geometry.location;
                          const newLoc = { lat: loc.lat(), lng: loc.lng() };
                          const dist = Math.abs(newLoc.lat - currentLoc.lat) + Math.abs(newLoc.lng - currentLoc.lng);
                          if (dist < 2.0) {
                            setState(inner => ({
                              ...inner,
                              nearbyPlaces: inner.nearbyPlaces.map(p =>
                                p.id === placeId ? { ...p, location: newLoc } : p
                              )
                            }));
                          }
                        }
                      });
                    }
                  });
                }
              }
              return { ...prev, isSpeaking: false };
            });
          }
        },
        async () => {
          console.log("Live Mode Connected & Ready");
          setIsLiveMode(true);

          // SYNC MEMORY + LOCATION: Send history, memory, AND current position
          const locationSnippet = state.currentLocation.name
            ? `[Current Location]: ${state.currentLocation.name} (${state.currentLocation.lat.toFixed(5)}, ${state.currentLocation.lng.toFixed(5)})`
            : `[Current Location]: (${state.currentLocation.lat.toFixed(5)}, ${state.currentLocation.lng.toFixed(5)})`;
          service.sendInitialHistory([{ role: 'user', text: locationSnippet }, ...state.history], state.memory);

          try {
            await streamer.startRecording((base64) => {
              service.sendAudio(base64);
            });
          } catch (e) {
            console.error("Failed to start recording:", e);
            alert("Could not start microphone recording. Please check your settings.");
            service.disconnect();
            setIsLiveMode(false);
          }
        },
        () => {
          console.log("Live Mode Session Closed");
          setIsLiveMode(false);
          streamer.stopRecording();
          setLiveService(null);
        },
        liveSystemInstruction
      );

      service.connect();
      setLiveService(service);
    } catch (err: any) {
      console.error("Microphone access denied or error:", err);
      setIsLiveMode(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert("마이크 사용 권한이 거부되었습니다. 🎙️🚫");
      } else {
        alert(`보이스 톡 시작 오류: ${err.message}`);
      }
    }
  }, [streamer, stopLiveMode, state.currentLocation, state.history, state.memory]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      liveService?.disconnect();
      streamer.stopRecording();
    };
  }, [liveService, streamer]);

  return (
    <TravelContext.Provider value={{
      state,
      sendMessage,
      moveTo,
      setViewMode,
      playAudio,
      stopAudio,
      isLiveMode,
      startLiveMode,
      stopLiveMode,
      resetSession
    }}>
      {children}
    </TravelContext.Provider>
  );
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (context === undefined) {
    throw new Error('useTravel must be used within a TravelProvider');
  }
  return context;
}
