import { GoogleGenAI } from "@google/genai";

// Initialize with your key
const ai = new GoogleGenAI({ apiKey: "AIzaSyDPWghxuuy2Ji4eZnVuMX-1sWDX5UU-Lb8" });

export const transcribeCanvas = async (canvasElement: HTMLCanvasElement) => {
  // 1. Convert your existing canvas to a base64 image
  const dataUrl = canvasElement.toDataURL("image/png");
  const base64Data = dataUrl.split(",")[1];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Data } },
          { text: "Transcribe the handwriting in this image. Return only the text." }
        ],
      },
    });

    return response.text;
  } catch (error) {
    console.error("Transcription failed", error);
    return null;
  }
};