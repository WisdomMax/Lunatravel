/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { TravelState, Message, Location, Place } from '../types';
import { chatWithLuna } from '../services/geminiService';
import { GeminiLiveService } from '../services/geminiLiveService';
import { AudioStreamer } from '../utils/audioStreamer';
import { INITIAL_LOCATION, SYSTEM_INSTRUCTION, LUNA_PERSONAS, BASE_INSTRUCTION } from '../constants';

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
  deletePhoto: (photoId: string) => Promise<void>;
  addBookmark: (location: Location) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  sendLiveVideo: (base64: string) => void;
  toggleBgm: () => void;
  setBgmVolume: (volume: number) => void;
  nextBgm: () => void;
  prevBgm: () => void;
  selectBgm: (index: number) => void;
  setBgmMode: (mode: 'loop' | 'playlist') => void;
  showModal: (options: { title: string, message: string, type?: 'alert' | 'confirm', onConfirm?: () => void, onCancel?: () => void }) => void;
  hideModal: () => void;
  modal: { isOpen: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void, onCancel?: () => void };
  updateSettings: (updates: Partial<TravelState> | Record<string, any>) => Promise<void>;
}

const TravelContext = createContext<TravelContextType | undefined>(undefined);

const getInitialState = (): TravelState => {
  const saved = localStorage.getItem('luna_travel_state');
  const lunaSelection = localStorage.getItem('luna_selection') || 'luna-1';
  
  const initialState: TravelState = {
    currentLocation: INITIAL_LOCATION,
    history: [],
    isThinking: false,
    isSpeaking: false,
    nearbyPlaces: [],
    viewMode: 'map' as const,
    memory: {},
    photos: [],
    bookmarks: [],
    persona: '',
    lunaName: localStorage.getItem('luna_name') || 'Luna',
    lunaPhoto: localStorage.getItem('luna_photo') || '',
    lunaSelection: lunaSelection,
    isGeneratingPhoto: false,
    isLiveMode: false,
    isBgmPlaying: true,
    bgmVolume: 1.0,
    currentBgmIndex: 0,
    bgmPlaylist: [],
    bgmMode: 'loop',
    chatHistories: {},
    photoHistories: {},
    lunaPhotos: {},
    customType: (localStorage.getItem('custom_type') as any) || 'female',
    isInitialized: false,
  };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const currentKey = lunaSelection === 'custom' ? 'custom' : lunaSelection;
      
      const chatHistories = parsed.chatHistories || {};
      const photoHistories = parsed.photoHistories || {};
      const lunaPhotosMap = parsed.lunaPhotos || {};

      const currentHistory = chatHistories[currentKey] || [];
      const currentPhotos = photoHistories[currentKey] || [];
      const currentLunaPhoto = lunaPhotosMap[currentKey] || parsed.lunaPhoto || '';

      return {
        ...initialState,
        ...parsed,
        lunaSelection, 
        lunaName: localStorage.getItem('luna_name') || parsed.lunaName || 'Luna',
        lunaPhoto: currentLunaPhoto,
        history: currentHistory,
        photos: currentPhotos,
        chatHistories: { ...chatHistories, [currentKey]: currentHistory },
        photoHistories: { ...photoHistories, [currentKey]: currentPhotos },
        lunaPhotos: { ...lunaPhotosMap, [currentKey]: currentLunaPhoto },
        isThinking: false,
        isSpeaking: false,
        isGeneratingPhoto: false,
        isLiveMode: false,
        isBgmPlaying: parsed.isBgmPlaying ?? true,
        bgmVolume: parsed.bgmVolume ?? 1.0,
        isInitialized: false,
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
  const locationRef = useRef(state.currentLocation);

  useEffect(() => {
    locationRef.current = state.currentLocation;
  }, [state.currentLocation]);

  const [streamer] = useState(new AudioStreamer());
  const [audioElement] = useState(new Audio());
  const [modal, setModal] = useState<{ 
    isOpen: boolean, 
    title: string, 
    message: string, 
    type: 'alert' | 'confirm', 
    onConfirm?: () => void, 
    onCancel?: () => void 
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  useEffect(() => {
    streamer.setStatusCallback((isPlaying) => {
      setState(prev => ({ ...prev, isSpeaking: isPlaying }));
    });
  }, [streamer]);

  const showModal = useCallback((options: { title: string, message: string, type?: 'alert' | 'confirm', onConfirm?: () => void, onCancel?: () => void }) => {
    setModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'alert',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel
    });
  }, []);

  useEffect(() => {
    streamer.setStatusCallback((isPlaying) => {
      setState(prev => ({ ...prev, isSpeaking: isPlaying }));
    });
  }, [streamer]);

  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const s = await response.json();
          if (s && Object.keys(s).length > 0) {
            if (s.user_name) localStorage.setItem('user_name', s.user_name);
            if (s.user_photo) localStorage.setItem('user_photo', s.user_photo);
            if (s.luna_name) localStorage.setItem('luna_name', s.luna_name);
            if (s.luna_selection) localStorage.setItem('luna_selection', s.luna_selection);
            if (s.luna_photo) localStorage.setItem('luna_photo', s.luna_photo);
            if (s.custom_type) localStorage.setItem('custom_type', s.custom_type);
            
            setState(prev => {
              const currentSelection = s.luna_selection || s.lunaSelection || prev.lunaSelection;
              const currentType = s.custom_type || s.customType || prev.customType;
              const chatHistories = s.chat_histories || s.chatHistories || prev.chatHistories || {};
              const photoHistories = s.photo_histories || s.photoHistories || prev.photoHistories || {};
              const lunaPhotosMap = s.luna_photos || s.lunaPhotos || prev.lunaPhotos || {};
              
              const currentKey = currentSelection === 'custom' ? 'custom' : currentSelection;
              const isolatedHistory = chatHistories[currentKey] || [];
              const isolatedPhotos = photoHistories[currentKey] || [];
              const isolatedLunaPhoto = lunaPhotosMap[currentKey] || s.luna_photo || s.lunaPhoto || prev.lunaPhoto;

              return {
                ...prev,
                lunaName: s.luna_name || s.lunaName || prev.lunaName,
                lunaPhoto: isolatedLunaPhoto,
                lunaSelection: currentSelection,
                customType: currentType,
                history: isolatedHistory,
                photos: isolatedPhotos,
                chatHistories: chatHistories,
                photoHistories: photoHistories,
                lunaPhotos: lunaPhotosMap,
                bgmVolume: s.bgm_volume !== undefined ? s.bgm_volume : (s.bgmVolume !== undefined ? s.bgmVolume : prev.bgmVolume),
                isInitialized: true
              };
            });
          }
        }
      } catch (err) {
        console.warn("[TravelContext] Failed to load server settings:", err);
        showModal({
          title: "Error",
          message: "Failed to load server settings. Please check your network connection or try again later.",
          type: "alert"
        });
      }
    };
    syncWithServer();
  }, [showModal]);

  const getDynamicInstruction = useCallback(() => {
    const personaKey = state.lunaSelection;
    const userName = localStorage.getItem('user_name') || 'User';
    let personaText = '';
    if (personaKey === 'custom') {
      personaText = state.persona || localStorage.getItem('luna_persona') || 'A sweet and curious travel companion.';
    } else {
      const fullPersona = LUNA_PERSONAS[personaKey as keyof typeof LUNA_PERSONAS] || LUNA_PERSONAS['luna-1'];
      personaText = fullPersona.split('[SYSTEM ROLE & RULES]:').pop() || fullPersona;
    }
    const processedPersona = personaText.replace(/{userName}/g, userName);
    let styleNote = "\n[STYLE GUIDE]: Use very friendly, casual, and comfortable speech as a close friend/sister.";
    if (personaKey === 'luna-2') styleNote = "\n[STYLE GUIDE]: Use very formal, polite, and respectful speech (Professional Guide style).";
    return `${processedPersona}\n\n${BASE_INSTRUCTION}${styleNote}`;
  }, [state.lunaSelection, state.lunaName, state.persona]);

  const stopAudio = useCallback(() => {
    if (isLiveMode && liveService) {
      liveService.sendInterrupt();
    }
    streamer.clearPlayback();
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, [isLiveMode, liveService, streamer]);

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
      currentLocation: { ...location, name: name || location.name || prev.currentLocation.name },
      viewMode: goStreetView ? 'streetview' : prev.viewMode
    }));

    if (!name && !location.name && typeof google !== 'undefined' && google.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: location.lat, lng: location.lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const address = results[0].formatted_address;
          setState(prev => ({
            ...prev,
            currentLocation: { ...prev.currentLocation, name: address }
          }));
        }
      });
    }
  }, []);

  const handleToolCall = useCallback((toolCall: any) => {
    if (toolCall.name === 'show_place_on_map') {
      const { name, address, category } = toolCall.args;
      const placeId = `live-tool-${Date.now()}`;
      
      setState(prev => {
        const isDuplicate = prev.nearbyPlaces.some(p => p.name === name);
        const newNearbyPlaces = isDuplicate ? prev.nearbyPlaces : [...prev.nearbyPlaces, {
          id: placeId,
          name,
          location: prev.currentLocation, 
          type: category || (name.toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction')
        }];

        const newHistory = [...prev.history];
        if (newHistory.length > 0) {
          const lastIndex = newHistory.length - 1;
          const lastMsg = newHistory[lastIndex];
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tagRegex = new RegExp(`\\[\\[PLACE:\\s*${escapedName}\\s*\\]\\]`, 'i');
          if (lastMsg.role === 'model' && !tagRegex.test(lastMsg.text)) {
            newHistory[lastIndex] = { ...lastMsg, text: lastMsg.text + ` [[PLACE: ${name}]]` };
          }
        }

        return { ...prev, history: newHistory, nearbyPlaces: newNearbyPlaces };
      });

      if (typeof google !== 'undefined' && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address || name, location: locationRef.current }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location;
            const newPos = { lat: loc.lat(), lng: loc.lng() };
            setState(inner => ({
              ...inner,
              nearbyPlaces: inner.nearbyPlaces.map(p => p.name === name ? { ...p, location: newPos } : p)
            }));
            moveTo(newPos, name);
          }
        });
      }
    }
  }, [moveTo]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setState(prev => ({ ...prev, history: [...prev.history, userMessage], isThinking: true }));

    if (isLiveMode && liveService) {
      liveService.sendText(text);
      setState(prev => ({ ...prev, isThinking: false }));
      return;
    }

    const apiHistory = state.history.slice(-15).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model' as any,
      parts: [{ text: msg.text }]
    }));

    try {
      const { text: replyText, groundingMetadata, toolCalls, audioData } = await chatWithLuna(text, apiHistory, state.currentLocation, getDynamicInstruction());
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) handleToolCall(call);
      }
      
      // REST 모드 태그 처리
      const placeTags = replyText.matchAll(/\[\[PLACE:\s*(.*?)\s*\]\]/g);
      for (const match of placeTags) {
        if (match[1]) handleToolCall({ name: 'show_place_on_map', args: { name: match[1].trim() } });
      }

      const aiMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text: replyText, timestamp: Date.now() };
      setState(prev => ({ ...prev, history: [...prev.history, aiMessage], isThinking: false, isSpeaking: !!audioData }));
      if (audioData) playAudio(audioData);
    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({ ...prev, isThinking: false }));
    }
  }, [state.history, state.currentLocation, playAudio, isLiveMode, liveService, getDynamicInstruction, handleToolCall]);

  const startLiveMode = useCallback(async () => {
    try {
      setIsLiveMode(true);
      await streamer.resumeContext();
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      let voiceName = 'Aoede'; 
      if (state.lunaSelection === 'custom') {
        if (state.customType === 'male') voiceName = 'Charon';
        else voiceName = 'Callirrhoe';
      } else {
        if (state.lunaSelection === 'luna-1') voiceName = 'Callirrhoe';
        else if (state.lunaSelection === 'luna-2') voiceName = 'Aoede';
        else if (state.lunaSelection === 'luna-3') voiceName = 'Kore';
      }

      const locationContext = `[MANDATORY CURRENT LOCATION]: ${state.currentLocation.name || 'Seoul'} (Lat: ${state.currentLocation.lat.toFixed(4)}, Lng: ${state.currentLocation.lng.toFixed(4)}).`;
      const liveSystemInstruction = `${getDynamicInstruction()}\n\n${locationContext}\n\n[LIVE MODE MANDATORY]: You are speaking via high-quality native audio. 
- To recommend a place or move the map, you MUST call 'show_place_on_map' AND include the tag [[PLACE: Name]] at the END of your speech.
- NEVER read technical markers [[PLACE:...]] aloud.
- Speak naturally.`;

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
              const updatedHistory = [...history];
              
              let currentFullText = '';
              if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-turn-')) {
                currentFullText = lastMsg.text + msg.text;
                updatedHistory[updatedHistory.length - 1] = { ...lastMsg, text: currentFullText };
              } else {
                currentFullText = msg.text;
                updatedHistory.push({ id: `live-turn-${Date.now()}`, role: 'model', text: currentFullText, timestamp: Date.now() });
              }

              // ✅ 누적 텍스트 기반 완벽한 태그 파싱 (분절 오류 해결)
              const placeTags = currentFullText.matchAll(/\[\[PLACE:\s*(.*?)\s*\]\]/g);
              for (const match of placeTags) {
                if (match[1]) handleToolCall({ name: 'show_place_on_map', args: { name: match[1].trim() } });
              }

              return { ...prev, history: updatedHistory, isThinking: false };
            });
          }
          if (msg.toolCall) handleToolCall(msg.toolCall);
          if (msg.isEnd) setState(prev => ({ ...prev, isSpeaking: false }));
        },
        async () => {
          service.sendInitialHistory(state.history.slice(-10), state.memory);
          await streamer.startRecording((base64) => service.sendAudio(base64));
        },
        () => setIsLiveMode(false),
        () => streamer.clearPlayback(),
        liveSystemInstruction,
        voiceName
      );

      service.connect();
      setLiveService(service);
    } catch (e) {
      console.error(e);
      setIsLiveMode(false);
    }
  }, [state.currentLocation, state.lunaSelection, state.customType, state.history, state.memory, streamer, getDynamicInstruction, handleToolCall]);

  const stopLiveMode = useCallback(() => {
    liveService?.disconnect();
    streamer.stopRecording();
    setIsLiveMode(false);
    setLiveService(null);
    setState(prev => ({ ...prev, isThinking: false, isSpeaking: false }));
  }, [liveService, streamer]);

  const resetSession = useCallback(() => {
    showModal({
      title: "Reset Journey",
      message: "Do you want to clear your current history with this person?",
      type: "confirm",
      onConfirm: () => {
        const currentLuna = state.lunaSelection;
        setState(prev => ({
          ...prev,
          history: [],
          chatHistories: { ...prev.chatHistories, [currentLuna]: [] }
        }));
      }
    });
  }, [showModal, state.lunaSelection]);

  const takeTravelPhoto = useCallback(async (location: Location, heading: number, pitch: number, zoom: number, customPrompt?: string) => {
    setState(prev => ({ ...prev, isGeneratingPhoto: true }));
    try {
      const userPhoto = localStorage.getItem('user_photo');
      const lunaPhoto = localStorage.getItem('luna_photo');
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!userPhoto || !lunaPhoto) throw new Error('Photos missing');

      const response = await fetch('/api/generate-travel-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundImage: `/api/streetview?lat=${location.lat}&lng=${location.lng}&heading=${heading}&pitch=${pitch}&key=${apiKey}`,
          userPhoto, lunaPhoto, locationName: location.name, personaKey: state.lunaSelection, customPrompt
        })
      });

      if (!response.ok) throw new Error('Generation failed');
      const { url: resultUrl } = await response.json();
      const newPhoto = { id: Date.now().toString(), url: resultUrl, locationName: location.name || 'Destination', timestamp: Date.now() };

      setState(prev => {
        const storageKey = prev.lunaSelection === 'custom' ? 'custom' : prev.lunaSelection;
        return {
          ...prev,
          isGeneratingPhoto: false,
          photos: [newPhoto, ...prev.photos],
          photoHistories: { ...prev.photoHistories, [storageKey]: [newPhoto, ...(prev.photoHistories[storageKey] || [])] }
        };
      });
    } catch (error: any) {
      console.error('[Capture] Generation error:', error);
      setState(prev => ({ ...prev, isGeneratingPhoto: false }));
      
      // ✅ 사용자 친화적 에러 모달 복구 (Memory -> Photo 표현 개선)
      showModal({
        title: "Photo Generation Failed",
        message: `Oops! Luna couldn't create the travel photo right now. ${error.message || 'Please try again in a moment.'}`,
        type: "alert"
      });
    }
  }, [state.lunaSelection]);

  const value = { state, sendMessage, moveTo, setViewMode, playAudio, stopAudio, isLiveMode, startLiveMode, stopLiveMode, resetSession, takeTravelPhoto,
    deletePhoto: async () => {}, addBookmark: async () => {}, removeBookmark: async () => {}, sendLiveVideo: () => {}, toggleBgm: () => {},
    setBgmVolume: () => {}, nextBgm: () => {}, prevBgm: () => {}, selectBgm: () => {}, setBgmMode: () => {}, showModal, hideModal, modal,
    updateSettings: async (u: any) => { setState(prev => ({ ...prev, ...u })); }
  };

  return <TravelContext.Provider value={value as any}>{children}</TravelContext.Provider>;
}

export const useTravel = () => {
  const context = useContext(TravelContext);
  if (!context) throw new Error('useTravel must be used within TravelProvider');
  return context;
};
