
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const transcribeHandwriting = async (base64Data: string): Promise<string> => {
  try {
    const ai = getAIClient();
    
    // Ensure we have clean base64 data (no data URL prefix)
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: "Analyze the handwriting in this image. It could be text, numbers, or a short note. Convert it to digital text perfectly. Return ONLY the transcribed text. If the image is blank or has no clear writing, return 'No handwriting detected'.",
          },
        ],
      },
      config: {
        temperature: 0.1,
        topP: 0.95,
      }
    });

    const resultText = response.text || "";
    return resultText.trim() || "No handwriting detected";
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw new Error("API Connection Failed. Please ensure your environment has a valid API Key.");
  }
};
