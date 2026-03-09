const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.VITE_GEMINI_API_KEY; // Gemini 키 사용!
if (!apiKey) {
    console.error("API Key missing");
    process.exit(1);
}

const characters = [
    { id: 'luna-1', text: '여행은 새로운 나를 만나는 과정이죠. 저와 함께 떠나보실래요?', voiceName: 'ko-KR-Neural2-A', speakingRate: 1.0, pitch: 2.0 },
    { id: 'luna-2', text: '세상은 넓고 갈 곳은 정말 많아! 당장 나랑 출발하자!', voiceName: 'ko-KR-Neural2-B', speakingRate: 1.15, pitch: 4.0 },
    { id: 'luna-3', text: '모든 장소에는 깊은 이야기가 숨어있답니다. 저와 함께 들어보시겠어요?', voiceName: 'ko-KR-Wavenet-B', speakingRate: 0.9, pitch: -2.0 },
    { id: 'custom', text: '당신만의 특별한 파트너를 기획해 주세요.', voiceName: 'ko-KR-Standard-A', speakingRate: 1.0, pitch: 0.0 },
];

const audioDir = path.join(__dirname, 'public', 'assets', 'audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

async function generateAll() {
    for (const char of characters) {
        try {
            const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
            const payload = {
                input: { text: char.text },
                voice: { languageCode: "ko-KR", name: char.voiceName },
                audioConfig: { audioEncoding: "MP3", speakingRate: char.speakingRate, pitch: char.pitch }
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(`TTS API Error: ${errData}`);
            }

            const data = await response.json();
            if (data.audioContent) {
                const buffer = Buffer.from(data.audioContent, 'base64');
                fs.writeFileSync(path.join(audioDir, `${char.id}.mp3`), buffer);
                console.log(`Successfully generated ${char.id}.mp3 via Google Cloud TTS!`);
            }
        } catch (e) {
            console.error(`Failed to generate ${char.id}:`, e);
            process.exit(1);
        }
    }
}

generateAll();
