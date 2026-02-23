import './style.css';
import { CompanionSetup } from './src/setup.js';
import { GeminiService } from './src/gemini.js';
import { InfoPanel } from './src/info.js';
import { SnapshotManager } from './src/snapshot.js';

let panorama;
let companionDialog;
let companionPersona = {};
let gemini;
let infoPanel;
let snapshotManager;
let currentAddress = "Eiffel Tower";
let surroundings = [];

// Google Maps API Loader
const loadGoogleMaps = (apiKey) => {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve(window.google.maps);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initApp`;
        script.async = true;
        script.defer = true;
        script.onerror = reject;
        document.head.appendChild(script);

        window.initApp = () => {
            resolve(window.google.maps);
        };
    });
};

async function startTravel() {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
        alert('.env 파일에 Google Maps API 키를 설정해주세요!');
        return;
    }

    try {
        const maps = await loadGoogleMaps(apiKey);
        companionDialog = document.getElementById('companion-dialog');

        // Initialize Street View
        const initialPosition = { lat: 48.8584, lng: 2.2945 }; // Eiffel Tower

        panorama = new maps.StreetViewPanorama(
            document.getElementById('street-view'),
            {
                position: initialPosition,
                pov: { heading: 165, pitch: 0 },
                zoom: 1,
                addressControl: false,
                linksControl: true,
                panControl: false,
                enableCloseButton: false,
            }
        );

        // Setup Search
        const input = document.getElementById('search-input');
        const button = document.getElementById('search-button');
        const service = new maps.places.PlacesService(document.createElement('div'));

        const performSearch = () => {
            const query = input.value;
            if (!query) return;

            updateCompanionText('음... 명소를 찾아보고 있어! 잠시만 기다려줘.');

            service.textSearch({ query }, (results, status) => {
                if (status === maps.places.PlacesServiceStatus.OK && results[0]) {
                    const place = results[0];
                    const latLng = place.geometry.location;

                    panorama.setPosition(latLng);
                    updateCompanionText(`우와! 여기가 ${place.name}이구나! 정말 멋진걸?`);
                } else {
                    updateCompanionText('앗, 그곳은 스트리트 뷰가 지원되지 않거나 찾을 수 없어...');
                }
            });
        };

        // Initialize Modules
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        gemini = new GeminiService(geminiKey, companionPersona);
        infoPanel = new InfoPanel();
        snapshotManager = new SnapshotManager(panorama);

        snapshotManager.init((file) => {
            updateCompanionWithAI(`이 사진 어때? 우리 여기서 같이 찍은 것처럼 만들어줘! (파일: ${file.name})`);
        });

        // TTS setup
        const speakText = (text) => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        };

        const updateCompanionWithAI = async (userInput) => {
            if (!geminiKey) {
                updateCompanionText("앗, Gemini API 키가 없어서 대화를 할 수 없어...");
                return;
            }
            updateCompanionText("음...");
            const response = await gemini.generateResponse(userInput, currentAddress, surroundings);
            updateCompanionText(response);
            speakText(response);
        };

        const performNearbySearch = (location) => {
            const request = {
                location: location,
                radius: '500',
                type: ['restaurant', 'tourist_attraction']
            };
            const service = new maps.places.PlacesService(document.createElement('div'));
            service.nearbySearch(request, (results, status) => {
                if (status === maps.places.PlacesServiceStatus.OK) {
                    surroundings = results.map(r => r.name);
                    infoPanel.updatePlaces(results);
                }
            });
        };

        // Initial search
        performNearbySearch(initialPosition);

        // Audio Context for feedback
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, type, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        };

        button.addEventListener('click', () => {
            playTone(440, 'sine', 0.2);
            performSearch();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                playTone(440, 'sine', 0.2);
                performSearch();
            }
        });

        // Companion interaction
        const avatar = document.getElementById('companion-avatar');
        // Set generated avatar
        avatar.innerHTML = `<img src="/assets/companion.png" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        avatar.style.background = 'none';

        avatar.addEventListener('click', () => {
            playTone(660, 'triangle', 0.3);
            updateCompanionWithAI("안녕! 궁금한 게 있어.");

            // Avatar bounce animation
            avatar.style.transform = 'scale(1.2)';
            setTimeout(() => avatar.style.transform = 'scale(1)', 200);
        });

        // Update panorama location event
        panorama.addListener('position_changed', () => {
            const pos = panorama.getPosition();

            // Perform nearby search
            performNearbySearch(pos);

            // Use Geocoder to get address
            const geocoder = new maps.Geocoder();
            geocoder.geocode({ location: pos }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    currentAddress = results[0].formatted_address;
                    console.log('Current Address:', currentAddress);
                }
            });

            // Small chance to say something when moving
            if (Math.random() > 0.8) {
                updateCompanionWithAI("여기 주변은 어때?");
            }
        });

    } catch (error) {
        console.error('Google Maps API 로드 실패:', error);
        alert('Google Maps API를 불러오는 중 오류가 발생했습니다.');
    }
}

function updateCompanionText(text) {
    if (companionDialog) {
        companionDialog.textContent = text;
    }
}

// Replace the manual startTravel call with Setup initiation
const initApp = () => {
    new CompanionSetup(async (data) => {
        companionPersona = data;
        console.log('Companion Data:', data);

        // In a real scenario, we'd use generate_image here via the agent, 
        // but for the app runtime, we'll assume the image is generated or use a placeholder.
        // For this task, I will generate the image now.

        await startTravel();
    });
};

initApp();
