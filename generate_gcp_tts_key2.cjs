const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.VITE_GEMINI_API_KEY; // TRY SECOND KEY
const characters = [ { id: 'luna-1', text: '테스트' } ];
const audioDir = path.join(__dirname, 'public', 'assets', 'audio');

async function test() {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    const payload = { input: { text: "테스트" }, voice: { languageCode: "ko-KR", name: "ko-KR-Neural2-A" }, audioConfig: { audioEncoding: "MP3" } };
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { console.error(await response.text()); }
    else { console.log('SUCCESS KEY 2'); }
}
test();
