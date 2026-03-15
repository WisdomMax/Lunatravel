/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  audio?: string; // base64 audio data
  timestamp: number;
}

export interface TravelPhoto {
  id: string;
  url: string; // base64
  locationName: string;
  timestamp: number;
}

export interface TravelState {
  currentLocation: Location;
  history: Message[];
  isThinking: boolean;
  isSpeaking: boolean;
  nearbyPlaces: Place[];
  viewMode: 'map' | 'streetview';
  searchQuery?: string;
  memory: Record<string, string>;
  photos: TravelPhoto[];
  isGeneratingPhoto: boolean;
  bookmarks: Place[];
  persona: string;
  lunaName: string;
  lunaPhoto: string;
  lunaSelection: string;
  isLiveMode: boolean;
  isBgmPlaying: boolean;
  bgmVolume: number;
  currentBgmIndex: number;
  bgmPlaylist: Array<{ name: string, url: string }>;
  bgmMode: 'loop' | 'playlist';
  chatHistories: Record<string, Message[]>;
  photoHistories: Record<string, TravelPhoto[]>;
  lunaPhotos: Record<string, string>;
  customType: 'female' | 'male' | 'animal';
  isInitialized: boolean;
}

export interface Place {
  id: string;
  name: string;
  location: Location;
  type: 'restaurant' | 'attraction' | 'other';
  description?: string;
  rating?: number;
  url?: string;
}
