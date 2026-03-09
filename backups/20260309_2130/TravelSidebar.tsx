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
  const { state, sendMessage, stopAudio, isLiveMode, startLiveMode, stopLiveMode, resetSession, moveTo, deletePhoto, addBookmark, removeBookmark } = useTravel();
  const [activeTab, setActiveTab] = useState<'chat' | 'album' | 'bookmarks'>('chat');
  const [input, setInput] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const renderText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[\[PLACE:.*?\]\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[\[PLACE:(.*?)\]\]/);
      if (match) {
        const placeName = match[1].trim();
        return (
          <button
            key={i}
            onClick={() => {
              // 장소 정보가 있는 경우 이동 로직 실행 (컨텍스트에서 장소 찾기 시도)
              const place = state.nearbyPlaces.find(p => p.name.includes(placeName)) ||
                state.bookmarks.find(b => b.name.includes(placeName));
              if (place) {
                moveTo(place.location, placeName, true);
              } else {
                // 장소를 못 찾으면 그냥 메시지 전송 (이동 요청)
                sendMessage(`${placeName} 위치로 이동해줘`);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 my-1 bg-pink-50 text-pink-600 rounded-lg font-black text-xs hover:bg-pink-100 transition-colors border border-pink-200 shadow-sm mx-1 active:scale-95"
          >
            <MapPin className="w-3 h-3" />
            {placeName}
          </button>
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
            className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-lg active:scale-90 z-20 ${isLiveMode ? 'bg-emerald-500 text-white animate-bounce' : 'bg-pink-600 text-white hover:bg-pink-500'}`}
          >
            {isLiveMode ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
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
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">저장된 위치</h3>
                <div className="px-2 py-0.5 bg-pink-50 text-pink-500 text-[10px] font-black rounded-full border border-pink-100">
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
