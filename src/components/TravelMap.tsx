/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, Marker, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { useTravel } from '../context/TravelContext';
import { MapPin, Navigation, Utensils, Camera, Info, ExternalLink, Map as MapIcon, ChevronLeft, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DEFAULT_ZOOM } from '../constants';

export default function TravelMap() {
  const { state, moveTo, setViewMode } = useTravel();
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const map = useMap();

  useEffect(() => {
    (window as any).gm_authFailure = () => {
      setMapError("Google Maps API error. Please check your key.");
    };
    return () => {
      (window as any).gm_authFailure = undefined;
    };
  }, []);

  // ── Search Handler ──────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) return;
    if (typeof google === 'undefined' || !google.maps?.Geocoder) {
      console.warn('[Search] Geocoder not ready');
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
          name: results[0].formatted_address
        };
        moveTo(loc, loc.name);
        setSearchQuery('');
      } else {
        console.warn('[Search] Geocode failed:', status);
      }
    });
  }, [searchQuery, moveTo]);

  // ── StreetView 싱크 + 이벤트 리스너 ────────────────────────────
  useEffect(() => {
    if (!map) return;

    // Handle viewMode and StreetView
    const streetView = map.getStreetView();

    // Configure Street View options to hide all default Google UI
    streetView.setOptions({
      addressControl: false,
      enableCloseButton: false,
      fullscreenControl: false,
      panControl: false,
      zoomControl: false,
      linksControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      showRoadLabels: false,
    });

    const visibilityListener = google.maps.event.addListener(streetView, 'visible_changed', () => {
      const isVisible = streetView.getVisible();
      if (isVisible && state.viewMode !== 'streetview') {
        setViewMode('streetview');
        const pos = streetView.getPosition();
        if (pos) {
          moveTo({ lat: pos.lat(), lng: pos.lng() });
        }
      } else if (!isVisible && state.viewMode === 'streetview') {
        setViewMode('map');
      }
    });

    const positionListener = google.maps.event.addListener(streetView, 'position_changed', () => {
      if (state.viewMode === 'streetview') {
        const pos = streetView.getPosition();
        if (pos) {
          const newLoc = { lat: pos.lat(), lng: pos.lng() };
          const dist = Math.sqrt(
            Math.pow(newLoc.lat - state.currentLocation.lat, 2) +
            Math.pow(newLoc.lng - state.currentLocation.lng, 2)
          );
          if (dist > 0.0001) {
            moveTo(newLoc);
          }
        }
      }
    });

    return () => {
      google.maps.event.removeListener(visibilityListener);
      google.maps.event.removeListener(positionListener);
    };
  }, [map, state.viewMode, state.currentLocation, setViewMode, moveTo]);

  useEffect(() => {
    if (map && state.currentLocation && state.viewMode === 'map') {
      map.panTo(state.currentLocation);
    }

    // Sync external viewMode changes back to the map's streetview
    if (map) {
      const streetView = map.getStreetView();
      if (state.viewMode === 'streetview' && !streetView.getVisible()) {
        streetView.setPosition(state.currentLocation);
        streetView.setVisible(true);
      } else if (state.viewMode === 'map' && streetView.getVisible()) {
        streetView.setVisible(false);
      }
    }
  }, [map, state.currentLocation, state.viewMode]);

  const handleMapClick = (e: any) => {
    if (!e.detail.latLng) return;
    const latLng = e.detail.latLng;
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
    moveTo({ lat, lng });
  };

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 p-8">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center border border-red-100">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Maps Error</h2>
          <p className="text-slate-500">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="w-full h-full">
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={state.currentLocation}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          streetViewControl={true}
          onClick={handleMapClick}
          mapId="DEMO_MAP_ID"
        >
          <AdvancedMarker position={state.currentLocation}>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-12 h-12 bg-pink-500/20 rounded-full animate-ping" />
              <Pin background={'#DB2777'} borderColor={'#9D174D'} glyphColor={'white'} scale={1.2}>
                <Navigation className="text-white w-4 h-4" />
              </Pin>
            </div>
          </AdvancedMarker>

          {state.nearbyPlaces.map((place) => (
            <AdvancedMarker
              key={place.id}
              position={place.location}
              onClick={() => moveTo(place.location, place.name, true)}
            >
              <div className="group relative">
                <Pin
                  background={place.type === 'restaurant' ? '#F59E0B' : '#3B82F6'}
                  borderColor={place.type === 'restaurant' ? '#92400E' : '#1E40AF'}
                  glyphColor={'white'}
                >
                  {place.type === 'restaurant' ? <Utensils className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                </Pin>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 min-w-[150px]">
                    <p className="font-bold text-slate-900 text-sm">{place.name}</p>
                    {place.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-amber-500 text-xs">★</span>
                        <span className="text-xs text-slate-500">{place.rating}</span>
                      </div>
                    )}
                    {place.url && (
                      <a
                        href={place.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 hover:underline pointer-events-auto"
                      >
                        View on Maps <ExternalLink className="w-2 h-2" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </div>

      {/* Back to Map Button (Only visible when in Street View) */}
      <AnimatePresence>
        {state.viewMode === 'streetview' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-20 left-6 z-50"
          >
            <button
              onClick={() => setViewMode('map')}
              className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-white/20 flex items-center gap-2 text-slate-700 font-bold hover:bg-white transition-all active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to Map
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recommended Places Quick Actions (Top Left) */}
      <AnimatePresence>
        {state.viewMode === 'map' && state.nearbyPlaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-20 left-6 z-10 flex flex-col gap-2 max-w-[250px]"
          >
            <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-lg mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Aura's Picks</p>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-2 scrollbar-hide">
              {state.nearbyPlaces.map((place) => (
                <button
                  key={place.id}
                  onClick={() => moveTo(place.location, place.name, true)}
                  className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-md border border-white/20 flex items-center gap-3 text-left hover:bg-white transition-all active:scale-[0.98] group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${place.type === 'restaurant' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                    {place.type === 'restaurant' ? <Utensils className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{place.name}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      Go there <ChevronLeft className="w-2 h-2 rotate-180" />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Search Bar - Top Center */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
        <div className="relative flex gap-2">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <MapIcon className="w-4 h-4 text-slate-400 group-focus-within:text-pink-500 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              placeholder="어디로 갈까요? (Enter 또는 검색 버튼)"
              className="w-full bg-white shadow-2xl rounded-2xl py-4 pl-12 pr-4 text-sm border-none focus:ring-2 focus:ring-pink-500/20 transition-all font-medium text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={handleSearch}
            className="bg-pink-600 hover:bg-pink-700 text-white px-4 rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Info Card - 지도 모드에서만 보임 */}
      <AnimatePresence>
        {state.currentLocation.name && state.viewMode === 'map' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-24 right-6 z-10"
          >
            <div className="bg-white/90 backdrop-blur-md p-3 px-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3 max-w-[200px]">
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="text-pink-600 w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pin</p>
                <p className="text-xs font-bold text-slate-900 truncate">{state.currentLocation.name}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 스트리트 뷰 주소 배너 - 주소만 깔끔하게 표시 */}
      <AnimatePresence>
        {state.viewMode === 'streetview' && state.currentLocation.name && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-white/30 flex items-center gap-3">
              <div className="w-7 h-7 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="text-pink-600 w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-semibold text-slate-800 max-w-[300px] truncate">{state.currentLocation.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Overlay (Only in Map mode) */}
      {state.viewMode === 'map' && (
        <div className="absolute bottom-10 left-6 flex flex-col gap-2 z-10">
          <button
            onClick={() => map?.setZoom((map.getZoom() || 10) + 1)}
            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-white transition-all active:scale-95 font-bold text-xl"
          >
            +
          </button>
          <button
            onClick={() => map?.setZoom((map.getZoom() || 10) - 1)}
            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-white transition-all active:scale-95 font-bold text-xl"
          >
            -
          </button>
        </div>
      )}
    </div>
  );
}
