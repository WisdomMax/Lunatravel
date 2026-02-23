import './style.css';

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

let panorama;
let companionDialog;

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
        avatar.addEventListener('click', () => {
            playTone(660, 'triangle', 0.3);
            const messages = [
                "지도는 잘 보고 있어?",
                "와, 공기가 정말 상쾌한 것 같아!",
                "다음은 어디로 가볼까? 네가 가고 싶은 곳이면 어디든 좋아!",
                "스트리트 뷰로 세상을 구경하는 건 정말 즐거워!",
                "나랑 같이 여행해줘서 고마워!",
                "내 머리를 클릭하면 기분이 좋아져!",
                "어디든 좋은 곳이 있으면 나에게도 알려줘!"
            ];
            const randomMsg = messages[Math.floor(Math.random() * messages.length)];
            updateCompanionText(randomMsg);

            // Avatar bounce animation
            avatar.style.transform = 'scale(1.2)';
            setTimeout(() => avatar.style.transform = 'scale(1)', 200);
        });

        // Update panorama location event
        panorama.addListener('position_changed', () => {
            const pos = panorama.getPosition();
            console.log('Moved to:', pos.lat(), pos.lng());
            // Small chance to say something when moving
            if (Math.random() > 0.8) {
                const moveMsgs = ["오! 저기도 괜찮아 보이는데?", "계속 가보자!", "여기 분위기 좋은걸?"];
                updateCompanionText(moveMsgs[Math.floor(Math.random() * moveMsgs.length)]);
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

// Start the app
startTravel();
