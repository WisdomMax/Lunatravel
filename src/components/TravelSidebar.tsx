/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTravel } from '../context/TravelContext';
import { MessageSquare, Send, MapPin, Loader2, VolumeX, Heart, Sparkles, Mic, MicOff, Phone, PhoneOff, Camera, Navigation, Utensils, RotateCcw, ChevronRight, ArrowLeft, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TravelSidebarProps {
  onBack?: () => void;
}

export default function TravelSidebar({ onBack }: TravelSidebarProps) {
  const { state, sendMessage, stopAudio, isLiveMode, startLiveMode, stopLiveMode, resetSession, moveTo, deletePhoto, addBookmark, removeBookmark, sendLiveVideo } = useTravel();
  const [activeTab, setActiveTab] = useState<'chat' | 'album' | 'bookmarks'>('chat');
  const [input, setInput] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const renderText = (text: string) => {
    if (!text) return null;

    // 1. [[PLACE:...]] 우선 처리
    // 2. Markdown 링크 처리 [text](url)
    // 3. 일반 URL 처리
    const combinedRegex = /(\[\[PLACE:.*?\]\]|\[.*?\]\(https?:\/\/.*?\)|https?:\/\/[^\s$.?#].[^\s]*)/g;
    const parts = text.split(combinedRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      // 1. PLACE 태그 확인
      const placeMatch = part.match(/\[\[PLACE:(.*?)\]\]/);
      if (placeMatch) {
        const placeName = placeMatch[1].trim();
        return (
          <button
            key={i}
            onClick={() => {
              // 1. 이름 정규화 및 다단계 검색어 준비
              const fullName = placeName.trim();
              const mdMatch = fullName.match(/(.*?)\((.*?)\)/);
              const koreanPart = mdMatch ? mdMatch[1].trim() : fullName;
              const englishPart = mdMatch ? mdMatch[2].trim() : '';

              // 검색 우선순위: 영어 명칭 -> 전체 명칭 -> 한국어 명칭
              const searchTerms = [englishPart, fullName, koreanPart].filter(t => t.length > 1);

              // 주변 장소/북마크에서 먼저 찾기 (캐시된 데이터)
              const cleanName = koreanPart;
              const place = state.nearbyPlaces.find(p => p.name.includes(cleanName) || cleanName.includes(p.name)) ||
                state.bookmarks.find(b => b.name.includes(cleanName) || cleanName.includes(b.name));

              if (place) {
                moveTo(place.location, place.name, false);
                return;
              }

              // 2. Geocoder 다단계 재귀 검색 함수
              if (typeof google === 'undefined' || !google.maps?.Geocoder) return;
              const geocoder = new google.maps.Geocoder();

              const attemptSearch = (index: number) => {
                if (index >= searchTerms.length) return;

                const term = searchTerms[index];
                geocoder.geocode({
                  address: term,
                  location: state.currentLocation
                }, (results, status) => {
                  if (status === 'OK' && results?.[0]) {
                    const loc = results[0].geometry.location;
                    moveTo({ lat: loc.lat(), lng: loc.lng(), name: term }, term, false);
                  } else if (index === searchTerms.length - 1) {
                    // 모든 지오코딩 실패 시 Places Service (상호명 검색) 시도
                    if (google.maps.places?.PlacesService) {
                      const service = new google.maps.places.PlacesService(document.createElement('div'));
                      service.textSearch({
                        query: fullName,
                        location: state.currentLocation,
                        radius: 50000 // 현재 위치 주변 50km 우선
                      }, (resultsP, statusP) => {
                        if (statusP === 'OK' && resultsP?.[0] && resultsP[0].geometry?.location) {
                          const pLoc = resultsP[0].geometry.location;
                          moveTo({ lat: pLoc.lat(), lng: pLoc.lng(), name: resultsP[0].name || fullName }, resultsP[0].name || fullName, false);
                        }
                      });
                    }
                  } else {
                    // 실패 시 다음 키워드로 재시도
                    attemptSearch(index + 1);
                  }
                });
              };

              attemptSearch(0);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 my-1 bg-pink-50 text-pink-600 rounded-lg font-black text-xs hover:bg-pink-100 transition-colors border border-pink-200 shadow-sm mx-1 active:scale-95"
          >
            <MapPin className="w-3 h-3" />
            {placeName}
          </button>
        );
      }

      // 2. Markdown 링크 확인 [text](url)
      const mdMatch = part.match(/\[(.*?)\]\((https?:\/\/.*?)\)/);
      if (mdMatch) {
        const linkText = mdMatch[1].trim() || '정보 링크 🔗';
        const linkUrl = mdMatch[2].trim();
        return (
          <a
            key={i}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 my-1 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm mx-1 break-all underline decoration-blue-300 active:scale-95"
          >
            {linkText.includes('http') ? '정보 링크 🔗' : linkText}
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
            블로그/정보 링크 🔗
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
      }, 1000);

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      sendMessage("화면 공유를 시작했어! 이제 내가 보고 있는 화면을 같이 보며 얘기하자.");
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
      {/* Header - Profile Card (Compact for Sidebar) */}
      <div className={`relative px-4 pt-10 pb-4 border-b border-slate-100 flex flex-col items-center gap-4 transition-colors duration-500 overflow-hidden ${isLiveMode ? 'bg-emerald-50/50' : 'bg-white'}`}>
        <div className={`absolute top-0 inset-x-0 h-24 opacity-10 pointer-events-none ${isLiveMode ? 'bg-emerald-600' : 'bg-pink-600'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 0 100%)' }} />

        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 w-[calc(100%-2rem)]">
          {onBack && (
            <button onClick={onBack} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-all active:scale-90">
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
              <img src={lunaPhoto} alt={lunaName} className="w-full h-full object-cover image-rendering-pixelated" />
            ) : (
              <div className="w-full h-full bg-pink-50 flex items-center justify-center">
                <Heart className="w-8 h-8 text-pink-200 fill-pink-200" />
              </div>
            )}
            {isLiveMode && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded-full animate-pulse">
                <div className="w-1 h-1 bg-white rounded-full" />
                LIVE
              </div>
            )}
          </div>
          <button
            onClick={isLiveMode ? stopLiveMode : startLiveMode}
            className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-lg active:scale-90 z-20 transition-all ${isLiveMode ? 'bg-emerald-500 text-white animate-bounce' : 'bg-pink-600 text-white hover:bg-pink-500'}`}
            title={isLiveMode ? "통화 종료" : "루나와 라이브 통화"}
          >
            {isLiveMode ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          </button>

          {/* 화면 공유 버튼: 라이브 모드일 때만 동작하지만 버튼은 균형을 위해 항상 표시 */}
          <button
            onClick={() => {
              if (!isLiveMode) {
                alert("루나와 먼저 라이브 통화를 시작해 주세요! 통화가 연결되면 화면을 같이 볼 수 있어요. 😊");
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
            title={isScreenSharing ? "화면 공유 중지" : "루나와 화면 공유하며 여행하기"}
          >
            <Camera className={`w-4 h-4 ${isLiveMode && !isScreenSharing ? 'animate-bounce' : ''}`} />
          </button>
        </div>

        <div className="text-center z-10">
          <h1 className={`text-xl font-black font-mulmaru ${isLiveMode ? 'text-emerald-600' : 'text-pink-600'}`}>
            {lunaName}
          </h1>
          <div className="flex items-center justify-center gap-1 mt-1 px-3 py-1 bg-slate-50 rounded-full border border-slate-100/50">
            <MapPin className="w-2.5 h-2.5 text-slate-400" />
            <span className="text-[10px] text-slate-500 font-bold truncate max-w-[150px]">
              {state.currentLocation.name || '방랑 중...'}
            </span>
          </div>
        </div>
      </div>

      {/* Modern Tabs Bar */}
      <div className="flex border-b border-slate-100 bg-slate-50/30 p-1 gap-1">
        {[
          { id: 'chat', label: '채팅', icon: MessageSquare },
          { id: 'album', label: '앨범', icon: Camera },
          { id: 'bookmarks', label: '저장소', icon: Heart }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all gap-0.5 ${activeTab === tab.id
              ? 'bg-white text-pink-600 shadow-sm border border-slate-100'
              : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
            <span className="text-[10px] font-black">{tab.label}</span>
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
                state.history.map((msg) => (
                  <motion.div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] p-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                      ? 'bg-pink-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                      {renderText(msg.text)}
                      <p className={`text-[9px] mt-2 font-bold opacity-50 ${msg.role === 'user' ? 'text-white' : 'text-slate-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
              {state.isThinking && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold px-1">
                  <div className="flex gap-1">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-pink-300" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  </div>
                  루나가 생각 중...
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
                    <span className="text-[11px] font-black text-pink-600">사진 찍는 중...</span>
                  </div>
                )}
                {state.photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border border-white hover:shadow-pink-100 transition-all">
                    <img
                      src={photo.url}
                      className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500"
                      onClick={() => setSelectedPhoto(photo)}
                    />
                    <button
                      onClick={() => {
                        if (confirm('이 사진을 앨범에서 삭제할까요?')) deletePhoto(photo.id);
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
                  <p className="text-sm font-black">아직 간직한 추억이 없어요.</p>
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
                    <h3 className="text-[11px] font-black text-pink-500 uppercase tracking-[0.2em]">루나의 추천 (Pick)</h3>
                    <div className="px-2 py-0.5 bg-pink-50 text-pink-500 text-[10px] font-black rounded-full border border-pink-100">
                      {state.nearbyPlaces.length}곳
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {state.nearbyPlaces.map((place) => (
                      <div key={place.id} className="p-3 rounded-xl bg-pink-50/30 border border-pink-100/50 hover:bg-pink-50 transition-all group flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-4 cursor-pointer" onClick={() => moveTo(place.location, place.name, false)}>
                          <h4 className="text-xs font-black text-slate-800 truncate group-hover:text-pink-600">{place.name}</h4>
                        </div>
                        <button
                          onClick={() => addBookmark(place.location)}
                          className="p-1.5 text-pink-400 hover:text-pink-600 transition-colors"
                          title="정식 북마크에 추가"
                        >
                          <Heart className="w-3.5 h-3.5" />
                        </button>
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

      {state.isSpeaking && (
        <div className="px-4 py-2 bg-pink-50/50 border-t border-b border-pink-100 flex justify-end">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={stopAudio}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500 text-white font-black text-[10px] shadow-lg shadow-red-500/40 hover:bg-red-600 active:scale-95 transition-all"
          >
            <VolumeX className="w-3.5 h-3.5" />
            루나 말 끊기
          </motion.button>
        </div>
      )}

      {/* Input Area (Only visible in Chat Tab) */}
      {activeTab === 'chat' && (
        <div className="p-4 border-t border-slate-100 bg-white">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "듣고 있어요..." : "루나에게 메시지 보내기..."}
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
                  src={selectedPhoto.url}
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
