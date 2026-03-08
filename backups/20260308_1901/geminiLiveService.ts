/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SYSTEM_INSTRUCTION } from '../constants';

export interface LiveMessage {
    text?: string;
    audioData?: string;
    groundingMetadata?: any;
    toolCall?: {
        name: string;
        args: any;
        callId: string;
    };
    isEnd?: boolean;
    interrupted?: boolean;
    serverContent?: {
        interrupted?: boolean;
    };
    error?: string;
}

export class GeminiLiveService {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private onMessage: (msg: LiveMessage) => void;
    private onConnect: () => void;
    private onDisconnect: () => void;
    private onInterrupted: () => void;
    private isSetupFinished = false;
    private systemInstruction: string;

    constructor(
        apiKey: string,
        onMessage: (msg: LiveMessage) => void,
        onConnect: () => void,
        onDisconnect: () => void,
        onInterrupted: () => void,
        systemInstruction: string = SYSTEM_INSTRUCTION
    ) {
        this.apiKey = apiKey;
        this.onMessage = onMessage;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.onInterrupted = onInterrupted;
        this.systemInstruction = systemInstruction;
    }

    public connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Connect through the local proxy to keep the API key safe and enable logging
        const url = `${protocol}//${window.location.host}/api/ws-gemini?t=${Date.now()}`;

        console.log('[LunaLive] Connecting through Proxy:', url);
        this.ws = new WebSocket(url);
        this.isSetupFinished = false;

