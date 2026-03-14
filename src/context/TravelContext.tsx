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
  };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // [중요] 모든 캐릭터는 자신의 ID를 키로 사용하여 데이터를 격리합니다.
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
      };
    } catch (e) {
      console.error('Failed to load storage:', e);
    }
  }

  // 로컬에 데이터가 없거나 실패한 경우 기본값 반환
  return initialState;
};

export function TravelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TravelState>(getInitialState);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveService, setLiveService] = useState<GeminiLiveService | null>(null);
  const locationRef = useRef(state.currentLocation);

  // Sync ref with state for use in closures
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

  // 0. 서버 설정 동기화 (캐릭터별 격리 보장 버전)
  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const s = await response.json();
          if (s && Object.keys(s).length > 0) {
            console.log("[TravelContext] Syncing server settings with Isolation logic");
            
            // 로컬 스토리지 업데이트
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

              console.log(`[TravelContext] Server sync: ${isolatedPhotos.length} photos for ${currentKey}`);

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
                bgmVolume: s.bgm_volume !== undefined ? s.bgm_volume : (s.bgmVolume !== undefined ? s.bgmVolume : prev.bgmVolume)
              };
            });
          }
        }
      } catch (err) {
        console.warn("[TravelContext] Failed to load server settings");
      }
    };
    syncWithServer();
  }, []);

  const showModal = useCallback((options: { 
    title: string, 
    message: string, 
    type?: 'alert' | 'confirm', 
    onConfirm?: () => void, 
    onCancel?: () => void 
  }) => {
    setModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'alert',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel
    });
  }, []);

  const hideModal = useCallback(() => {
    setModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const getDynamicInstruction = useCallback(() => {
    const personaKey = state.lunaSelection;
    const userName = localStorage.getItem('user_name') || 'User';
    const lunaName = state.lunaName || localStorage.getItem('luna_name') || 'Luna';

    let personaText = '';
    if (personaKey === 'custom') {
      // state.persona(서버/컨텍스트 최신상태) 우선, 없으면 localStorage
      personaText = state.persona || localStorage.getItem('luna_persona') || 'A sweet and curious travel companion.';
    } else {
      // Find the specific persona part (LUNA_PERSONAS contains BASE_INSTRUCTION, so we split it)
      const fullPersona = LUNA_PERSONAS[personaKey as keyof typeof LUNA_PERSONAS] || LUNA_PERSONAS['luna-1'];
      personaText = fullPersona.split('[SYSTEM ROLE & RULES]:').pop() || fullPersona;
    }

    // Replace name placeholder
    const processedPersona = personaText.replace(/{userName}/g, userName);

    // Style guide based on persona
    let styleNote = "\n[STYLE GUIDE]: Use very friendly, casual, and comfortable speech as a close friend/sister.";
    if (personaKey === 'luna-2') {
      styleNote = "\n[STYLE GUIDE]: Use very formal, polite, and respectful speech (Professional Guide style).";
    } else if (personaKey === 'custom') {
      if (state.customType === 'male') {
        styleNote = "\n[STYLE GUIDE]: You are a cool, reliable, and slightly deep-voiced male companion. Speak like a trustworthy older brother or a loyal friend. Use a calm yet friendly tone.";
      } else if (state.customType === 'animal') {
        styleNote = "\n[STYLE GUIDE]: You are an adorable and mischievous animal companion. Speak in a VERY cute, bubbly, and neutral-gendered tone. Add playful sounds or expressions frequently!";
      } else {
        styleNote = "\n[STYLE GUIDE]: Maintain a friendly and supportive tone that matches your defined persona.";
      }
    }
    
    // Combine foundations
    let finalInstruction = `[MANDATORY SYSTEM RULES]:
${BASE_INSTRUCTION}

[SPECIFIC PERSONA & STYLE]:
${processedPersona}${styleNote}

[IMPORTANT - ADDRESSING THE USER]:
- Your name is "${lunaName}". You must strongly recognize yourself as "${lunaName}" and introduce yourself as such.
- User's actual name is "${userName}".
- HOWEVER, if the [SPECIFIC PERSONA] above defines a specific way to address the user (e.g., "Dad", "Master", "Brother", "Honey"), you MUST prioritize that nickname/address over their real name in every single response.
- Your personality traits and the defined relationship are the MOST important elements of your character. Always stay in character.`;

    // Final Dynamic Replacement for names
    // Use a single-pass replacement approach to avoid naming conflicts
    finalInstruction = finalInstruction.replace(/{partnerName}|{lunaName}/g, lunaName);
    
    // Cleanup redundant spaces or lines
    return finalInstruction.trim();
  }, [state.lunaSelection, state.persona]);

  useEffect(() => {
    const { history, currentLocation, memory, persona, lunaName, lunaSelection, photos, bookmarks, chatHistories, photoHistories, lunaPhotos, nearbyPlaces } = state;
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
        bookmarks,
        chatHistories,
        photoHistories,
        lunaPhotos,
        nearbyPlaces
      }));

      // 서버에도 실시간 저장 (대화 내역, 사진첩, 추천 장소, 북마크 동기화)
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history, 
          chat_histories: chatHistories,
          photos,
          photo_histories: photoHistories,
          nearbyPlaces,
          bookmarks,
          luna_photos: lunaPhotos
        })
      }).catch(err => console.error("Failed to sync state to server:", err));

    } catch (e) {
      console.warn('Failed to save travel state to localStorage:', e);
    }
  }, [state.history, state.currentLocation, state.memory, state.persona, state.lunaName, state.lunaSelection, state.photos, state.bookmarks, state.chatHistories, state.photoHistories, state.lunaPhotos, state.nearbyPlaces]);

  // (통합된 서버 동기화 로직에 따라 중복 제거)

  // BGM 목록 불러오기
  useEffect(() => {
    const loadBgmPlaylist = async () => {
      try {
        const response = await fetch('/api/audio-list');
        const playlist = await response.json();
        const randomIndex = playlist.length > 0 ? Math.floor(Math.random() * playlist.length) : 0;
        setState(prev => ({ 
          ...prev, 
          bgmPlaylist: playlist,
          currentBgmIndex: randomIndex
        }));
      } catch (err) {
        console.warn("Failed to load BGM playlist");
      }
    };
    loadBgmPlaylist();
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
            const placeName = args?.name || args?.placeName; // 호환성 유지
            if (placeName && typeof google !== 'undefined' && google.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: placeName, location: state.currentLocation }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                  // 현재 위치에서 가장 가까운 결과를 선택하도록 정렬
                  const sortedResults = results.sort((a, b) => {
                    if (!a.geometry?.location || !b.geometry?.location) return 0;
                    const distA = Math.pow(a.geometry.location.lat() - state.currentLocation.lat, 2) + Math.pow(a.geometry.location.lng() - state.currentLocation.lng, 2);
                    const distB = Math.pow(b.geometry.location.lat() - state.currentLocation.lat, 2) + Math.pow(b.geometry.location.lng() - state.currentLocation.lng, 2);
                    return distA - distB;
                  });

                  const loc = sortedResults[0].geometry.location;
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
      const placeTags = finalReplyText.match(/\[\[PLACE:\s*(.*?)\s*\]\]/g);
      if (placeTags && typeof google !== 'undefined' && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();

        // 태그들을 하나씩 처리하기 위한 재귀 함수
        const processTag = (index: number) => {
          if (index >= placeTags.length) return;

          const tag = placeTags[index];
          const name = tag.match(/\[\[PLACE:\s*(.*?)\s*\]\]/)?.[1].trim();

          if (name && !state.nearbyPlaces.some(p => p.name === name)) {
            geocoder.geocode({ address: name, location: state.currentLocation }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                // 현재 위치 기준 가까운 장소 우선 선택 정렬
                const sortedResults = results.sort((a, b) => {
                  if (!a.geometry?.location || !b.geometry?.location) return 0;
                  const distA = Math.pow(a.geometry.location.lat() - state.currentLocation.lat, 2) + Math.pow(a.geometry.location.lng() - state.currentLocation.lng, 2);
                  const distB = Math.pow(b.geometry.location.lat() - state.currentLocation.lat, 2) + Math.pow(b.geometry.location.lng() - state.currentLocation.lng, 2);
                  return distA - distB;
                });

                const loc = sortedResults[0].geometry.location;
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

  const handleToolCall = useCallback((toolCall: any) => {
    if (toolCall.name === 'show_place_on_map') {
      const { name, address, category } = toolCall.args;
      const placeId = `live-tool-${Date.now()}`;
      
      // 1. 리스트 추가 및 히스토리 내 태그 자동 주입 (방어 로직)
      setState(prev => {
        const isDuplicate = prev.nearbyPlaces.some(p => p.name === name);
        const newNearbyPlaces = isDuplicate ? prev.nearbyPlaces : [...prev.nearbyPlaces, {
          id: placeId,
          name,
          location: prev.currentLocation, 
          type: category || (name.toLowerCase().match(/restaurant|cafe|bar|pub/) ? 'restaurant' : 'attraction')
        }];

        // 현재 마지막 메시지가 모델이거나, 라이브 모드에서 스트리밍 중인 메시지 업데이트
        const newHistory = [...prev.history];
        if (newHistory.length > 0) {
          const lastIndex = newHistory.length - 1;
          const lastMsg = newHistory[lastIndex];
          
          // 태그가 실제로 없는 경우에만 추가 (대소문자 구분 없이 체크)
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tagRegex = new RegExp(`\\[\\[PLACE:\\s*${escapedName}\\s*\\]\\]`, 'i');
          const hasTag = tagRegex.test(lastMsg.text);

          if (lastMsg.role === 'model' && !hasTag) {
            newHistory[lastIndex] = {
              ...lastMsg,
              text: lastMsg.text + ` [[PLACE: ${name}]]`
            };
          }
        }

        return {
          ...prev,
          history: newHistory,
          nearbyPlaces: newNearbyPlaces
        };
      });

      // 2. 지오코딩 및 지도 이동
      if (typeof google !== 'undefined' && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address || name, location: locationRef.current }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location;
            const newPos = { lat: loc.lat(), lng: loc.lng() };
            
            // 좌표 업데이트
            setState(inner => ({
              ...inner,
              nearbyPlaces: inner.nearbyPlaces.map(p => p.name === name ? { ...p, location: newPos } : p)
            }));

            // 지도를 해당 장소로 즉시 이동 및 핀 찍기 효과
            moveTo(newPos, name);
          }
        });
      }
    }
  }, [moveTo]);

  const stopLiveMode = useCallback(() => {
    liveService?.disconnect();
    streamer.stopRecording();
    setIsLiveMode(false);
    setLiveService(null);
    setState(prev => ({ ...prev, isThinking: false, isSpeaking: false }));
  }, [liveService, streamer]);

  const startLiveMode = useCallback(async () => {
    try {
      setIsLiveMode(true);
      await streamer.resumeContext();
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // 캐릭터 페르소나 및 성별/유형에 따른 보이스 매핑
      let voiceName = 'Aoede'; 
      let ageInstruction = '';
      if (state.lunaSelection === 'custom') {
        if (state.customType === 'male') voiceName = 'Charon';
        else if (state.customType === 'animal') {
          voiceName = 'Kore'; // youthful female-ish tone is generally better for child-like sounds
          ageInstruction = "\n\n[VOICE TONE MANDATORY]: You are a 5-year-old human child. Your voice MUST be extremely high-pitched, innocent, and bright. DO NOT use an adult's tone or resonance. Speak like a toddler with high energy and simple vocabulary. This is for an animal character, so keep it cute and tiny.";
        }
        else voiceName = 'Callirrhoe';
      } else {
        if (state.lunaSelection === 'luna-1') voiceName = 'Callirrhoe';
        else if (state.lunaSelection === 'luna-2') voiceName = 'Aoede';
        else if (state.lunaSelection === 'luna-3') voiceName = 'Kore';
      }

      const locationContext = `[MANDATORY CURRENT LOCATION]: ${state.currentLocation.name || 'Seoul'} (Lat: ${state.currentLocation.lat.toFixed(4)}, Lng: ${state.currentLocation.lng.toFixed(4)}).`;
      const liveSystemInstruction = `${getDynamicInstruction()}\n\n${locationContext}\n\n[LIVE MODE MANDATORY]: You are speaking via high-quality native audio. To recommend a place, call 'show_place_on_map'. If asked for details, use Google Search freely. NEVER read technical markers [[PLACE:...]] or URLs aloud. Speak naturally and act as a real travel companion.${ageInstruction}`;

      const service = new GeminiLiveService(
        apiKey,
        (msg) => {
          if (msg.error) {
            console.error('[LunaLive] Message Error:', msg.error);
            stopLiveMode();
            return;
          }

          if (msg.audioData) {
            streamer.playAudioChunk(msg.audioData).catch(e => console.error('[LunaLive] Playback error:', e));
            setState(prev => ({ ...prev, isSpeaking: true }));
          }

          if (msg.text) {
            setState(prev => {
              const history = [...prev.history];
              const lastMsg = history[history.length - 1];
              let newText = msg.text || '';
              
              // [[PLACE: ...]] 태그 실시간 파싱 및 핀 추가 로직 (모든 태그 탐지)
              const placeTags = newText.matchAll(/\[\[PLACE:\s*(.*?)\s*\]\]/g);
              for (const match of placeTags) {
                if (match[1]) {
                  handleToolCall({ name: 'show_place_on_map', args: { name: match[1].trim() } });
                }
              }

              const updatedHistory = [...history];
              if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-turn-')) {
                updatedHistory[updatedHistory.length - 1] = { ...lastMsg, text: lastMsg.text + newText };
              } else {
                updatedHistory.push({ id: `live-turn-${Date.now()}`, role: 'model', text: newText, timestamp: Date.now() });
              }
              return { ...prev, history: updatedHistory, isThinking: false };
            });
          }

          // 구글 검색 결과 처리
          if (msg.groundingMetadata) {
            const links: string[] = [];
            const gm = msg.groundingMetadata;
            const chunks = gm.groundingChunks || gm.grounding_chunks || [];
            chunks.forEach((c: any) => {
              const url = c.web?.url || c.sourceMetadata?.uri || c.source_metadata?.uri;
              if (url) links.push(url);
            });

            if (links.length > 0) {
              setState(prev => {
                const history = [...prev.history];
                const lastMsg = history[history.length - 1];
                if (lastMsg && lastMsg.role === 'model' && lastMsg.id.startsWith('live-turn-')) {
                   const uniqueLinks = [...new Set(links)];
                   const linkText = "\n\n🔗 관련 검색 결과:\n" + uniqueLinks.join("\n");
                   if (!lastMsg.text.includes(linkText.trim())) {
                     history[history.length - 1] = { ...lastMsg, text: lastMsg.text + linkText };
                     return { ...prev, history };
                   }
                }
                return prev;
              });
            }
          }

          if (msg.isEnd) {
             setState(prev => ({ ...prev, isSpeaking: false }));
          }

          if (msg.toolCall) {
            handleToolCall(msg.toolCall);
          }
        },
        async () => {
          // Status managed via isLiveMode
          service.sendInitialHistory(state.history.slice(-10), state.memory);
          await streamer.startRecording((base64) => service.sendAudio(base64));
        },
        () => {
          setIsLiveMode(false);
        },
        () => streamer.clearPlayback(),
        liveSystemInstruction,
        voiceName
      );

      service.connect();
      setLiveService(service);
    } catch (error) {
      console.error('Failed to start live mode:', error);
      setIsLiveMode(false);
    }
  }, [state.history, state.memory, state.currentLocation, state.lunaSelection, state.customType, stopLiveMode, handleToolCall, getDynamicInstruction, streamer]);

  const resetSession = useCallback(() => {
    showModal({
      title: "Reset Conversation",
      message: `Would you like to clear your conversation history with ${state.lunaName}? This will only delete the chat logs, while your photos and settings will be preserved.`,
      type: "confirm",
      onConfirm: () => {
        // 현재 캐릭터의 대화 목록만 비움
        const currentLuna = state.lunaSelection;
        setState(prev => ({
          ...prev,
          history: [],
          chatHistories: {
            ...prev.chatHistories,
            [currentLuna]: []
          }
        }));
        
        // 서버 동기화는 state 업데이트 시의 useEffect에서 자동으로 처리됨
        console.log(`[TravelContext] Reset chat history for ${state.lunaName}`);
      }
    });
  }, [showModal, state.lunaName, state.lunaSelection]);

  const takeTravelPhoto = useCallback(async (location: Location, heading: number, pitch: number, zoom: number, customPrompt?: string) => {
    setState(prev => ({ ...prev, isGeneratingPhoto: true }));
    try {
      const userPhoto = localStorage.getItem('user_photo');
      const lunaPhoto = localStorage.getItem('luna_photo');
      const apiKey = localStorage.getItem('google_maps_api_key') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!userPhoto || userPhoto === "") {
        showModal({
          title: "Player Photo Missing",
          message: "Please register your photo in the setup screen first to take commemorative photos! 😊",
          type: "alert"
        });
        throw new Error('User photo is missing.');
      }
      if (!lunaPhoto || lunaPhoto === "") {
        showModal({
          title: "Companion Photo Missing",
          message: "Travel companion photo is not ready. Please check your setup again.",
          type: "alert"
        });
        throw new Error('Luna photo is missing.');
      }

      const response = await fetch('/api/generate-travel-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundImage: `/api/streetview?lat=${location.lat}&lng=${location.lng}&heading=${heading}&pitch=${pitch}&key=${apiKey}`,
          userPhoto,
          lunaPhoto,
          locationName: location.name,
          personaKey: state.lunaSelection,
          customPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Photo generation failed');
      }
      const { url: resultUrl } = await response.json();

      const newPhoto = {
        id: Date.now().toString(),
        url: resultUrl,
        locationName: location.name || '여행지',
        timestamp: Date.now()
      };

      setState(prev => {
        const storageKey = prev.lunaSelection === 'custom' ? 'custom' : prev.lunaSelection;
        const newPhotos = [newPhoto, ...prev.photos].slice(0, 10);
        const nextPhotoHistories = { ...prev.photoHistories, [storageKey]: newPhotos };
        
        return {
          ...prev,
          isGeneratingPhoto: false,
          photos: newPhotos,
          photoHistories: nextPhotoHistories
        };
      });
    } catch (error: any) {
      console.error("Take photo error:", error);
      setState(prev => ({ ...prev, isGeneratingPhoto: false }));
      
      showModal({
        title: "Photo Capture Failed",
        message: `Oops! Luna couldn't capture the memory right now. ${error.message || "Please try again later."}`,
        type: "alert"
      });
    }
  }, [showModal, state.lunaSelection]);

  const deletePhoto = useCallback(async (photoId: string) => {
    try {
      const response = await fetch('/api/delete-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId })
      });

      if (response.ok) {
        setState(prev => {
          const currentKey = prev.lunaSelection === 'custom' ? 'custom' : prev.lunaSelection;
          const newPhotos = prev.photos.filter(p => p.id !== photoId);
          return {
            ...prev,
            photos: newPhotos,
            photoHistories: {
              ...prev.photoHistories,
              [currentKey]: newPhotos
            }
          };
        });
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

  // 서버 동기화 작업을 추적하기 위한 ref
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatesRef = useRef<any>({});

  const updateSettings = useCallback(async (updates: any) => {
    // 1. 상태 즉시 업데이트 (UI 반응성 확보)
    let nextFullState: TravelState;

    setState(prev => {
      const nextSelection = updates.luna_selection || updates.lunaSelection || prev.lunaSelection;
      const nextType = updates.custom_type || updates.customType || prev.customType;

      const prevKey = prev.lunaSelection === 'custom' ? 'custom' : prev.lunaSelection;
      const nextKey = nextSelection === 'custom' ? 'custom' : nextSelection;
      
      const isCharacterChanged = nextKey !== prevKey;

      const nextChatHistories = { ...prev.chatHistories };
      const nextPhotoHistories = { ...prev.photoHistories };
      const nextLunaPhotos = { ...prev.lunaPhotos };

      nextChatHistories[prevKey] = prev.history;
      nextPhotoHistories[prevKey] = prev.photos;
      nextLunaPhotos[prevKey] = prev.lunaPhoto;
      
      let nextHistory = updates.history !== undefined ? updates.history : prev.history;
      let nextPhotos = updates.photos !== undefined ? updates.photos : prev.photos;

      if (isCharacterChanged) {
        nextHistory = nextChatHistories[nextKey] || [];
        nextPhotos = nextPhotoHistories[nextKey] || [];
        console.log(`[TravelContext] Character switched to ${nextKey}: Loading ${nextPhotos.length} photos.`);
      } else if (updates.luna_photo || updates.lunaPhoto) {
        nextLunaPhotos[prevKey] = updates.luna_photo || updates.lunaPhoto;
      }

      let finalLunaPhoto = updates.luna_photo || updates.lunaPhoto;
      if (!finalLunaPhoto && isCharacterChanged) {
        finalLunaPhoto = nextLunaPhotos[nextKey] || 
          (nextSelection === 'custom' ? (localStorage.getItem('luna_custom_photo') || '/assets/luna/luna-1.webp') : 
          ({ 'luna-1': '/assets/luna/luna-1.webp', 'luna-2': '/assets/luna/luna-2.webp', 'luna-3': '/assets/luna/luna-1.webp' }[nextSelection] || prev.lunaPhoto));
      }
      if (!finalLunaPhoto) finalLunaPhoto = prev.lunaPhoto;

      const nextLunaName = updates.luna_name || updates.lunaName || prev.lunaName;

      const newState = {
        ...prev,
        ...updates,
        lunaName: nextLunaName,
        lunaPhoto: finalLunaPhoto,
        lunaSelection: nextSelection,
        customType: nextType,
        history: nextHistory,
        photos: nextPhotos,
        chatHistories: nextChatHistories,
        photoHistories: nextPhotoHistories,
        lunaPhotos: nextLunaPhotos,
        bgmVolume: updates.bgmVolume !== undefined ? updates.bgmVolume : (updates.bgm_volume !== undefined ? updates.bgm_volume : prev.bgmVolume)
      };
      
      nextFullState = newState;
      return newState;
    });

    // 2. 비동기 저장 및 동기화 (디바운스 처리로 서버 부하 및 레이스 컨디션 방지)
    lastUpdatesRef.current = { ...lastUpdatesRef.current, ...updates };
    
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      // @ts-ignore
      const finalState = nextFullState as TravelState;
      if (!finalState) return;

      const currentUpdates = { ...lastUpdatesRef.current };
      lastUpdatesRef.current = {}; // 큐 비우기

      localStorage.setItem('luna_travel_state', JSON.stringify(finalState));
      localStorage.setItem('bgm_volume', finalState.bgmVolume.toString());
      localStorage.setItem('luna_selection', finalState.lunaSelection);
      localStorage.setItem('custom_type', finalState.customType);

      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...currentUpdates,
            chat_histories: finalState.chatHistories,
            photo_histories: finalState.photoHistories,
            luna_photos: finalState.lunaPhotos,
            history: finalState.history,
            photos: finalState.photos,
            luna_selection: finalState.lunaSelection,
            custom_type: finalState.customType,
            bgm_volume: finalState.bgmVolume,
            luna_photo: finalState.lunaPhoto,
            luna_name: finalState.lunaName
          })
        });
      } catch (err) {
        console.error("Server sync failed:", err);
      }
    }, 500); // 500ms 디바운스 적용
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
      sendLiveVideo: (base64: string) => liveService?.sendVideo(base64),
      toggleBgm: () => setState(prev => ({ ...prev, isBgmPlaying: !prev.isBgmPlaying })),
      setBgmVolume: (volume: number) => setState(prev => ({ ...prev, bgmVolume: volume })),
      nextBgm: () => setState(prev => ({
        ...prev,
        currentBgmIndex: (prev.currentBgmIndex + 1) % prev.bgmPlaylist.length
      })),
      prevBgm: () => setState(prev => ({
        ...prev,
        currentBgmIndex: (prev.currentBgmIndex - 1 + prev.bgmPlaylist.length) % prev.bgmPlaylist.length
      })),
      selectBgm: (index: number) => setState(prev => ({ ...prev, currentBgmIndex: index, isBgmPlaying: true })),
      setBgmMode: (mode: 'loop' | 'playlist') => setState(prev => ({ ...prev, bgmMode: mode })),
      showModal,
      hideModal,
      modal,
      updateSettings
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
