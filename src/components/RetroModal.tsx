import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { RetroSound } from '../utils/retroSound';

interface RetroModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function RetroModal({ isOpen, title, message, type = 'alert', onConfirm, onCancel }: RetroModalProps) {
  const handleConfirm = () => {
    RetroSound.playClick();
    onConfirm();
  };

  const handleCancel = () => {
    RetroSound.playClick();
    onCancel?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={type === 'alert' ? handleConfirm : undefined}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* CRT Scanlines for Modal */}
          <div className="absolute inset-0 pointer-events-none z-[1000] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,4px_100%]" />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative z-[1001] w-full max-w-md bg-slate-900 border-4 border-white/20 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Top Bar */}
            <div className="bg-rose-600 px-4 py-2 border-b-4 border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-white" />
                <span className="text-sm font-mulmaru tracking-widest text-white uppercase translate-y-0.5">{title}</span>
              </div>
              {type === 'alert' && (
                <button 
                  onClick={handleConfirm}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Message Body */}
            <div className="p-8 flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-none bg-white/5 flex items-center justify-center border-2 border-white/10">
                {type === 'alert' ? (
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                )}
              </div>
              
              <p className="text-xl xl:text-2xl font-dos text-white leading-relaxed tracking-wide">
                {message}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-4 w-full mt-4">
                {type === 'confirm' && (
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white/70 font-mulmaru uppercase tracking-widest border-2 border-white/10 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-mulmaru uppercase tracking-widest border-2 border-white/30 shadow-lg transition-all active:scale-95 relative group overflow-hidden"
                >
                  <span className="relative z-10">{type === 'alert' ? 'OK' : 'Confirm'}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine pointer-events-none" />
                </button>
              </div>
            </div>

            {/* Bottom Accent */}
            <div className="h-1 w-full bg-rose-600 opacity-30" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
