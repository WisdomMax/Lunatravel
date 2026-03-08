/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { TravelState, Message, Location, Place } from '../types';
import { chatWithAura } from '../services/geminiService';
import { GeminiLiveService } from '../services/geminiLiveService';
import { AudioStreamer } from '../utils/audioStreamer';
import { INITIAL_LOCATION, SYSTEM_INSTRUCTION, LUNA_PERSONAS } from '../constants';

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

const getInitialState = (): TravelState => {
  const saved = localStorage.getItem('luna_travel_state');
  const lunaName = localStorage.getItem('luna_name') || 'Luna';
  const initialState: TravelState = {
    currentLocation: INITIAL_LOCATION,
    history: [],
    isThinking: false,
    isSpeaking: false,
    nearbyPlaces: [],
    viewMode: 'map' as const,
    memory: {},
    photos: [],
    isGeneratingPhoto: false,
    persona: localStorage.getItem('luna_persona') || SYSTEM_INSTRUCTION,
    lunaName,
    isLiveMode: false,
  };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...initialState,
        ...parsed,
        lunaName: localStorage.getItem('luna_name') || parsed.lunaName || 'Luna',
        isThinking: false,
        isSpeaking: false,
        isGeneratingPhoto: false,
        isLiveMode: false,
      };
    } catch (e) {
      console.error('Failed to load storage:', e);
    }
  }
  return initialState;
};

