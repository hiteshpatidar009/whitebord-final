
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const transcribeHandwriting = async (base64Image: string): Promise<string> => {
  try {
    const ai = getAIClient();
    
    // Clean up base64 string
    const base64Data = base64Image.split(',')[1] || base64Image;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
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
