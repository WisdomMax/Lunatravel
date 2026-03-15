/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, Marker, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { useTravel } from '../context/TravelContext';
import { Search, MapPin, Loader2, Navigation, Utensils, Camera, ExternalLink, ChevronLeft, Map as MapIcon, Heart, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DEFAULT_ZOOM } from '../constants';
import BgmControl from './BgmControl';

export default function TravelMap() {
  const { state, setViewMode, takeTravelPhoto, moveTo, addBookmark, setBgmMode } = useTravel();
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const map = useMap();

  useEffect(() => {
    (window as any).gm_authFailure = () => {
      setMapError("Google Maps API error. Please check your key.");
    };
    
    return () => {
      (window as any).gm_authFailure = undefined;
    };
  }, [setBgmMode]);

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

    const streetView = map.getStreetView();

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
      if (state.viewMode === 'streetview' && streetView.getVisible()) {
        const pos = streetView.getPosition();
        if (pos) {
          const newLoc = { lat: pos.lat(), lng: pos.lng() };
          const dist = Math.sqrt(
            Math.pow(newLoc.lat - state.currentLocation.lat, 2) +
            Math.pow(newLoc.lng - state.currentLocation.lng, 2)
          );
          if (dist > 0.0002) {
            moveTo(newLoc, state.currentLocation.name, false);
          }
        }
      }
    });

    return () => {
      google.maps.event.removeListener(visibilityListener);
      google.maps.event.removeListener(positionListener);
    };
  }, [map, state.viewMode, setViewMode, moveTo]);

  useEffect(() => {
    if (map && state.currentLocation && state.viewMode === 'map') {
      map.panTo(state.currentLocation);
    }

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

  const handlePoiClick = useCallback((e: any) => {
    if (!e.detail.placeId) return;
    const placeId = e.detail.placeId;
    console.log('[Map] POI Clicked:', placeId);
    
    if (e.stop) e.stop();

    if (typeof google !== 'undefined' && google.maps?.places && map) {
      const service = new google.maps.places.PlacesService(map);
      service.getDetails({ 
        placeId: placeId, 
        fields: ['name', 'geometry', 'formatted_address', 'photos', 'rating', 'user_ratings_total', 'types'] 
      }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const loc = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name || 'Selected Place'
          };
          
          setSelectedPlace({
            ...place,
            location: loc
          });

          moveTo(loc, loc.name, false);
        }
      });
    }
  }, [map, moveTo]);

  const handleMapClick = useCallback((e: any) => {
    // POI 클릭은 handlePoiClick에서 처리하므로 여기서는 무시
    if (e.detail.placeId) return;

    if (!e.detail.latLng) return;
    const latLng = e.detail.latLng;
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
    
    // 단순 지도 클릭 시 선택된 장소 해제
    setSelectedPlace(null);
    moveTo({ lat, lng });
  }, [moveTo]);

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
          onPoiClick={handlePoiClick}
          mapId="DEMO_MAP_ID"
          clickableIcons={true}
        >
          <AdvancedMarker position={state.currentLocation}>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-12 h-12 bg-pink-500/20 rounded-full animate-ping" />
              <Pin
                background={'#DB2777'}
                borderColor={'#9D174D'}
                scale={1.2}
              >
                <Navigation className="text-white w-4 h-4" />
              </Pin>
            </div>
          </AdvancedMarker>

          {state.nearbyPlaces.map((place) => (
            <AdvancedMarker
              key={place.id}
              position={place.location}
              onClick={(e: any) => {
                if (e.stop) e.stop(); // 이벤트 전파 방지
                moveTo(place.location, place.name, false);
                setSelectedPlace({
                  name: place.name,
                  location: place.location,
                  rating: place.rating,
                  photos: place.photos,
                  formatted_address: place.address || '',
                  types: [place.type === 'restaurant' ? 'restaurant' : 'point_of_interest']
                } as any);
              }}
            >
              <div className="group relative cursor-pointer">
                <Pin
                  background={place.type === 'restaurant' ? '#F59E0B' : '#3B82F6'}
                  borderColor={place.type === 'restaurant' ? '#92400E' : '#1E40AF'}
                >
                  {place.type === 'restaurant' ?
                    <Utensils className="w-3.5 h-3.5 text-white" fill="white" /> :
                    <Camera className="w-3.5 h-3.5 text-white" fill="white" />
                  }
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
                  </div>
                </div>
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </div>

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

      <AnimatePresence>
        {state.viewMode === 'streetview' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-20 right-6 z-50 flex flex-col items-end gap-3 pointer-events-auto"
          >
            <AnimatePresence>
              {showPromptInput && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white/50 w-64 mb-1 origin-bottom-right"
                >
                  <label className="text-[11px] font-black text-slate-500 mb-1.5 block uppercase tracking-wider pl-1">
                    Special Request (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., wearing Hanbok, doing a peace sign..."
                    className="w-full h-16 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all resize-none shadow-inner"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPromptInput(!showPromptInput)}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border ${
                  showPromptInput 
                    ? 'bg-pink-500 text-white border-pink-600' 
                    : 'bg-white/80 backdrop-blur-xl text-slate-500 border-white/40 hover:bg-white hover:text-pink-500'
                }`}
                title="Add custom prompt"
              >
                <Wand2 className="w-5 h-5" />
              </button>

              <button
                disabled={state.isGeneratingPhoto}
                onClick={() => {
                  if (!map) return;
                  const sv = map.getStreetView();
                  const pov = sv.getPov();
                  const pos = sv.getPosition();
                  if (!pos) return;

                  takeTravelPhoto(
                    { lat: pos.lat(), lng: pos.lng(), name: state.currentLocation.name },
                    pov.heading,
                    pov.pitch,
                    sv.getZoom() || 1,
                    customPrompt
                  );
                  setShowPromptInput(false);
                  setCustomPrompt('');
                }}
                className={`bg-white/80 backdrop-blur-xl text-slate-900 border border-white/40 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 font-sans font-bold text-sm transition-all active:scale-95 ${state.isGeneratingPhoto ? 'opacity-50 cursor-not-allowed scale-95' : 'hover:scale-105 hover:bg-white'
                  }`}
              >
                {state.isGeneratingPhoto ? (
                  <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                ) : (
                  <Camera className="w-6 h-6 text-pink-500" />
                )}
                {state.isGeneratingPhoto ? 'Processing Memory...' : 'Capture Memory with Luna'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.viewMode === 'map' && state.nearbyPlaces.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-20 left-6 z-10 flex flex-col gap-2 max-w-[250px]"
          >
            <div className="bg-white/40 backdrop-blur-xl p-3 rounded-2xl border border-white/40 shadow-xl mb-1">
              <p className="text-[10px] font-serif italic text-pink-700 uppercase tracking-[0.2em] px-2 text-center">{state.lunaName}'s Selections</p>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-2 scrollbar-hide">
              {state.nearbyPlaces.map((place) => (
                <button
                  key={place.id}
                  onClick={() => {
                    moveTo(place.location, place.name, false);
                    setSelectedPlace({
                      name: place.name,
                      location: place.location,
                      rating: place.rating,
                      photos: place.photos,
                      formatted_address: place.address || '',
                      types: [place.type === 'restaurant' ? 'restaurant' : 'point_of_interest']
                    } as any);
                  }}
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
              placeholder="Explore the world together..."
              className="w-full bg-white/70 backdrop-blur-2xl shadow-2xl rounded-full py-5 pl-14 pr-6 text-base border border-white/40 focus:ring-4 focus:ring-pink-500/10 transition-all font-display font-medium text-slate-900 placeholder:text-slate-400"
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

      <AnimatePresence>
        {(selectedPlace?.name || state.currentLocation.name) && state.viewMode === 'map' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-24 right-6 z-10 flex flex-col items-end gap-2"
          >
            <div className="bg-white/90 backdrop-blur-md p-3 px-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3 max-w-[220px]">
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="text-pink-600 w-4 h-4" />
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pin</p>
                <p className="text-xs font-bold text-slate-900 truncate">{selectedPlace?.name || state.currentLocation.name}</p>
              </div>
              <button
                onClick={() => addBookmark(selectedPlace?.location || state.currentLocation)}
                className="p-1.5 text-pink-500 hover:bg-pink-50 rounded-xl transition-all active:scale-90"
                title="Save Place"
              >
                <Heart className={`w-4 h-4 ${state.bookmarks.some(b => b.name === (selectedPlace?.name || state.currentLocation.name)) ? 'fill-pink-500' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.viewMode === 'streetview' && state.currentLocation.name && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-white/30 flex items-center gap-4">
              <div className="w-7 h-7 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="text-pink-600 w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-semibold text-slate-800 max-w-[300px] truncate">{state.currentLocation.name}</p>
              <button
                onClick={() => addBookmark(state.currentLocation)}
                className="p-1.5 text-pink-500 hover:bg-pink-50 rounded-xl transition-all active:scale-90"
                title="Save Place"
              >
                <Heart className={`w-4 h-4 ${state.bookmarks.some(b => b.name === state.currentLocation.name) ? 'fill-pink-500' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {selectedPlace && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-24 right-6 z-50 w-[320px] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden flex flex-col pointer-events-auto"
          >
            <div className="relative h-48 bg-slate-100">
              {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
                <img 
                  src={selectedPlace.photos[0].getUrl ? selectedPlace.photos[0].getUrl({ maxWidth: 400 }) : selectedPlace.photos[0]} 
                  alt={selectedPlace.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Camera className="w-8 h-8 opacity-20" />
                  <p className="text-[10px] uppercase tracking-widest font-black">No Preview Memory</p>
                </div>
              )}
              <button 
                onClick={() => setSelectedPlace(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all active:scale-90"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedPlace.name}</h3>
                <button
                  onClick={() => addBookmark(selectedPlace.location)}
                  className="p-2 text-pink-500 hover:bg-pink-50 rounded-xl transition-all active:scale-90"
                >
                  <Heart className={`w-5 h-5 ${state.bookmarks.some(b => b.name === selectedPlace.name) ? 'fill-pink-500' : ''}`} />
                </button>
              </div>

              {selectedPlace.rating && (
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                    <span className="text-amber-500 text-sm font-black">★</span>
                    <span className="text-sm font-black text-amber-700">{selectedPlace.rating}</span>
                  </div>
                  {selectedPlace.user_ratings_total && (
                    <span className="text-xs text-slate-400 font-bold">({selectedPlace.user_ratings_total.toLocaleString()} reviews)</span>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
                {selectedPlace.formatted_address}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    moveTo(selectedPlace.location, selectedPlace.name, true);
                    setSelectedPlace(null);
                  }}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-pink-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs"
                >
                  <Navigation className="w-4 h-4" />
                  Explore Street View
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
