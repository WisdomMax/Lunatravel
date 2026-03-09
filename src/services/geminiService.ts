/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SYSTEM_INSTRUCTION, PREFERRED_VOICE_NAME } from "../constants";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Location } from "../types";

export async function chatWithLuna(
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

    // 가장 최신이며 도구 연동이 안정적인 2.5-flash 모델 사용
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
    let text = parts.map(p => p.text || '').join('\n').trim();

    // 함수 호출을 PLACE 태그로 변환하여 텍스트에 추가 (중복 방지 강화)
    for (const part of parts) {
      if (part.functionCall && part.functionCall.name === "show_place_on_map") {
        const placeName = part.functionCall.args?.name;
        if (placeName) {
          // 텍스트 내에 이미 해당 이름이 포함된 [[PLACE: ...]] 형식이 있는지 확인 (대소문자 무시)
          const escapedName = String(placeName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const alreadyTagged = new RegExp(`\\[\\[PLACE:.*${escapedName}.*?\\]\\]`, 'i').test(text);

          if (!alreadyTagged) {
            text += `\n\n[[PLACE: ${placeName}]]`;
          }
        }
      }
    }

    // Safety: Strip any raw JSON blocks that might leak into text
    text = text.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
    text = text.replace(/\{[\s\S]*?"action_input"[\s\S]*?\}/g, '');
    text = text.replace(/\{[\s\S]*?"function_calls"[\s\S]*?\}/g, '');
    text = text.trim() || "지도에 핀을 꽂아드렸어요!";

    const toolCalls = parts.filter(p => p.functionCall).map(p => ({
      name: p.functionCall!.name,
      args: p.functionCall!.args
    }));

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    return { text, groundingMetadata, toolCalls, audioData: undefined };
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

export async function speakWithLuna(text: string): Promise<string | undefined> {
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
