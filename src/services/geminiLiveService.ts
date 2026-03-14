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
    private voiceName: string;

    constructor(
        apiKey: string,
        onMessage: (msg: LiveMessage) => void,
        onConnect: () => void,
        onDisconnect: () => void,
        onInterrupted: () => void,
        systemInstruction: string = SYSTEM_INSTRUCTION,
        voiceName: string = 'Aoede'
    ) {
        this.apiKey = apiKey;
        this.onMessage = onMessage;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.onInterrupted = onInterrupted;
        this.systemInstruction = systemInstruction;
        this.voiceName = voiceName;
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
                generation_config: {
                    response_modalities: ["audio"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: this.voiceName
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: this.systemInstruction + "\n\n[LIVE MODE MANDATORY]: You are speaking via high-quality native audio. To recommend a place, call 'show_place_on_map'. If asked for details, use Google Search freely. NEVER read technical markers [[PLACE:...]] or URLs aloud. Speak naturally and act as a real travel companion."
                    }]
                },
                tools: [
                    { googleSearch: {} },
                    {
                        function_declarations: [
                            {
                                name: "show_place_on_map",
                                description: "Generates a clickable link button in the chat to move to a specific place. Does not move the map directly.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string", description: "Name of the specific place (e.g., 'Gyeongbokgung Palace', 'MoMA'). Do NOT use full addresses here unless it's a specific street name the user wants to see." },
                                        category: { type: "string", description: "Type of place. Use one of: 'restaurant', 'attraction', 'other'" }
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
            config: (setupMessage.setup as any).generation_config
        });
        this.sendJson(setupMessage);
    }

    private handleServerMessage(message: any) {
        // if (!message.audioData) console.log('[LunaLive] From Gemini:', JSON.stringify(message).substring(0, 100));

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

        // Handle grounding metadata (Google Search results)
        if (message.groundingMetadata || message.grounding_metadata) {
            const gm = message.groundingMetadata || message.grounding_metadata;
            console.log('[LunaLive] GROUNDING METADATA RECEIVED:', JSON.stringify(gm, null, 2));
            this.onMessage({ groundingMetadata: gm });
        }

        // ✅ Root-level toolCall (실제 Gemini 서버에서 오는 형식!)
        // 로그 예시: { "toolCall": { "functionCalls": [{ "name": ..., "args": ..., "id": ... }] } }
        if (message.toolCall && message.toolCall.functionCalls) {
            console.log('[LunaLive] Root-level toolCall received:', message.toolCall.functionCalls);
            for (const call of message.toolCall.functionCalls) {
                this.onMessage({
                    toolCall: {
                        name: call.name,
                        args: call.args,
                        callId: call.id || `call-${Date.now()}`
                    }
                });
                this.sendToolResponse(call.id, { success: true, placeName: call.args?.name });
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
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: contextText }]
                    }
                ],
                turn_complete: true
            }
        };
        this.sendJson(message);
    }

    public sendAudio(base64Data: string) {
        if (!this.isSetupFinished || this.ws?.readyState !== WebSocket.OPEN) return;
        // console.log('[LunaLive] Sending Audio Chunk...');
        const message = {
            realtime_input: {
                media_chunks: [
                    {
                        data: base64Data,
                        mime_type: "audio/pcm;rate=16000"
                    }
                ]
            }
        };
        this.sendJson(message);
    }

    public sendVideo(base64Data: string) {
        if (!this.isSetupFinished || this.ws?.readyState !== WebSocket.OPEN) return;
        // console.log('[LunaLive] Sending Video Chunk...');
        const message = {
            realtime_input: {
                media_chunks: [
                    {
                        data: base64Data,
                        mime_type: "image/jpeg"
                    }
                ]
            }
        };
        this.sendJson(message);
    }

    public sendText(text: string) {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        const message = {
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text }]
                    }
                ],
                turn_complete: true
            }
        };
        this.sendJson(message);
    }

    public sendInterrupt() {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        // 클라이언트에서 턴을 강제로 완료하여 진행중인 모델 생성을 중단합니다.
        // 일부 API 버전에서는 비어있는 turns가 필요할 수 있습니다.
        const message = {
            client_content: {
                turns: [],
                turn_complete: true
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
