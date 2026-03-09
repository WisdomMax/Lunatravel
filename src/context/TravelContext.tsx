/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { TravelState, Message, Location, Place } from '../types';
import { chatWithLuna } from '../services/geminiService';
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
  deletePhoto: (photoId: string) => Promise<void>;
  addBookmark: (location: Location) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  sendLiveVideo: (base64: string) => void;
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
    bookmarks: [],
    persona: '',
    lunaName: localStorage.getItem('luna_name') || 'Luna',
    lunaPhoto: localStorage.getItem('luna_photo') || '',
    lunaSelection: localStorage.getItem('luna_selection') || 'luna-1',
    isGeneratingPhoto: false,
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

    let base = '';
    if (personaKey === 'custom') {
      base = localStorage.getItem('luna_persona') || SYSTEM_INSTRUCTION;
    } else {
      base = LUNA_PERSONAS[personaKey as keyof typeof LUNA_PERSONAS] || LUNA_PERSONAS['luna-1'];
    }

    // 이름 치환 및 명시적 인지 강화
    const processedBase = base.replace(/{userName}/g, userName);
    return `${processedBase}\n\n[CONFIDENTIAL SYSTEM NOTE]: You are currently traveling with "${userName}". Use this name ("${userName}") naturally when addressing the user, following your assigned persona (e.g., A calls "${userName}", "너", or "야", B calls "${userName}님", C calls "${userName} 오빠" or "오빠"). Never forget the user's name is "${userName}".`;
  }, []);

  useEffect(() => {
    const { history, currentLocation, memory, persona, lunaName, lunaSelection, photos, bookmarks } = state;
    try {
      // localStorage는 백업용으로 유지 (기존 슬라이싱 제거)
      localStorage.setItem('luna_travel_state', JSON.stringify({
        history,
        currentLocation,
        memory,
        persona,
        lunaName,
        lunaSelection,
        photos,
        bookmarks
      }));

      // 서버에도 실시간 저장 (대화 내역 동기화)
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history })
      }).catch(err => console.error("Failed to sync history to server:", err));

    } catch (e) {
      console.warn('Failed to save travel state to localStorage:', e);
    }
  }, [state.history, state.currentLocation, state.memory, state.persona, state.lunaName, state.lunaSelection, state.photos, state.bookmarks]);

  // 서버 설정 동기화
  useEffect(() => {
    const loadServerSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (data) {
          setState(prev => ({
            ...prev,
            lunaName: data.luna_name || prev.lunaName,
            lunaPhoto: data.luna_photo || prev.lunaPhoto,
            lunaSelection: data.luna_selection || prev.lunaSelection,
            photos: data.photos || prev.photos,
            bookmarks: data.bookmarks || prev.bookmarks,
            history: data.history || prev.history, // 서버 히스토리 우선 로드
          }));
          if (data.user_name) localStorage.setItem('user_name', data.user_name);
          if (data.luna_selection) localStorage.setItem('luna_selection', data.luna_selection);
          if (data.luna_photo) localStorage.setItem('luna_photo', data.luna_photo);
          if (data.user_photo) localStorage.setItem('user_photo', data.user_photo);
          if (data.luna_voice) localStorage.setItem('luna_voice', data.luna_voice);
        }
      } catch (err) {
        console.warn("Failed to load server settings in context");
      }
    };
    loadServerSettings();
  }, []);

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
    // 1. 먼저 위치 상태 업데이트 (부드러운 이동을 위해)
    setState(prev => ({
      ...prev,
      currentLocation: { ...location, name: name || location.name || prev.currentLocation.name },
      viewMode: goStreetView ? 'streetview' : prev.viewMode
    }));

    // 2. 이름이 없는 경우 역지오코딩 시도
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

    const apiHistory = state.history.slice(-15).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model' as any,
      parts: [{ text: msg.text }]
    }));

    try {
      const voiceName = localStorage.getItem('luna_voice') || 'Aoede';
      const { text: replyText, groundingMetadata, toolCalls, audioData } = await chatWithLuna(text, apiHistory, state.currentLocation, getDynamicInstruction());

      // REST 채팅에서의 도구 호출 처리
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if (call.name === 'show_place_on_map') {
            const args = call.args as any;
            const placeName = args?.name;
            if (placeName && typeof google !== 'undefined' && google.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: placeName, location: state.currentLocation }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                  const loc = results[0].geometry.location;
                  const newPlace: Place = {
                    id: `rest-${Date.now()}`,
                    name: placeName,
                    location: { lat: loc.lat(), lng: loc.lng() },
                    type: String(placeName).toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction'
                  };
                  setState(prev => ({
                    ...prev,
                    nearbyPlaces: prev.nearbyPlaces.some(p => p.name === placeName)
                      ? prev.nearbyPlaces
                      : [...prev.nearbyPlaces, newPlace]
                  }));
                  // 지도를 해당 장소로 즉시 이동 (사용자 요청: 스트리트뷰 전환 방지)
                  moveTo(newPlace.location, placeName, false);
                }
              });
            }
          }
        }
      }

      let finalReplyText = replyText;

      // 텍스트 내 [[PLACE: ...]] 태그 추출하여 Luna's Pick에 동기화 (순차적 처리로 429 방지)
      const placeTags = finalReplyText.match(/\[\[PLACE:(.*?)\]\]/g);
      if (placeTags && typeof google !== 'undefined' && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();

        // 태그들을 하나씩 처리하기 위한 재귀 함수
        const processTag = (index: number) => {
          if (index >= placeTags.length) return;

          const tag = placeTags[index];
          const name = tag.match(/\[\[PLACE:(.*?)\]\]/)?.[1].trim();

          if (name && !state.nearbyPlaces.some(p => p.name === name)) {
            geocoder.geocode({ address: name, location: state.currentLocation }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location;
                const newPlace: Place = {
                  id: `tag-${Date.now()}-${Math.random()}`,
                  name: name,
                  location: { lat: loc.lat(), lng: loc.lng() },
                  type: name.toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction'
                };
                setState(prev => ({
                  ...prev,
                  nearbyPlaces: prev.nearbyPlaces.some(p => p.name === name)
                    ? prev.nearbyPlaces
                    : [...prev.nearbyPlaces, newPlace]
                }));
              }
              // 다음 태그 처리를 위해 300ms 대기 (속도 제한 준수)
              setTimeout(() => processTag(index + 1), 300);
            });
          } else {
            processTag(index + 1);
          }
        };

        processTag(0);
      }

      const extractedPlaces: Place[] = [];
      const groundingChunks = groundingMetadata?.groundingChunks || [];

      const processGroundingChunk = (index: number) => {
        if (index >= groundingChunks.length) return;

        const chunk = groundingChunks[index];
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
              // 300ms 대기 후 다음 청크 처리
              setTimeout(() => processGroundingChunk(index + 1), 300);
            });
          } else {
            processGroundingChunk(index + 1);
          }
        } else {
          processGroundingChunk(index + 1);
        }
      };

      processGroundingChunk(0);

      if (groundingMetadata?.groundingChunks) {
        const links = groundingMetadata.groundingChunks
          .map((c: any) => c.web?.url)
          .filter(Boolean);
        if (links.length > 0) {
          const uniqueLinks = [...new Set(links)];
          finalReplyText += "\n\n🔗 관련 정보:\n" + uniqueLinks.join("\n");
        }
      }

      const aiMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text: finalReplyText, timestamp: Date.now() };
      setState(prev => ({
        ...prev,
        history: [...prev.history, aiMessage],
        isThinking: false,
        isSpeaking: !!audioData,
        nearbyPlaces: extractedPlaces.length > 0
          ? [...prev.nearbyPlaces, ...extractedPlaces.filter(ep => !prev.nearbyPlaces.some(p => p.name === ep.name))]
          : prev.nearbyPlaces
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
          if (msg.groundingMetadata) {
            console.log('[TravelContext] Live Grounding Metadata Received:', msg.groundingMetadata);
            // 구글 검색 결과가 있는 경우, 메시지 끝에 링크 추가 시도
            const gm = msg.groundingMetadata;
            const chunks = gm.groundingChunks || gm.grounding_chunks || gm.supportChunks || gm.support_chunks || [];

            // 다양한 경로에서 URL 추출 시도
            const links: string[] = [];
            chunks.forEach((c: any) => {
              const url = c.web?.url || c.sourceMetadata?.uri || c.source_metadata?.uri || c.sourceMetadata?.url || c.source_metadata?.url;
              if (url) links.push(url);
            });

            // search_entry_point 처리 (일부 모델에서 사용)
            if (gm.searchEntryPoint?.htmlContent || gm.search_entry_point?.html_content) {
              console.log('[TravelContext] Search entry point detected, but we prefer direct links if possible.');
            }

            if (links.length > 0) {
              setState(prev => {
                const history = [...prev.history];
                const lastMsg = history[history.length - 1];
                if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-turn')) {
                  const uniqueLinks = [...new Set(links)];
                  const linkText = "\n\n🔗 관련 검색 결과:\n" + uniqueLinks.join("\n");
                  // 내용이 중복되지 않도록 체크
                  if (!lastMsg.text.includes(linkText.trim())) {
                    history[history.length - 1] = { ...lastMsg, text: lastMsg.text + linkText };
                  }
                }
                return { ...prev, history };
              });
            }
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
          // 라이브 모드에서도 최신 10개의 대화만 컨텍스트로 전달하여 성능 유지
          service.sendInitialHistory(state.history.slice(-10), state.memory);
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

      if (!userPhoto || userPhoto === "") {
        alert("플레이어 사진이 설정되지 않았습니다. 설정 화면에서 사진을 먼저 등록해주세요!");
        throw new Error('사용자 사진 정보가 없습니다.');
      }
      if (!lunaPhoto || lunaPhoto === "") throw new Error('루나 사진 정보가 없습니다.');

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

  const deletePhoto = useCallback(async (photoId: string) => {
    try {
      const response = await fetch('/api/delete-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId })
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          photos: prev.photos.filter(p => p.id !== photoId)
        }));
      }
    } catch (err) {
      console.error("Delete photo error:", err);
    }
  }, []);

  const addBookmark = useCallback(async (location: Location) => {
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookmark: {
            name: location.name || 'Saved Location',
            location,
            type: 'other'
          }
        })
      });

      if (response.ok) {
        const { bookmarks } = await response.json();
        setState(prev => ({ ...prev, bookmarks }));
      }
    } catch (err) {
      console.error("Add bookmark error:", err);
    }
  }, []);

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    try {
      const response = await fetch('/api/delete-bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarkId })
      });

      if (response.ok) {
        const { bookmarks } = await response.json();
        setState(prev => ({ ...prev, bookmarks }));
      }
    } catch (err) {
      console.error("Remove bookmark error:", err);
    }
  }, []);

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
      resetSession,
      takeTravelPhoto,
      deletePhoto,
      addBookmark,
      removeBookmark,
      sendLiveVideo: (base64: string) => liveService?.sendVideo(base64)
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
