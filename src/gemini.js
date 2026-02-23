export class GeminiService {
    constructor(apiKey, persona) {
        this.apiKey = apiKey;
        this.persona = persona;
        this.history = [];
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
    }

    async generateResponse(userInput, currentPlace, surroundings) {
        const systemPrompt = `
      당신은 여행 동반자 AI입니다. 
      성격: ${this.persona.personality} (${this.persona.details})
      현재 위치: ${currentPlace}
      주변 정보: ${JSON.stringify(surroundings)}

      규칙:
      1. 너무 길게 말하지 마세요. (2~3문장 권장)
      2. 설정된 성격에 맞게 말투를 유지하세요.
      3. 현재 위치와 주변 정보를 활용해 흥미로운 사실이나 추천을 해주세요.
      4. 한국어로 친절하게 답변하세요.
    `;

        const contents = [
            ...this.history,
            { role: "user", parts: [{ text: `시스템 설정: ${systemPrompt}` }] },
            { role: "user", parts: [{ text: userInput }] }
        ];

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            const data = await response.json();
            const aiText = data.candidates[0].content.parts[0].text;

            // Update history
            this.history.push({ role: "user", parts: [{ text: userInput }] });
            this.history.push({ role: "model", parts: [{ text: aiText }] });

            // Keep history compact
            if (this.history.length > 10) this.history = this.history.slice(-10);

            return aiText;
        } catch (error) {
            console.error('Gemini API Error:', error);
            return "앗, 잠시 생각에 빠졌어. 다시 한번 말해줄래?";
        }
    }
}
