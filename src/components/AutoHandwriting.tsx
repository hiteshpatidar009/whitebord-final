import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
// ⚠️ REPLACE THIS WITH YOUR ACTUAL API KEY FROM https://aistudio.google.com/app/apikey
const API_KEY = "AIzaSyCU_FAWsdnKcm_OswJHnLKwosgrgO9QjQM"; 

// --- TYPES ---
interface DetectionResult {
  text: string;
  type: 'text' | 'math' | 'diagram';
  confidence: string; // Gemini doesn't give numeric confidence, so we use descriptive
}

export default function AutoHandwritingSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 1. SETUP CANVAS ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // White background is essential for AI visibility
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineWidth = 4; // Thicker stroke for better visibility
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
      }
    }
  }, []);

  // --- 2. AI RECOGNITION (GOOGLE GEMINI) ---
  const processHandwriting = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Don't process if canvas is empty (heuristic)
    const emptyCheckCtx = canvas.getContext('2d');
    // (Simple check omitted for brevity, but you could check pixel data here)

    setIsProcessing(true);

    try {
      // 1. Get Image Data (Base64)
      // Remove the "data:image/png;base64," prefix for the API
      const base64Image = canvas.toDataURL('image/png').split(',')[1];

      // 2. Initialize Gemini
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

      // 3. Construct Prompt
      const prompt = `
        Look at this handwritten image. It could be text, a math formula, a science equation, or a diagram.
        1. Transcribe it exactly.
        2. If it is a math/science formula, convert it to clean LaTeX format or standard readable format.
        3. If it is a sentence, fix any obvious spelling errors.
        4. Return ONLY a JSON object with this structure (no markdown formatting):
        {
          "text": "The transcribed text or formula",
          "type": "text" | "math",
          "confidence": "high"
        }
      `;

      // 4. Send to AI
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/png",
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      // 5. Parse JSON Response
      // Clean up markdown code blocks if Gemini adds them
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data: DetectionResult = JSON.parse(cleanJson);

      setResult(data);
      setHistory(prev => [data.text, ...prev]);

    } catch (error) {
      console.error("AI Error:", error);
      setResult({ text: "Could not recognize writing. Check API Key.", type: 'text', confidence: 'low' });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. DRAWING HANDLERS ---
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Cancel auto-submit if user starts writing again
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    // Auto-detect after 1.5 seconds of inactivity
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      processHandwriting();
    }, 1500); 
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setResult(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-8 font-sans">
      <div className="w-full max-w-3xl space-y-6">
        
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">AI Handwriting</h1>
          <p className="text-gray-500">Write math, science, or text. AI detects it automatically.</p>
        </header>

        {/* Canvas Container */}
        <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200">
          <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="w-full h-[400px] cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              AI Analyzing...
            </div>
          )}

          {/* Tools */}
          <button 
            onClick={clearCanvas}
            className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-sm font-semibold transition-colors"
          >
            Clear Board
          </button>
        </div>

        {/* Result Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Result */}
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-gray-100 min-h-[150px] flex flex-col justify-center">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recognized Output</h2>
            {result ? (
              <div>
                <p className={`text-2xl font-medium ${result.type === 'math' ? 'font-mono text-blue-700' : 'text-gray-800'}`}>
                  {result.text}
                </p>
                <div className="mt-4 flex gap-2">
                  {result.type === 'math' && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">Math Mode</span>
                  )}
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md font-bold">
                    Confidence: {result.confidence}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-300 italic text-lg text-center">Start writing above...</p>
            )}
          </div>

          {/* History Sidebar */}
          <div className="bg-gray-900 p-6 rounded-2xl shadow-lg text-gray-300 h-[200px] overflow-hidden flex flex-col">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent History</h2>
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {history.length === 0 && <span className="text-sm opacity-50">No history yet.</span>}
              {history.map((item, i) => (
                <div key={i} className="text-sm border-l-2 border-gray-700 pl-3 py-1 hover:border-blue-500 hover:text-white transition-colors">
                  {item}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}