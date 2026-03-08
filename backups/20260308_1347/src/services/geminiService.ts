/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { Location } from "../types";

export async function chatWithAura(
  message: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  location: Location
) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  try {
    const locationContext = `[Current Location: Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}${location.name ? `, Name: ${location.name}` : ''}]`;
    const concisenessHint = "(IMPORTANT: Be brief. 1-2 sentences. Speak like a friend.)";

    // Using models/gemini-2.5-pro (SMARTEST!) for stable regular chat
    const response = await ai.models.generateContent({
      model: "models/gemini-2.5-pro",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: `${locationContext}\n${concisenessHint}\n\n${message}` }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleMaps: {} }, { googleSearch: {} }], // Enable both for better grounding
      }
    });

    const text = response.text || "I'm still here with you!";
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    return { text, groundingMetadata, audioData: undefined };
  } catch (error) {
    console.error("Error chatting with Aura:", error);

    // Final fallback
    return {
      text: "I'm having trouble connecting. Check your signal?",
      groundingChunks: [],
      audioData: undefined
    };
  }
}

export async function speakWithAura(text: string): Promise<string | undefined> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say warmly and affectionately: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Warm female voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    return undefined;
  }
}
