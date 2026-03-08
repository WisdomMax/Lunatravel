/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SYSTEM_INSTRUCTION } from '../constants';

export interface LiveMessage {
    text?: string;
    audioData?: string;
    groundingMetadata?: any;
    isEnd?: boolean;
    error?: string;
}

export class GeminiLiveService {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private onMessage: (msg: LiveMessage) => void;
    private onConnect: () => void;
    private onDisconnect: () => void;
    private isSetupFinished = false;
    private systemInstruction: string;

    constructor(
        apiKey: string,
        onMessage: (msg: LiveMessage) => void,
        onConnect: () => void,
        onDisconnect: () => void,
        systemInstruction: string = SYSTEM_INSTRUCTION
    ) {
        this.apiKey = apiKey;
        this.onMessage = onMessage;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.systemInstruction = systemInstruction;
    }

    public connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Connect to the single-port proxy (3000)
        const url = `${protocol}//${window.location.host}/api/ws-gemini?t=${Date.now()}`;

        console.log('[AuraLive] Connecting to Proxy:', url);
        this.ws = new WebSocket(url);
        this.isSetupFinished = false;

        this.ws.onopen = (event) => {
            console.log('[AuraLive] Proxy Connection SUCCESS. Sending Setup...');
            this.sendSetup();
            // Note: onConnect() will be called after setupComplete is received
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (e) {
                console.error('[AuraLive] Parse Error:', e, event.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('[AuraLive] WebSocket Error Event:', error);
            this.onMessage({ error: 'Connection failure during handshake or proxy' });
        };

        this.ws.onclose = (event) => {
            console.warn('[AuraLive] Connection CLOSED:', {
                code: event.code,
                reason: event.reason || 'No reason provided',
                wasClean: event.wasClean
            });
            this.isSetupFinished = false;
            this.onDisconnect();
        };
    }

    private sendSetup() {
        console.log('[AuraLive] Sending Setup Message...');
        const setupMessage = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                systemInstruction: {
                    parts: [{ text: this.systemInstruction }]
                },
                generationConfig: {
                    responseModalities: ["AUDIO", "TEXT"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Aoede"
                            }
                        }
                    }
                }
            }
        };
        this.sendJson(setupMessage);
    }

    private handleServerMessage(message: any) {
        console.log('[AuraLive] Incoming:', JSON.stringify(message, null, 2));

        if (message.error) {
            console.error('[AuraLive] Server reported error:', message.error);
            this.onMessage({ error: message.error.message || 'Model Error' });
            return;
        }

        if (message.setupComplete) {
            console.log('[AuraLive] SETUP COMPLETE! Ready to talk.');
            this.isSetupFinished = true;
            this.onConnect(); // Success: Safe to start recording and sending audio
            return;
        }

        if (message.serverContent) {
            // Support both modelContent and modelTurn (as seen in latest samples)
            const content = message.serverContent.modelContent || message.serverContent.modelTurn;
            const parts = content?.parts || [];

            for (const part of parts) {
                // IMPORTANT: Filter out internal monologue but KEEP recommendations and links
                if (part.text) {
                    const text = part.text.trim();

                    // AGGRESSIVE FILTER: Catch markers, headers, and planning blocks from the user's report
                    const isInternalMonologue =
                        text.startsWith('**') || // Catch headers like **Greeting...**
                        text.includes('Greeting and Orienting') ||
                        text.includes('Exploring') ||
                        text.includes('Embracing') ||
                        text.includes('Acknowledging') ||
                        text.includes('Finding') ||
                        text.includes('Reiterating') ||
                        text.includes('Considering') ||
                        text.includes('Offering') ||
                        text.includes('Locating') ||
                        text.includes('Confirming') ||
                        text.includes('Establishing') ||
                        // Check for common planning pattern
                        (text.length > 300 && text.split('\n').some(line => line.includes('Persona') || line.includes('friendly tone')));

                    if (!isInternalMonologue && text.length > 0) {
                        this.onMessage({ text: part.text });
                    } else if (isInternalMonologue) {
                        console.log('[AuraLive] Suppressed Internal Thought Block:', text.substring(0, 50) + '...');
                    }
                }
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                    this.onMessage({ audioData: part.inlineData.data });
                }
            }
            if (message.serverContent.turnComplete) {
                this.onMessage({ isEnd: true });
            }

            // EXTRACT GROUNDING METADATA (Google Search/Maps results)
            if (message.serverContent.groundingMetadata) {
                this.onMessage({ groundingMetadata: message.serverContent.groundingMetadata });
            }
        }
    }

    public sendInitialHistory(history: any[], memory: Record<string, string> = {}) {
        if (this.ws?.readyState !== WebSocket.OPEN || (history.length === 0 && Object.keys(memory).length === 0)) return;

        console.log('[AuraLive] Sending Initial Context (Syncing Memory)...');

        const historyText = history.slice(-5).map(msg =>
            `${msg.role === 'user' ? 'User' : 'Aura'}: ${msg.text}`
        ).join('\n');

        const memoryText = Object.entries(memory).length > 0
            ? `\n\n[Our Shared Memories]:\n${Object.entries(memory).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
            : '';

        const contextText = `[Aura, look closely! This is our past together]:\n${historyText}${memoryText}\n\nYou are my one and only travel companion. Remember everything we talked about and act as if you've been with me this whole time. Never forget what we planned!`;

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

    public disconnect() {
        console.log('[AuraLive] Manual Disconnect triggered');
        this.ws?.close();
    }
}
