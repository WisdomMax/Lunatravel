/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { TravelProvider } from './context/TravelContext';
import TravelMap from './components/TravelMap';
import TravelSidebar from './components/TravelSidebar';
import { APIProvider } from '@vis.gl/react-google-maps';
import SetupPage from './pages/SetupPage';
import BgmPlayer from './components/BgmPlayer';
import RetroModal from './components/RetroModal';
import { useTravel } from './context/TravelContext';

function GlobalModal() {
  const { modal, hideModal } = useTravel();
  return (
    <RetroModal
      isOpen={modal.isOpen}
      title={modal.title}
      message={modal.message}
      type={modal.type}
      onConfirm={() => {
        modal.onConfirm?.();
        hideModal();
      }}
      onCancel={() => {
        modal.onCancel?.();
        hideModal();
      }}
    />
  );
}

type AppView = 'setup' | 'app';

function TravelApp({ apiKey, onBack }: { apiKey: string, onBack: () => void }) {
  return (
    <APIProvider apiKey={apiKey}>
      <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[400px] h-full flex-shrink-0 z-20 shadow-2xl shadow-slate-300/50 bg-white">
          <TravelSidebar onBack={onBack} />
        </div>

        {/* Main Map Area */}
        <div className="flex-1 h-full relative p-4 bg-slate-100/50">
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 bg-white relative">
            <TravelMap />
          </div>
        </div>
      </div>
    </APIProvider>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [view, setView] = useState<AppView>('setup');

  useEffect(() => {
    const storedKey = localStorage.getItem('google_maps_api_key');
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (storedKey) {
      setApiKey(storedKey);
    } else if (envKey) {
      setApiKey(envKey);
    }
    setIsKeyLoaded(true);
  }, []);

  const handleSetupComplete = () => {
    setView('app');
  };

  if (!isKeyLoaded) {
    return null;
  }

  return (
    <TravelProvider>
      <BgmPlayer view={view} />
      <GlobalModal />
      {/* API Key Input Screen */}
      {!apiKey && (
        <div className="flex items-center justify-center min-h-screen w-screen bg-slate-900 p-8 relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-pink-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

          <div className="bg-white/10 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/20 max-w-md w-full relative z-10 font-sans">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Luna</h2>
            </div>

            <p className="text-slate-300 mb-8 leading-relaxed font-bold">
              Enter your Google Maps API Key to start your journey with Luna.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const key = formData.get('apiKey') as string;
                if (key.trim()) {
                  localStorage.setItem('google_maps_api_key', key.trim());
                  setApiKey(key.trim());
                }
              }}
              className="space-y-5"
            >
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2 font-bold uppercase tracking-wider">
                  API Key
                </label>
                <input
                  type="text"
                  id="apiKey"
                  name="apiKey"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all font-mono"
                  placeholder="AIzaSy..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-pink-600/20 active:scale-[0.98] uppercase tracking-widest"
              >
                Start Journey
              </button>
            </form>

            <div className="mt-8 text-xs text-slate-400 bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 leading-relaxed font-bold">
              <p className="font-bold text-slate-300 mb-3 uppercase tracking-tighter">How to get an API Key:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  Access <a href="https://console.cloud.google.com/google/maps-apis/api-list" target="_blank" rel="noreferrer" className="text-pink-400 hover:text-pink-300 hover:underline transition-colors">
                    Google Cloud Console
                  </a>
                </li>
                <li>Enable "Maps JavaScript API" & "Street View Static API"</li>
                <li>Create an API Key in "Credentials"</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 셋업 페이지 */}
      {apiKey && view === 'setup' && (
        <SetupPage onComplete={handleSetupComplete} />
      )}

      {/* 메인 여행 앱 */}
      {apiKey && view === 'app' && (
        <TravelApp apiKey={apiKey} onBack={() => setView('setup')} />
      )}
    </TravelProvider>
  );
}
