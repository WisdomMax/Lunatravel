import React, { useState } from 'react';
import { useTravel } from '../context/TravelContext';
import { Music, Play, Pause, ChevronDown, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BgmControlProps {
  variant?: 'setup' | 'map';
}

export default function BgmControl({ variant = 'setup' }: BgmControlProps) {
  const { state, toggleBgm, selectBgm, setBgmVolume } = useTravel();
  const { isBgmPlaying, bgmPlaylist, currentBgmIndex, bgmVolume } = state;
  const [showDropdown, setShowDropdown] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  if (bgmPlaylist.length === 0) return null;

  const currentTrack = bgmPlaylist[currentBgmIndex];

  // 1. 세팅 페이지용 (단순 On/Off)
  if (variant === 'setup') {
    return (
      <button
        onClick={toggleBgm}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all active:scale-95 ${
          isBgmPlaying 
            ? 'bg-pink-500/20 border-pink-500/40 text-pink-600' 
            : 'bg-white/10 border-white/20 text-white/60'
        }`}
      >
        {isBgmPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        <span className="text-[10px] font-black uppercase tracking-widest">BGM {isBgmPlaying ? 'ON' : 'OFF'}</span>
      </button>
    );
  }

  // 2. 맵 탐험 페이지용 (Dropdown + Volume)
  return (
    <div className="flex items-center gap-2">
      {/* BGM Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="bg-white/90 backdrop-blur-xl border border-slate-200 px-4 py-2 rounded-xl shadow-lg flex items-center gap-3 hover:bg-white transition-all active:scale-95"
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isBgmPlaying ? 'bg-pink-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
            <Music size={12} />
          </div>
          <div className="flex flex-col items-start min-w-[80px] max-w-[120px]">
            <span className="text-[8px] font-black text-pink-500 uppercase tracking-tighter">BGM Select</span>
            <span className="text-[10px] font-bold text-slate-700 truncate w-full">{currentTrack?.name || 'Select Music'}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full mb-3 left-0 w-48 bg-white/95 backdrop-blur-3xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 p-2 z-[200] max-h-60 overflow-y-auto"
            >
              {bgmPlaylist.map((track, idx) => (
                <button
                  key={track.url}
                  onClick={() => {
                    selectBgm(idx);
                    setShowDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    currentBgmIndex === idx ? 'bg-pink-50 text-pink-600' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Play size={10} className={currentBgmIndex === idx ? 'fill-pink-500' : 'opacity-0'} />
                  <span className="text-[11px] font-bold truncate">{track.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Volume Control */}
      <div className="relative">
        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`p-3 rounded-xl backdrop-blur-md border transition-all ${
            showVolume ? 'bg-white border-pink-200 text-pink-500 shadow-md' : 'bg-white/80 border-slate-200 text-slate-500 hover:bg-white shadow-sm'
          }`}
        >
          {bgmVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <AnimatePresence>
          {showVolume && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-3xl px-4 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col items-center gap-3 w-12 z-[200]"
            >
              <div className="h-24 w-1 bg-slate-100 rounded-full relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-6 appearance-none bg-transparent cursor-pointer accent-pink-500 -rotate-90 origin-center"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Play/Pause Toggle */}
      <button
        onClick={toggleBgm}
        className={`p-3 rounded-xl shadow-lg transition-all active:scale-90 ${
          isBgmPlaying ? 'bg-pink-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
        }`}
      >
        {isBgmPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
    </div>
  );
}
