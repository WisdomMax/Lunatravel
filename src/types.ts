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