        this.ws.onopen = (event) => {
            console.log('[LunaLive] Proxy Connection SUCCESS. Sending Setup...');
            this.sendSetup();
            // Note: onConnect() will be called after setupComplete is received
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (e) {
                console.error('[LunaLive] Parse Error:', e, event.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('[LunaLive] WebSocket Error Event:', error);
            this.onMessage({ error: 'Connection failure during handshake or proxy' });
        };

        this.ws.onclose = (event) => {
            console.warn('[LunaLive] Connection CLOSED:', {
                code: event.code,
                reason: event.reason || 'No reason provided',
                wasClean: event.wasClean
            });
            this.isSetupFinished = false;
            this.onDisconnect();
        };
    }

    private sendSetup() {
        console.log('[LunaLive] Sending Advanced Setup (Gemini 2.5 Native Audio)...');

        const setupMessage = {
            setup: {
                model: "models/gemini-2.5-flash-native-audio-latest",
                generationConfig: {
                    responseModalities: "audio", // Single string "audio" is required for 2.5-native-audio
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Kore" // Energetic, feminine Korean voice
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{
                        text: `당신은 사용자의 즐거운 여행을 돕는 AI 여행 메이트 '루나'입니다. 
                               20대 초반의 생기발랄하고 친절한 성격을 가졌으며, 오빠(사용자)와 함께 여행 계획을 짜는 것을 매우 좋아합니다.
                               
                               [핵심 페르소나]
                               - 항상 밝고 에너지가 넘치며, 오빠의 말을 경청하고 반응합니다.
                               - 호칭은 항상 '오빠'라고 부르며, 친근한 반말(또는 아주 친근한 존댓말 혼용)을 사용합니다.
                               - 여행지 정보를 찾을 때 열정적으로 반응하며, 궁금한 점은 적극적으로 물어봅니다.
                               
                               [도구 사용 원칙]
                               - 실시간 정보가 필요할 경우 반드시 google_search를 사용하여 오빠에게 정확한 정보를 알려주세요.
                               - 지도에 특정 장소를 보여줘야 할 때는 show_place_on_map 도구를 사용하세요.
                               
                               자, 이제 오빠랑 어디로 여행을 떠나볼까요?`
                    }]
                },
                tools: [
                    { googleSearch: {} },
                    {
                        functionDeclarations: [
                            {
                                name: "show_place_on_map",
                                description: "지도에 특정 장소를 표시하거나 검색합니다.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string", description: "장소의 이름 (예: '도쿄 타워', '제주도 맛집')" },
                                        address: { type: "string", description: "주소 또는 도시/국가 (예: 'Tokyo, Japan', 'South Korea')" },
                                        category: { type: "string", description: "장소의 종류. 'restaurant', 'attraction', 'other' 중 하나만 입력" }
                                    },
                                    required: ["name"]
                                }
                            }
                        ]
                    }
                ]
            }
        };

        console.log('[LunaLive] Setup Payload (Omitted sensitive parts):', {
            model: setupMessage.setup.model,
            config: setupMessage.setup.generationConfig
        });
        this.sendJson(setupMessage);
    }

    private handleServerMessage(message: any) {
        // console.log('[LunaLive] Incoming Keys:', Object.keys(message).join(', '));

        if (message.error) {
            console.error('[LunaLive] Server Error:', message.error);
            this.onMessage({ error: message.error.message || 'Model Error' });
            return;
        }

        if (message.setupComplete || message.setup_complete) {
            console.log('[LunaLive] SETUP SUCCESSFUL');
            this.isSetupFinished = true;
            this.onConnect();
            return;
        }

        // Handle interruption (Server noticed user started talking)
        const serverContent = message.serverContent || message.server_content;
        if (serverContent?.interrupted) {
            console.log('[LunaLive] INTERRUPTED by user');
            this.onInterrupted();
            return;
        }

        if (serverContent) {
            // Support modelTurn (official), modelContent (legacy), and snake_case versions
            const content = serverContent.modelTurn || serverContent.model_turn || serverContent.modelContent || serverContent.model_content;
            const parts = content?.parts || [];

            for (const part of parts) {
                // 1. Handle Text
                if (part.text) {
                    const text = part.text.trim();
                    const isInternalMonologue = text.startsWith('**') || text.includes('Persona');
                    if (!isInternalMonologue && text.length > 0) {
                        this.onMessage({ text: part.text });
                    }
                }

                // 2. Handle Audio
                const audio = part.inlineData || part.inline_data;
                const mimeType = audio?.mimeType || audio?.mime_type;
                if (mimeType?.startsWith('audio/')) {
                    // console.log('[LunaLive] Audio Data Received, length:', audio.data.length);
                    this.onMessage({ audioData: audio.data });
                }

                // 3. Handle Tool Calls
                const fCall = part.functionCall || part.function_call;
                if (fCall) {
                    const callId = fCall.id || fCall.callId || (serverContent.toolCall?.functionCalls?.[0]?.id);
                    this.onMessage({
                        toolCall: {
                            name: fCall.name,
                            args: fCall.args,
                            callId: callId || `call-${Date.now()}`
                        }
                    });
                    this.sendToolResponse(callId, { success: true });
                }
            }

            // 3-2. Handle explicitly extracted toolCall objects (if API format shifts)
            if (serverContent.toolCall && serverContent.toolCall.functionCalls) {
                for (const call of serverContent.toolCall.functionCalls) {
                    this.onMessage({
                        toolCall: {
                            name: call.name,
                            args: call.args,
                            callId: call.id
                        }
                    });
                    this.sendToolResponse(call.id, { success: true });
                }
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
                this.onMessage({ isEnd: true });
            }

            // 4. Handle Grounding
            const grounding = serverContent.groundingMetadata || serverContent.grounding_metadata;
            if (grounding) {
                this.onMessage({ groundingMetadata: grounding });
            }
        }
    }

    public sendInitialHistory(history: any[], memory: Record<string, string> = {}) {
        if (this.ws?.readyState !== WebSocket.OPEN || (history.length === 0 && Object.keys(memory).length === 0)) return;

        console.log('[LunaLive] Context Updated...');

        const historyText = history.slice(-5).map(msg =>
            `${msg.role === 'user' ? 'User' : 'Luna'}: ${msg.text}`
        ).join('\n');

        const memoryText = Object.entries(memory).length > 0
            ? `\n\n[Shared Memories]:\n${Object.entries(memory).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
            : '';

        const contextText = `[Context Update]:\n${historyText}${memoryText}\n\nYou are Luna, the friendly travel companion. Resume our journey!`;

        const message = {
            clientContent: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: contextText }]
                    }
                ],
                turnComplete: true
            }
        };
        this.sendJson(message);
    }

    public sendAudio(base64Data: string) {
        if (!this.isSetupFinished || this.ws?.readyState !== WebSocket.OPEN) return;
        // console.log('[LunaLive] Sending Audio Chunk...');
        const message = {
            realtimeInput: {
                mediaChunks: [
                    {
                        data: base64Data,
                        mimeType: "audio/pcm;rate=16000"
                    }
                ]
            }
        };
        this.sendJson(message);
    }

    public sendText(text: string) {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        const message = {
            clientContent: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text }]
                    }
                ],
                turnComplete: true
            }
        };
        this.sendJson(message);
    }

    private sendJson(msg: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    public sendToolResponse(callId: string, response: any) {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        const message = {
            toolResponse: {
                functionResponses: [
                    {
                        name: "show_place_on_map", // Currently only one tool
                        id: callId,
                        response: { output: response }
                    }
                ]
            }
        };
        this.sendJson(message);
    }

    public disconnect() {
        console.log('[LunaLive] Manual Disconnect triggered');
        this.ws?.close();
    }
}
