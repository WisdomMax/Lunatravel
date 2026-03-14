/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTravel } from '../context/TravelContext';
import { MessageSquare, Send, MapPin, Loader2, VolumeX, Heart, Sparkles, Mic, MicOff, Phone, PhoneOff, Camera, MonitorUp, Navigation, Utensils, RotateCcw, ChevronRight, ArrowLeft, Trash2, X, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BgmControl from './BgmControl';

interface TravelSidebarProps {
  onBack?: () => void;
}

export default function TravelSidebar({ onBack }: TravelSidebarProps) {
  const { state, sendMessage, stopAudio, isLiveMode, startLiveMode, stopLiveMode, resetSession, moveTo, deletePhoto, addBookmark, removeBookmark, sendLiveVideo, showModal } = useTravel();
  const [activeTab, setActiveTab] = useState<'chat' | 'album' | 'bookmarks'>('chat');
  const [input, setInput] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 공통 장소 이동 로직
  const handleMovePlace = (placeName: string) => {
    const fullName = placeName.trim();
    const mdMatch = fullName.match(/(.*?)\((.*?)\)/);
    const koreanPart = mdMatch ? mdMatch[1].trim() : fullName;
    const englishPart = mdMatch ? mdMatch[2].trim() : '';

    const searchTerms = [englishPart, fullName, koreanPart].filter(t => t.length > 1);
    const cleanName = koreanPart;
    const place = state.nearbyPlaces.find(p => p.name.includes(cleanName) || cleanName.includes(p.name)) ||
                  state.bookmarks.find(b => b.name.includes(cleanName) || cleanName.includes(b.name));

    if (place) {
      moveTo(place.location, place.name, false);
      return;
    }

    if (typeof google === 'undefined' || !google.maps?.Geocoder) return;
    const geocoder = new google.maps.Geocoder();

    const attemptSearch = (index: number) => {
      if (index >= searchTerms.length) {
        if (typeof google !== 'undefined' && google.maps.places?.PlacesService) {
          const service = new google.maps.places.PlacesService(document.createElement('div'));
          service.textSearch({
            query: fullName,
            location: state.currentLocation,
            radius: 50000 
          }, (resultsP, statusP) => {
            if (statusP === 'OK' && resultsP?.[0] && resultsP[0].geometry?.location) {
              const pLoc = resultsP[0].geometry.location;
              moveTo({ lat: pLoc.lat(), lng: pLoc.lng() }, resultsP[0].name || fullName, false);
            }
          });
        }
        return;
      }

      const term = searchTerms[index];
      geocoder.geocode({
        address: term,
        location: state.currentLocation,
        language: 'ko',
        region: 'KR'
      }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const sortedResults = results.sort((a, b) => {
            if (!a.geometry?.location || !b.geometry?.location) return 0;
            const distA = Math.pow(a.geometry.location.lat() - state.currentLocation.lat, 2) + Math.pow(a.geometry.location.lng() - state.currentLocation.lng, 2);
            const distB = Math.pow(b.geometry.location.lat() - state.currentLocation.lat, 2) + Math.pow(b.geometry.location.lng() - state.currentLocation.lng, 2);
            return distA - distB;
          });
          const loc = sortedResults[0].geometry.location;
          moveTo({ lat: loc.lat(), lng: loc.lng() }, term, false);
        } else {
          attemptSearch(index + 1);
        }
      });
    };
    attemptSearch(0);
  };

  const renderText = (text: string, hidePlaceTags: boolean = false) => {
    if (!text) return null;

    const combinedRegex = /(\[\[PLACE:\s*.*?\s*\]\]|\[.*?\]\(https?:\/\/.*?\)|https?:\/\/[^\s$.?#].[^\s]*)/g;
    const parts = text.split(combinedRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      const placeMatch = part.match(/\[\[PLACE:\s*(.*?)\s*\]\]/);
      if (placeMatch) {
        if (hidePlaceTags) return null; // 카드 UI가 있으면 텍스트 내 태그는 숨김 처리
        const placeName = placeMatch[1].trim();
        return (
          <button
            key={i}
            onClick={() => handleMovePlace(placeName)}
            className="inline-flex items-center gap-1.5 px-2 py-1 my-1 bg-pink-50 text-pink-600 rounded-lg font-black text-[11px] hover:bg-pink-100 transition-colors border border-pink-200 shadow-sm mx-1 active:scale-95"
          >
            <MapPin className="w-3 h-3" />
            {placeName}
          </button>
        );
      }

      // 2. Markdown 링크 확인 [text](url)
      const mdMatch = part.match(/\[(.*?)\]\((https?:\/\/.*?)\)/);
      if (mdMatch) {
        const linkText = mdMatch[1].trim() || 'Info Link 🔗';
        const linkUrl = mdMatch[2].trim();
        return (
          <a
            key={i}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 my-1 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm mx-1 break-all underline decoration-blue-300 active:scale-95"
          >
            {linkText.includes('http') ? 'Info Link 🔗' : linkText}
          </a>
        );
      }

      // 3. 일반 URL 확인
      if (part.match(/https?:\/\/[^\s$.?#].[^\s]*/)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 my-1 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm mx-1 break-all underline decoration-blue-300 active:scale-95"
          >
            Info Link 🔗
          </a>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [state.history, state.isThinking, activeTab]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).WebkitSpeechRecognition || (window as any).speechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = navigator.language || 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        sendMessage(transcript);
        setInput('');
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [sendMessage]);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<any>(null);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      captureIntervalRef.current = setInterval(() => {
        if (!ctx || !isLiveMode) return;

        const scale = Math.min(768 / video.videoWidth, 768 / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

        if (sendLiveVideo) {
          sendLiveVideo(base64);
        }
      }, 500); // 1000ms -> 500ms로 단축 (해커톤 최적화)

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      sendMessage("I've started screen sharing! Now I can see what you're seeing, so let's talk and explore together! 😊");
    } catch (err) {
      console.error('Screen share error:', err);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  };

  useEffect(() => {
    if (!isLiveMode && isScreenSharing) {
      stopScreenShare();
    }
  }, [isLiveMode, isScreenSharing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || state.isThinking) return;
    sendMessage(input);
    setInput('');
  };

  const lunaPhoto = state.lunaPhoto || localStorage.getItem('luna_photo');
  const lunaName = state.lunaName || 'Luna';

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Header - Profile Card (Premium Magazine Style) */}
      <div className={`relative px-6 pt-12 pb-6 border-b border-slate-100 flex flex-col items-center gap-5 transition-all duration-700 ${isLiveMode ? 'bg-emerald-50/40 backdrop-blur-md' : 'bg-white/80 backdrop-blur-xl'}`}>
        <div className={`absolute top-0 inset-x-0 h-32 opacity-10 pointer-events-none ${isLiveMode ? 'bg-emerald-600' : 'bg-pink-600'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)' }} />

        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 w-[calc(100%-2rem)]">
          {onBack && (
            <button 
              onClick={() => {
                if (isLiveMode) stopLiveMode();
                onBack();
              }} 
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-all active:scale-90"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={resetSession} className="p-1.5 rounded-xl bg-white/80 border border-slate-100 text-slate-400 hover:text-pink-500 transition-all shadow-sm active:scale-90 ml-auto">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Character Image Version 2 */}
        <div className="w-[45%] aspect-[3/4] relative z-10 group">
          <div className={`absolute inset-0 rounded-xl overflow-hidden shadow-lg border-2 border-white transition-transform duration-500 group-hover:scale-105 ${isLiveMode ? 'shadow-emerald-100 border-emerald-100' : 'shadow-pink-100 border-pink-100'}`}>
            {lunaPhoto ? (
              <img 
                src={lunaPhoto} 
                alt={lunaName} 
                className="w-full h-full object-cover image-rendering-pixelated"
                onError={(e) => {
                  console.error("Profile image load failed:", lunaPhoto);
                  // 이미지 로드 실패 시 투명 처리하거나 기본 아이콘으로 대체되도록 처리
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = "w-full h-full bg-slate-50 flex items-center justify-center";
                    fallback.innerHTML = '<svg class="w-8 h-8 text-slate-200 fill-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                <Heart className="w-8 h-8 text-slate-200 fill-slate-100" />
              </div>
            )}
            {isLiveMode && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded-full animate-pulse">
                <div className="w-1 h-1 bg-white rounded-full" />
                LIVE
              </div>
            )}
          </div>
          {state.isSpeaking && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: 20 }}
              onClick={stopAudio}
              className="absolute -bottom-2 right-10 w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg active:scale-90 z-20 transition-all border-2 border-white hover:bg-red-600"
              title="Mute Luna"
            >
              <VolumeX className="w-4 h-4" />
            </motion.button>
          )}

          <button
            onClick={isLiveMode ? stopLiveMode : startLiveMode}
            className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-lg active:scale-90 z-20 transition-all ${isLiveMode ? 'bg-emerald-500 text-white animate-bounce' : 'bg-pink-600 text-white hover:bg-pink-500'}`}
            title={isLiveMode ? "End Call" : "Live Call with Luna"}
          >
            {isLiveMode ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          </button>

          {/* 화면 공유 버튼: 라이브 모드일 때만 동작하지만 버튼은 균형을 위해 항상 표시 */}
          <button
            onClick={() => {
              if (!isLiveMode) {
                showModal({
                  title: "Connection Required",
                  message: "Please start a live call with Luna first! Once connected, you can share your screen. 😊",
                  type: "alert"
                });
                startLiveMode(); // 사용자 편의를 위해 통화도 같이 시작 시도
                return;
              }
              isScreenSharing ? stopScreenShare() : startScreenShare();
            }}
            className={`absolute -bottom-2 -left-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-lg active:scale-90 z-20 transition-all ${isScreenSharing
              ? 'bg-amber-500 text-white animate-pulse'
              : isLiveMode
                ? 'bg-white text-amber-500 hover:bg-amber-50 shadow-amber-100'
                : 'bg-white text-slate-300 hover:text-amber-400'
              }`}
            title={isScreenSharing ? "Stop Sharing" : "Travel with Luna via Screen Sharing"}
          >
            <MonitorUp className={`w-4 h-4 ${isLiveMode && !isScreenSharing ? 'animate-bounce' : ''}`} />
          </button>
        </div>

        <div className="text-center z-10 space-y-1">
          <h1 className={`text-2xl font-display font-black tracking-tight ${isLiveMode ? 'text-emerald-700' : 'text-pink-700'}`}>
            {lunaName}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-1 px-4 py-1.5 bg-white/50 backdrop-blur-sm rounded-full border border-slate-200/50 shadow-sm">
            <MapPin className="w-3 h-3 text-pink-400" />
            <span className="text-[11px] text-slate-600 font-bold tracking-tight truncate max-w-[180px]">
              {state.currentLocation.name || 'Wandering...'}
            </span>
          </div>
        </div>

        {/* BGM 제어기 - 사이드바 프로필 하단으로 이동 */}
        <div className="z-10 w-full flex justify-center mt-2 px-2">
           <BgmControl variant="map" />
        </div>

      </div>

      {/* Modern Tabs Bar (Magazine Layout) */}
      <div className="flex border-b border-slate-100 bg-white/50 backdrop-blur-md p-1.5 gap-1 shadow-sm relative z-10">
        {[
          { id: 'chat', label: 'JOURNAL', icon: MessageSquare },
          { id: 'album', label: 'MEMORIES', icon: Camera },
          { id: 'bookmarks', label: 'DESTINATIONS', icon: Heart }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all gap-1 ${activeTab === tab.id
              ? 'bg-white text-pink-600 shadow-md shadow-pink-100/50 border border-pink-100/50 scale-[1.02]'
              : 'text-slate-400 hover:text-slate-600 hover:bg-white/80'}`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/20">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {state.history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-50">
                  <Sparkles className="w-10 h-10 text-pink-300" />
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">
                    루나와 함께 어디로 떠나볼까요?<br />궁금한 장소를 물어보세요!
                  </p>
                </div>
              ) : (
                state.history.map((msg) => {
                  const placeTags = msg.text.match(/\[\[PLACE:\s*(.*?)\s*\]\]/g) || [];
                  const isLargeList = placeTags.length >= 2; // 2개 이상이면 카드 뷰로 시원하게 보여줌

                  return (
                    <motion.div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} ${isLargeList ? 'w-full' : ''}`}>
                      <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm text-sm leading-extrarelaxed ${msg.role === 'user'
                        ? 'bg-gradient-to-br from-pink-600 to-pink-500 text-white rounded-tr-none shadow-pink-200'
                        : 'bg-white border border-slate-100/80 text-slate-800 rounded-tl-none shadow-slate-100 shadow-sm'}`}>
                        <div className={msg.role === 'model' ? 'font-gothic text-[15px]' : 'font-gothic'}>
                          {renderText(msg.text, isLargeList && msg.role === 'model')}
                        </div>
                        <p className={`text-[9px] mt-2 font-bold tracking-tighter opacity-40 ${msg.role === 'user' ? 'text-white' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* 대량 장소 추천 리스트 (카드 뷰) */}
                      {isLargeList && msg.role === 'model' && (
                        <div className="w-full mt-3 flex gap-3 overflow-x-auto pb-3 px-1 no-scrollbar scroll-smooth">
                          {placeTags.map((tag, idx) => {
                            const name = tag.match(/\[\[PLACE:\s*(.*?)\s*\]\]/)?.[1] || "";
                            const isRestaurant = name.toLowerCase().match(/식당|맛|카페|cafe|coffee|구이|스시|레스토랑|음식/);
                            
                            return (
                              <motion.div
                                key={`${msg.id}-card-${idx}`}
                                whileHover={{ y: -5, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex-shrink-0 w-44 bg-white/95 backdrop-blur-md border border-pink-100 rounded-2xl p-4 shadow-md hover:shadow-xl hover:border-pink-300 transition-all group relative overflow-hidden"
                              >
                                {/* 배경 장식 요소 (미니멀) */}
                                <div className="absolute -top-4 -right-4 w-12 h-12 bg-pink-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700" />
                                
                                <div className="flex flex-col h-full justify-between gap-3">
                                  <div className="flex items-start gap-2.5">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                                      isRestaurant ? 'bg-amber-50 text-amber-500' : 'bg-pink-50 text-pink-500'
                                    }`}>
                                      {isRestaurant ? <Utensils className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[9px] font-black text-pink-400 uppercase tracking-widest leading-none mb-1">{state.lunaName}'s Pick</p>
                                      <h4 className="text-[13px] font-black text-slate-800 line-clamp-2 group-hover:text-pink-600 transition-colors leading-tight">
                                        {name}
                                      </h4>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleMovePlace(name)}
                                    className="w-full py-2 bg-slate-50 text-slate-600 hover:bg-pink-600 hover:text-white rounded-xl text-[10px] font-black transition-all border border-slate-100 flex items-center justify-center gap-1.5 shadow-inner"
                                  >
                                    <Navigation className="w-3 h-3" /> 방문하기
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
              {state.isThinking && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold px-1">
                  <div className="flex gap-1">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-pink-300" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  </div>
                  {state.lunaName} is thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </motion.div>
          )}

          {activeTab === 'album' && (
            <motion.div
              key="album"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 overflow-y-auto p-4"
            >
              <div className="grid grid-cols-2 gap-4">
                {state.isGeneratingPhoto && (
                  <div className="aspect-[3/4] rounded-2xl bg-white border-2 border-dashed border-pink-200 flex flex-col items-center justify-center p-4 text-center shadow-sm">
                    <Loader2 className="w-6 h-6 text-pink-500 animate-spin mb-2" />
                    <span className="text-[11px] font-black text-pink-600">Capturing...</span>
                  </div>
                )}
                {state.photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border border-white hover:shadow-pink-100 transition-all">
                    <img
                      src={photo.url.includes('?') ? photo.url : `${photo.url}?t=${photo.timestamp}`}
                      className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                      onClick={() => setSelectedPhoto(photo)}
                      onError={(e) => {
                        // 이미지 로드 실패 시 재시도 로직 (파일 저장 지연 대응)
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('&retry=')) {
                          setTimeout(() => {
                            target.src = `${photo.url}?t=${Date.now()}&retry=1`;
                          }, 1000);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        showModal({
                          title: "Delete Memory",
                          message: "Would you like to delete this memory from your album?",
                          type: "confirm",
                          onConfirm: () => deletePhoto(photo.id)
                        });
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-lg hover:bg-red-600 active:scale-90"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <p className="text-[10px] text-white font-black truncate">{photo.locationName}</p>
                      <p className="text-[8px] text-white/60 font-medium">{new Date(photo.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              {state.photos.length === 0 && !state.isGeneratingPhoto && (
                <div className="h-60 flex flex-col items-center justify-center text-slate-300 gap-3">
                  <div className="p-5 bg-slate-50 rounded-full border border-slate-100">
                    <Camera className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-black">No memories captured yet.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'bookmarks' && (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {state.nearbyPlaces.length > 0 && (
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                      <h3 className="text-[11px] font-black text-pink-500 uppercase tracking-[0.2em]">Luna's Recommend</h3>
                    </div>
                    <div className="px-2 py-0.5 bg-pink-50 text-pink-500 text-[10px] font-black rounded-full border border-pink-100">
                      {state.nearbyPlaces.length}곳
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {state.nearbyPlaces.map((place) => (
                      <div key={place.id} className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-50/50 to-white border border-pink-100/50 hover:bg-pink-50 transition-all group flex items-center justify-between shadow-sm hover:shadow-md">
                        <div className="flex-1 min-w-0 pr-4 cursor-pointer" onClick={() => moveTo(place.location, place.name, false)}>
                          <h4 className="text-xs font-black text-slate-800 truncate group-hover:text-pink-600 transition-colors uppercase tracking-tight">{place.name}</h4>
                          <p className="text-[9px] text-pink-400 font-bold mt-0.5 opacity-60">추천된 명소</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => addBookmark(place.location)}
                            className="p-2 text-pink-300 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all"
                            title="Add to bookmarks"
                          >
                            <Heart className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveTo(place.location, place.name, false)}
                            className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">저장된 위치</h3>
                <div className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full border border-slate-200">
                  {state.bookmarks.length}곳
                </div>
              </div>

              {state.bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-pink-100 transition-all group relative overflow-hidden">
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1 min-w-0 pr-4" onClick={() => moveTo(bookmark.location, bookmark.name)}>
                      <h4 className="text-sm font-black text-slate-800 truncate cursor-pointer group-hover:text-pink-600 transition-colors uppercase tracking-tight">{bookmark.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3 h-3 text-pink-300" />
                        {bookmark.location.lat.toFixed(4)}, {bookmark.location.lng.toFixed(4)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeBookmark(bookmark.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => moveTo(bookmark.location, bookmark.name)}
                    className="w-full mt-4 py-2.5 rounded-xl bg-pink-50 text-pink-600 text-[11px] font-black flex items-center justify-center gap-2 hover:bg-pink-600 hover:text-white transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Navigation className="w-3.5 h-3.5" /> 이 장소로 텔레포트
                  </button>
                </div>
              ))}

              {state.bookmarks.length === 0 && (
                <div className="h-60 flex flex-col items-center justify-center text-slate-300 gap-3">
                  <div className="p-5 bg-slate-50 rounded-full border border-slate-100">
                    <Heart className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-black">마음에 드는 장소를 저장해두세요!</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {/* Input Area (Only visible in Chat Tab) */}
      {activeTab === 'chat' && (
        <div className="p-4 border-t border-slate-100 bg-white">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : `Message to ${state.lunaName}...`}
              disabled={state.isThinking || isListening}
              className="w-full pl-4 pr-24 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all text-sm font-medium"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={isLiveMode ? stopLiveMode : startLiveMode}
                disabled={state.isThinking}
                className={`p-2.5 rounded-xl transition-all ${isLiveMode
                  ? 'bg-emerald-500 text-white animate-pulse shadow-lg shadow-emerald-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {isLiveMode ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || state.isThinking || isLiveMode}
                className="p-2.5 bg-pink-600 text-white rounded-xl hover:bg-pink-700 disabled:opacity-40 disabled:grayscale transition-all shadow-lg shadow-pink-600/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-8 backdrop-blur-sm"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-4"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors bg-white/10 rounded-full backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                <img
                  src={selectedPhoto.url.includes('?') ? selectedPhoto.url : `${selectedPhoto.url}?t=${selectedPhoto.timestamp}`}
                  alt={selectedPhoto.locationName}
                  className="w-full h-auto max-h-[80vh] object-contain mx-auto"
                />
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-10">
                  <h3 className="text-xl font-black text-white">{selectedPhoto.locationName}</h3>
                  <p className="text-sm text-white/60 font-medium">{new Date(selectedPhoto.timestamp).toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
