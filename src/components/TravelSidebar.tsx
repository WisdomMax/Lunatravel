/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTravel } from '../context/TravelContext';
import { MessageSquare, Send, MapPin, Loader2, Volume2, VolumeX, Heart, Sparkles, Mic, MicOff, Phone, PhoneOff, Camera, Navigation, Utensils, RotateCcw, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TravelSidebar() {
  const { state, sendMessage, stopAudio, isLiveMode, startLiveMode, stopLiveMode, resetSession, moveTo } = useTravel();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.history, state.isThinking]);

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

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || state.isThinking) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Header */}
      <div className={`p-6 border-b border-slate-100 flex items-center justify-between transition-colors duration-500 ${isLiveMode ? 'bg-emerald-50/50' : 'bg-white'}`}>
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight flex items-center gap-2 font-display transition-colors ${isLiveMode ? 'text-emerald-600' : 'text-pink-600'}`}>
            <Heart className={`w-6 h-6 transition-colors ${isLiveMode ? 'fill-emerald-600' : 'fill-pink-600'}`} />
            Luna
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 align-middle">v2.5</span>
          </h1>
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-slate-400" />
            <p className="text-[10px] text-slate-500 font-bold truncate max-w-[200px]">
              {state.currentLocation.name || `${state.currentLocation.lat.toFixed(2)}, ${state.currentLocation.lng.toFixed(2)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetSession}
            className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-all"
            title="새 여행 시작 (경복궁으로 이동)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={isLiveMode ? stopLiveMode : startLiveMode}
            className={`p-2 rounded-full transition-all shadow-sm ${isLiveMode
              ? 'bg-emerald-500 text-white animate-pulse shadow-emerald-200'
              : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
              }`}
            title={isLiveMode ? "Stop Voice Talk" : "Start Voice Talk"}
          >
            {isLiveMode ? <PhoneOff className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          </button>
          {state.isSpeaking && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={stopAudio}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-500/40 hover:bg-red-600 active:scale-95 transition-all animate-pulse"
              title="탭하면 바로 말 끊기!"
            >
              <VolumeX className="w-4 h-4" />
              탭! 말 끊기
            </motion.button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {state.history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-pink-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Hi, I'm Luna!</h3>
              <p className="text-sm text-slate-500 mt-1">
                Where should we go today? I can tell you about any place in the world, find great food, or just chat while we explore.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {state.history.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user'
                  ? 'bg-pink-600 text-white rounded-tr-none'
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                  }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.text.split(/(\[\[PLACE:.*?\]\]|\[.*?\]\(.*?\))/).map((part, i) => {
                    const placeMatch = part.match(/^\[\[PLACE:\s*(.+?)\]\]$/);
                    if (placeMatch) {
                      const placeName = placeMatch[1];
                      // Find coordinates if they exist in nearbyPlaces, otherwise just use name for geocoding later
                      const foundPlace = state.nearbyPlaces.find(p => p.name === placeName);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (foundPlace) {
                              moveTo(foundPlace.location, foundPlace.name);
                            } else {
                              // If not in state yet, geocode by name
                              if (typeof google !== 'undefined' && google.maps?.Geocoder) {
                                const geocoder = new google.maps.Geocoder();
                                geocoder.geocode({ address: placeName, location: state.currentLocation }, (results, status) => {
                                  if (status === 'OK' && results?.[0]) {
                                    const loc = results[0].geometry.location;
                                    moveTo({ lat: loc.lat(), lng: loc.lng() } as any, placeName);
                                  }
                                });
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-1 rounded-lg bg-pink-100 text-pink-700 font-bold hover:bg-pink-200 transition-colors shadow-sm cursor-pointer border border-pink-200 align-middle transform active:scale-95"
                        >
                          <MapPin className="w-3 h-3" />
                          {placeName} 🏰
                        </button>
                      );
                    }

                    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                    if (linkMatch) {
                      const title = linkMatch[1];
                      const url = linkMatch[2];
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 mx-1 mt-1 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm cursor-pointer border border-slate-200 hover:border-emerald-300 align-middle transform active:scale-95 text-xs group decoration-transparent"
                        >
                          <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <Navigation className="w-3 h-3" />
                          </span>
                          {title}
                        </a>
                      );
                    }

                    return part;
                  })}
                </div>

                {/* Recommended Place Buttons - Explicit for model messages */}
                {msg.role === 'model' && state.nearbyPlaces.length > 0 &&
                  [...state.history].reverse().find(m => m.role === 'model')?.id === msg.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {state.nearbyPlaces.slice(-3).map((place) => (
                        <button
                          key={place.id}
                          onClick={() => moveTo(place.location, place.name)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:bg-white hover:border-pink-300 hover:text-pink-600 hover:shadow-md transition-all text-xs font-bold group"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${place.type === 'restaurant' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {place.type === 'restaurant' ? <Utensils className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                          </div>
                          {place.name}
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  )}

                <p className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-white' : 'text-slate-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {state.isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Luna is searching for the best spots...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Type a message..."}
            disabled={state.isThinking || isListening}
            className="w-full pl-4 pr-24 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={isLiveMode ? stopLiveMode : startLiveMode}
              disabled={state.isThinking}
              className={`p-2 rounded-xl transition-all ${isLiveMode
                ? 'bg-emerald-500 text-white animate-pulse'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {isLiveMode ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              type="submit"
              disabled={!input.trim() || state.isThinking || isLiveMode}
              className="p-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-pink-600 transition-all shadow-md shadow-pink-600/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
          Luna can help you find restaurants, landmarks, and more.
        </p>
      </div>
    </div>
  );
}