export function TravelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TravelState>(getInitialState);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveService, setLiveService] = useState<GeminiLiveService | null>(null);
  const [streamer] = useState(new AudioStreamer());
  const [audioElement] = useState(new Audio());

  const getDynamicInstruction = useCallback(() => {
    const personaKey = localStorage.getItem('luna_selection') || 'luna-1';
    const userName = localStorage.getItem('user_name') || '사용자';

    if (personaKey === 'custom') {
      return localStorage.getItem('luna_persona') || SYSTEM_INSTRUCTION;
    }

    let base = LUNA_PERSONAS[personaKey as keyof typeof LUNA_PERSONAS] || LUNA_PERSONAS['luna-1'];
    return base.replace(/{userName}/g, userName);
  }, []);

  useEffect(() => {
    const { history, currentLocation, memory, nearbyPlaces, photos, persona, lunaName } = state;
    localStorage.setItem('luna_travel_state', JSON.stringify({
      history: history.slice(-20),
      currentLocation,
      memory,
      nearbyPlaces,
      photos: photos.slice(0, 10),
      persona,
      lunaName
    }));
  }, [state.history, state.currentLocation, state.memory, state.nearbyPlaces, state.photos, state.persona, state.lunaName]);

  const stopAudio = useCallback(() => {
    audioElement.pause();
    audioElement.currentTime = 0;
    if (isLiveMode && liveService) {
      liveService.sendInterrupt();
    }
    streamer.clearPlayback();
    streamer.unmuteRecording();
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

  const moveTo = useCallback((location: Location, name?: string, goStreetView = false) => {
    setState(prev => ({
      ...prev,
      currentLocation: { ...location, name: name || location.name },
      viewMode: goStreetView ? 'streetview' : prev.viewMode
    }));
  }, []);

  const syncLocationContext = useCallback((location: Location, name?: string) => {
    if (isLiveMode && liveService) {
      const locationText = `📍현재 지도 위치: ${name || location.name || '알 수 없는 장소'} (좌표: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`;
      liveService.sendText(locationText);
    }
  }, [isLiveMode, liveService]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };

    setState(prev => ({
      ...prev,
      history: [...prev.history, userMessage],
      isThinking: true
    }));

    if (isLiveMode && liveService) {
      liveService.sendText(text);
      setState(prev => ({ ...prev, isThinking: false }));
      return;
    }

    const apiHistory = state.history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model' as any,
      parts: [{ text: msg.text }]
    }));

    try {
      const voiceName = localStorage.getItem('luna_voice') || 'Aoede';
      const { text: replyText, groundingMetadata, audioData } = await chatWithAura(text, apiHistory, state.currentLocation, getDynamicInstruction(), voiceName);

      const extractedPlaces: Place[] = [];
      const groundingChunks = groundingMetadata?.groundingChunks || [];
      for (const chunk of groundingChunks) {
        if (chunk.maps && chunk.maps.title) {
          const placeName = chunk.maps.title;
          const placeId = `ground-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          extractedPlaces.push({
            id: placeId,
            name: placeName,
            location: state.currentLocation,
            type: placeName.toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction',
            url: chunk.maps.uri
          });

          if (typeof google !== 'undefined' && google.maps?.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: placeName, location: state.currentLocation }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location;
                const newLoc = { lat: loc.lat(), lng: loc.lng() };
                setState(inner => ({
                  ...inner,
                  nearbyPlaces: inner.nearbyPlaces.map(p => p.id === placeId ? { ...p, location: newLoc } : p)
                }));
              }
            });
          }
        }
      }

      const aiMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text: replyText, timestamp: Date.now() };
      setState(prev => ({
        ...prev,
        history: [...prev.history, aiMessage],
        isThinking: false,
        isSpeaking: !!audioData,
        nearbyPlaces: extractedPlaces.length > 0 ? [...prev.nearbyPlaces, ...extractedPlaces] : prev.nearbyPlaces
      }));
      if (audioData) playAudio(audioData);
    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({ ...prev, isThinking: false }));
    }
  }, [state.history, state.currentLocation, playAudio, isLiveMode, liveService, getDynamicInstruction]);

  const startLiveMode = useCallback(async () => {
    try {
      setIsLiveMode(true);
      await streamer.resumeContext();
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const locationContext = `[MANDATORY CURRENT LOCATION]: ${state.currentLocation.name || 'Seoul'} (Lat: ${state.currentLocation.lat.toFixed(4)}, Lng: ${state.currentLocation.lng.toFixed(4)}).`;
      const liveSystemInstruction = `${getDynamicInstruction()}\n\n${locationContext}`;

      const service = new GeminiLiveService(
        apiKey,
        (msg) => {
          if (msg.error) { stopLiveMode(); return; }
          if (msg.audioData) {
            streamer.playAudioChunk(msg.audioData).catch(e => console.error(e));
            setState(prev => ({ ...prev, isSpeaking: true }));
          }
          if (msg.text) {
            setState(prev => {
              const history = [...prev.history];
              const lastMsg = history[history.length - 1];
              if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-turn')) {
                history[history.length - 1] = { ...lastMsg, text: lastMsg.text + msg.text };
              } else {
                history.push({ id: `live-turn-${Date.now()}`, role: 'model', text: msg.text, timestamp: Date.now() });
              }
              return { ...prev, history, isThinking: false };
            });
          }
          if (msg.isEnd) setState(prev => ({ ...prev, isSpeaking: false }));

          if (msg.toolCall && msg.toolCall.name === 'show_place_on_map') {
            const { name, address, category } = msg.toolCall.args;
            const placeId = `tool-${Date.now()}`;
            setState(prev => ({
              ...prev,
              nearbyPlaces: [...prev.nearbyPlaces, {
                id: placeId,
                name,
                location: prev.currentLocation,
                type: category || (name.toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction')
              }]
            }));

            if (typeof google !== 'undefined' && google.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: address || name, location: state.currentLocation }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                  const loc = results[0].geometry.location;
                  const newLoc = { lat: loc.lat(), lng: loc.lng() };
                  setState(inner => ({
                    ...inner,
                    nearbyPlaces: inner.nearbyPlaces.map(p => p.id === placeId ? { ...p, location: newLoc } : p)
                  }));
                }
              });
            }
          }
        },
        async () => {
          setIsLiveMode(true);
          service.sendInitialHistory(state.history, state.memory);
          await streamer.startRecording((base64) => service.sendAudio(base64));
        },
        () => setIsLiveMode(false),
        () => streamer.clearPlayback(),
        liveSystemInstruction
      );

      service.connect();
      setLiveService(service);
    } catch (err) {
      console.error("Live start error:", err);
      setIsLiveMode(false);
    }
  }, [state.history, state.memory, state.currentLocation, streamer, getDynamicInstruction]);

  const stopLiveMode = useCallback(() => {
    liveService?.disconnect();
    streamer.stopRecording();
    setIsLiveMode(false);
    setLiveService(null);
    setState(prev => ({ ...prev, isThinking: false, isSpeaking: false }));
  }, [liveService, streamer]);

  const resetSession = useCallback(() => {
    if (window.confirm('대화 내역과 위치 정보를 초기화하시겠어요?')) {
      localStorage.removeItem('luna_travel_state');
      window.location.reload();
    }
  }, []);

  const takeTravelPhoto = useCallback(async (location: Location, heading: number, pitch: number, zoom: number) => {
    setState(prev => ({ ...prev, isGeneratingPhoto: true }));
    try {
      const userPhoto = localStorage.getItem('user_photo');
      const lunaPhoto = localStorage.getItem('luna_photo');
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!userPhoto || !lunaPhoto) throw new Error('사용자 또는 루나 사진이 없습니다.');

      const response = await fetch('/api/generate-travel-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundImage: `/api/streetview?lat=${location.lat}&lng=${location.lng}&heading=${heading}&pitch=${pitch}&key=${apiKey}`,
          userPhoto,
          lunaPhoto
        })
      });

      if (!response.ok) throw new Error('사진 생성 실패');
      const { base64: resultUrl } = await response.json();

      const newPhoto = {
        id: Date.now().toString(),
        url: `data:image/jpeg;base64,${resultUrl}`,
        locationName: location.name || '여행지',
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        isGeneratingPhoto: false,
        photos: [newPhoto, ...prev.photos].slice(0, 10)
      }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isGeneratingPhoto: false }));
    }
  }, []);

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
