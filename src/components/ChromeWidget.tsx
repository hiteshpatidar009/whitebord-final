import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  Lock,
  Unlock,
  Youtube,
  Globe,
  ArrowLeft,
} from "lucide-react";

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GOOGLE_CX = import.meta.env.VITE_GOOGLE_CX;
const YT_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

type GoogleResult = {
  title: string;
  snippet: string;
  link: string;
};

type YouTubeResult = {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: { medium: { url: string } };
  };
};

interface Props {
  x: number;
  y: number;
  locked: boolean;
  onMove: (x: number, y: number) => void;
  onClose: () => void;
  onToggleLock: () => void;
}

const ChromeSearchWidget: React.FC<Props> = ({
  x,
  y,
  locked,
  onMove,
  onClose,
  onToggleLock,
}) => {
  const [mode, setMode] = useState<"google" | "youtube">("google");
  const [query, setQuery] = useState("");

  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([]);
  const [ytResults, setYtResults] = useState<YouTubeResult[]>([]);

  const [activeView, setActiveView] =
    useState<"home" | "results" | "googlePreview" | "youtubePlayer">("home");

  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  /* ================= DRAG ================= */
  const onMouseDown = (e: React.MouseEvent) => {
    if (locked) return;
    dragging.current = true;
    offset.current = { x: e.clientX - x, y: e.clientY - y };
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      onMove(e.clientX - offset.current.x, e.clientY - offset.current.y);
    };
    const up = () => (dragging.current = false);

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  }, [onMove]);

  /* ================= SEARCH ================= */
  const search = async () => {
    if (!query.trim()) return;

    setActiveView("results");
    setActiveUrl(null);
    setVideoId(null);

    if (mode === "google") {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
          query
        )}&key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&safe=active`
      );
      const data = await res.json();
      setGoogleResults(data.items || []);
    }

    if (mode === "youtube") {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
          query
        )}&key=${YT_KEY}`
      );
      const data = await res.json();
      setYtResults(data.items || []);
    }
  };

  /* ================= HOME UI ================= */
  const GoogleHome = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="text-5xl font-semibold text-blue-600 mb-4">Google</div>
      <p className="text-gray-500 max-w-md mb-2">
        Search articles, explanations, diagrams, and learning resources.
      </p>
      <p className="text-sm text-gray-400">
        Example: “photosynthesis diagram”, “Newton laws explanation”
      </p>
    </div>
  );

  const YouTubeHome = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="text-5xl font-semibold text-red-600 mb-4">YouTube</div>
      <p className="text-gray-500 max-w-md mb-2">
        Watch educational videos without leaving the classroom.
      </p>
      <p className="text-sm text-gray-400">
        Example: “solar system animation”, “trigonometry basics”
      </p>
    </div>
  );

  /* ================= RENDER ================= */
  return (
    <div
      className="absolute bg-white rounded-xl shadow-2xl border overflow-hidden"
      style={{
        left: x,
        top: y,
        width: 900,
        height: 520,
        zIndex: locked ? 5 : 50,
        pointerEvents: locked ? "none" : "auto",
      }}
    >
      {/* HEADER */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b cursor-move"
      >
        <X onClick={onClose} className="text-red-500 cursor-pointer" />

        <button
          onClick={() => {
            setMode("google");
            setActiveView("home");
          }}
        >
          <Globe size={18} className={mode === "google" ? "text-blue-600" : ""} />
        </button>

        <button
          onClick={() => {
            setMode("youtube");
            setActiveView("home");
          }}
        >
          <Youtube size={18} className={mode === "youtube" ? "text-red-600" : ""} />
        </button>

        <button onClick={onToggleLock}>
          {locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        <div className="flex items-center flex-1 gap-2 ml-2">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={
              mode === "google"
                ? "Search Google"
                : "Search YouTube videos"
            }
            className="flex-1 px-3 py-1 border rounded-full outline-none"
          />
        </div>

        {activeView !== "home" && (
          <button
            onClick={() => {
              setActiveView("home");
              setActiveUrl(null);
              setVideoId(null);
            }}
            className="ml-2 flex items-center gap-1 text-sm text-blue-600"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>

      {/* BODY */}
      <div className="h-[calc(100%-44px)]">
        {/* GOOGLE PAGE PREVIEW */}
        {activeView === "googlePreview" && activeUrl && (
          <iframe
            src={activeUrl}
            className="w-full h-full"
            sandbox="allow-scripts allow-forms allow-same-origin"
            referrerPolicy="no-referrer"
            title="Google Preview"
          />
        )}

        {/* YOUTUBE PLAYER */}
        {activeView === "youtubePlayer" && videoId && (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&fs=0`}
            allow="autoplay; encrypted-media; picture-in-picture"
            title="YouTube Player"
          />
        )}

        {/* HOME */}
        {activeView === "home" &&
          (mode === "google" ? <GoogleHome /> : <YouTubeHome />)}

        {/* RESULTS */}
        {activeView === "results" && (
          <div className="p-4 overflow-y-auto h-full">
            {mode === "google" &&
              googleResults.map((r, i) => (
                <div key={i} className="mb-4">
                  <button
                    onClick={() => {
                      setActiveUrl(r.link);
                      setActiveView("googlePreview");
                    }}
                    className="text-blue-600 font-medium hover:underline text-left"
                  >
                    {r.title}
                  </button>
                  <p className="text-sm text-gray-600">{r.snippet}</p>
                </div>
              ))}

            {mode === "youtube" &&
              ytResults.map((v) => (
                <div
                  key={v.id.videoId}
                  onClick={() => {
                    setVideoId(v.id.videoId);
                    setActiveView("youtubePlayer");
                  }}
                  className="flex gap-3 mb-3 cursor-pointer"
                >
                  <img
                    src={v.snippet.thumbnails.medium.url}
                    className="w-40 rounded"
                  />
                  <p className="text-sm font-medium">
                    {v.snippet.title}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChromeSearchWidget;
