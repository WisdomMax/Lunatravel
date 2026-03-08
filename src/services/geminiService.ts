/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SYSTEM_INSTRUCTION, PREFERRED_VOICE_NAME } from "../constants";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Location } from "../types";

export async function chatWithAura(
  message: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  location: Location,
  persona: string = SYSTEM_INSTRUCTION
) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  try {
    const locationContext = `[Current Location: Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}${location.name ? `, Name: ${location.name}` : ''}]`;
    const concisenessHint = "(IMPORTANT: Be brief. 1-2 sentences. Speak like a friend.)";

    // Upgrade to gemini-2.5-flash as requested (Latest and Greatest)
    const response = await ai.models.generateContent({
      model: "models/gemini-2.5-flash",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: `${locationContext}\n${concisenessHint}\n\n${message}` }] }
      ],
      config: {
        systemInstruction: { parts: [{ text: persona }] },
        tools: [
          {
            functionDeclarations: [
              {
                name: "show_place_on_map",
                description: "Show a specific place on the map for the user.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "The name of the place" },
                    address: { type: Type.STRING, description: "The approximate address" }
                  },
                  required: ["name"]
                }
              }
            ]
          }
        ],
      }
    });

    console.log("Luna REST Response Raw:", JSON.stringify(response, null, 2));

    const parts = response.candidates?.[0]?.content?.parts || [];
    let text = parts.map(p => p.text || '').join('\n').trim() || "I'm still here with you!";

    // Safety: Strip any raw JSON blocks that might leak into text
    text = text.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
    text = text.replace(/\{[\s\S]*?"action_input"[\s\S]*?\}/g, '');
    text = text.replace(/\{[\s\S]*?"function_calls"[\s\S]*?\}/g, '');
    text = text.trim() || "I'm still here with you!";

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    return { text, groundingMetadata, audioData: undefined };
  } catch (error: any) {
    console.error("Error chatting with Luna (Full Details):", error);
    if (error.response) console.error("API Response Error:", error.response.data || error.response);

    // Final fallback
    return {
      text: `I'm having trouble connecting. (Error: ${error.message || 'Unknown'})`,
      groundingMetadata: undefined,
      audioData: undefined
    };
  }
}

export async function speakWithAura(text: string): Promise<string | undefined> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "models/gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say warmly and affectionately: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: PREFERRED_VOICE_NAME }, // Use centralized voice Luna
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
