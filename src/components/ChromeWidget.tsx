import React, { useEffect, useRef, useState } from "react";
import {
  // Search,
  X,
  Lock,
  Unlock,
  Youtube,
  Globe,
  ArrowLeft,
  AlertTriangle,
  WifiOff,
  CreditCard,
  Key,
  // ShieldAlert,
  RefreshCw,
  SearchX,
  AlertCircle,
  ShieldOff,
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

type SearchError = {
  type: 
    | 'NETWORK_ERROR' 
    | 'QUOTA_EXCEEDED' 
    | 'API_CREDIT_FINISHED' 
    | 'INVALID_API_KEY'
    | 'ZERO_RESULTS'
    | 'UNKNOWN_ERROR'
    | 'API_NOT_CONFIGURED';
  message: string;
  recoverable: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
};

type SearchState = 
  | 'IDLE'
  | 'LOADING'
  | 'SUCCESS'
  | 'ERROR';

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
  const [searchState, setSearchState] = useState<SearchState>('IDLE');
  const [error, setError] = useState<SearchError | null>(null);

  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([]);
  const [ytResults, setYtResults] = useState<YouTubeResult[]>([]);

  const [activeView, setActiveView] =
    useState<"home" | "results" | "googlePreview" | "youtubePlayer" | "error">("home");

  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);
  const [size, setSize] = useState({ width: 900, height: 520 });

  /* ================= DRAG ================= */
  const onMouseDown = (e: React.MouseEvent) => {
    if (locked) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    dragging.current = true;
    offset.current = { x: e.clientX - x, y: e.clientY - y };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (locked) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    const touch = e.touches[0];
    dragging.current = true;
    offset.current = { x: touch.clientX - x, y: touch.clientY - y };
  };

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      if (dragging.current) {
        onMove(clientX - offset.current.x, clientY - offset.current.y);
      }
      if (resizing.current) {
        const newWidth = Math.max(600, clientX - x);
        const newHeight = Math.max(400, clientY - y);
        setSize({ width: newWidth, height: newHeight });
      }
    };
    const up = () => {
      dragging.current = false;
      resizing.current = false;
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", move);
    document.addEventListener("touchend", up);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
    };
  }, [onMove, x, y]);

  /* ================= ERROR HANDLING ================= */
  const handleSearchError = (errorType: SearchError['type']): SearchError => {
    const errors: Record<SearchError['type'], SearchError> = {
      NETWORK_ERROR: {
        type: 'NETWORK_ERROR',
        message: "Cannot connect to search service. Please check your internet connection and try again.",
        recoverable: true,
        action: {
          label: "Retry Connection",
          handler: () => {
            if (navigator.onLine) {
              search();
            }
          }
        }
      },
      QUOTA_EXCEEDED: {
        type: 'QUOTA_EXCEEDED',
        message: "Daily search limit has been reached. The search quota will reset at midnight (Pacific Time).",
        recoverable: false
      },
      API_CREDIT_FINISHED: {
        type: 'API_CREDIT_FINISHED',
        message: "Search API credits have been exhausted. Please contact your administrator to add more credits to continue using this service.",
        recoverable: false
      },
      INVALID_API_KEY: {
        type: 'INVALID_API_KEY',
        message: "Invalid API configuration detected. The search service cannot be accessed with the current settings.",
        recoverable: false,
        action: {
          label: "Check Configuration",
          handler: () => {
            // Could open a settings modal or documentation
            alert("Please verify your API keys in the environment configuration:\n\n" +
                  `Google API Key: ${GOOGLE_KEY ? '✓ Configured' : '✗ Missing'}\n` +
                  `Google CX: ${GOOGLE_CX ? '✓ Configured' : '✗ Missing'}\n` +
                  `YouTube API Key: ${YT_KEY ? '✓ Configured' : '✗ Missing'}`);
          }
        }
      },
      API_NOT_CONFIGURED: {
        type: 'API_NOT_CONFIGURED',
        message: "Search service is not configured. Please set up API keys to enable search functionality.",
        recoverable: false,
        action: {
          label: "Setup Instructions",
          handler: () => {
            window.open("https://developers.google.com/custom-search/v1/overview", "_blank");
          }
        }
      },
      ZERO_RESULTS: {
        type: 'ZERO_RESULTS',
        message: `No results found for "${query}". Try using different keywords, check your spelling, or broaden your search terms.`,
        recoverable: true,
        action: {
          label: "Modify Search",
          handler: () => {
            setActiveView("home");
          }
        }
      },
      UNKNOWN_ERROR: {
        type: 'UNKNOWN_ERROR',
        message: "An unexpected error occurred while searching. The service might be temporarily unavailable.",
        recoverable: true,
        action: {
          label: "Try Again",
          handler: () => {
            search();
          }
        }
      }
    };

    return errors[errorType];
  };

  /* ================= VALIDATE API CONFIG ================= */
  const validateApiConfig = (): boolean => {
    console.log('Validating API config:', {
      mode,
      GOOGLE_KEY: GOOGLE_KEY ? 'Present' : 'Missing',
      GOOGLE_CX: GOOGLE_CX ? 'Present' : 'Missing', 
      YT_KEY: YT_KEY ? 'Present' : 'Missing'
    });
    
    if (mode === 'google') {
      if (!GOOGLE_KEY || !GOOGLE_CX) {
        console.error('Google API config missing:', { GOOGLE_KEY: !!GOOGLE_KEY, GOOGLE_CX: !!GOOGLE_CX });
        setError(handleSearchError('API_NOT_CONFIGURED'));
        return false;
      }
    }
    if (mode === 'youtube') {
      if (!YT_KEY) {
        console.error('YouTube API key missing');
        setError(handleSearchError('API_NOT_CONFIGURED'));
        return false;
      }
    }
    return true;
  };

  /* ================= SEARCH ================= */
  const search = async () => {
    if (!query.trim()) return;

    // Validate API config first
    if (!validateApiConfig()) {
      setSearchState('ERROR');
      setActiveView('error');
      return;
    }

    setSearchState('LOADING');
    setError(null);
    setActiveView('results');
    setActiveUrl(null);
    setVideoId(null);

    try {
      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('NETWORK_ERROR');
      }

      if (mode === "google") {
        const res = await fetch(
          `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
            query
          )}&key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&safe=active`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('Google API Error:', {
            status: res.status,
            statusText: res.statusText,
            errorData,
            url: res.url
          });
          
          if (res.status === 403) {
            if (errorData.error?.message?.includes('quota') || 
                errorData.error?.message?.includes('exceeded')) {
              throw new Error('QUOTA_EXCEEDED');
            }
            if (errorData.error?.message?.includes('invalid') ||
                errorData.error?.message?.includes('forbidden')) {
              throw new Error('INVALID_API_KEY');
            }
          }
          
          if (res.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          }
          
          if (res.status === 400 || res.status === 401) {
            throw new Error('INVALID_API_KEY');
          }
          
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        
        if (!data.items || data.items.length === 0) {
          throw new Error('ZERO_RESULTS');
        }
        
        setGoogleResults(data.items);
        setYtResults([]);
        setSearchState('SUCCESS');
      }

      if (mode === "youtube") {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
            query
          )}&key=${YT_KEY}`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          
          if (res.status === 403) {
            if (errorData.error?.message?.includes('quota') ||
                errorData.error?.message?.includes('exceeded')) {
              throw new Error('QUOTA_EXCEEDED');
            }
            if (errorData.error?.message?.includes('disabled') ||
                errorData.error?.message?.includes('billing')) {
              throw new Error('API_CREDIT_FINISHED');
            }
            if (errorData.error?.message?.includes('forbidden')) {
              throw new Error('INVALID_API_KEY');
            }
          }
          
          if (res.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          }
          
          if (res.status === 400 || res.status === 401) {
            throw new Error('INVALID_API_KEY');
          }
          
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        
        if (!data.items || data.items.length === 0) {
          throw new Error('ZERO_RESULTS');
        }
        
        setYtResults(data.items);
        setGoogleResults([]);
        setSearchState('SUCCESS');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchState('ERROR');
      
      let errorType: SearchError['type'] = 'UNKNOWN_ERROR';
      
      if (err instanceof Error) {
        if (err.message === 'NETWORK_ERROR') errorType = 'NETWORK_ERROR';
        else if (err.message === 'QUOTA_EXCEEDED') errorType = 'QUOTA_EXCEEDED';
        else if (err.message === 'API_CREDIT_FINISHED') errorType = 'API_CREDIT_FINISHED';
        else if (err.message === 'INVALID_API_KEY') errorType = 'INVALID_API_KEY';
        else if (err.message === 'ZERO_RESULTS') errorType = 'ZERO_RESULTS';
        else if (err.message.includes('HTTP')) errorType = 'UNKNOWN_ERROR';
      }
      
      const searchError = handleSearchError(errorType);
      setError(searchError);
      setActiveView('error');
      
      // Clear any previous results
      setGoogleResults([]);
      setYtResults([]);
    }
  };

  /* ================= ERROR UI COMPONENT ================= */
  const ErrorView = () => (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 p-4 rounded-full" style={{
        backgroundColor: error?.type === 'ZERO_RESULTS' ? '#FEF3C7' :
                        error?.type === 'NETWORK_ERROR' ? '#FEF3C7' :
                        error?.type === 'QUOTA_EXCEEDED' ? '#FEE2E2' :
                        error?.type === 'API_CREDIT_FINISHED' ? '#FEE2E2' :
                        error?.type === 'INVALID_API_KEY' ? '#FEF3C7' :
                        '#F3F4F6'
      }}>
        {error?.type === 'NETWORK_ERROR' && <WifiOff className="w-16 h-16 text-amber-500" />}
        {error?.type === 'QUOTA_EXCEEDED' && <CreditCard className="w-16 h-16 text-red-500" />}
        {error?.type === 'API_CREDIT_FINISHED' && <ShieldOff className="w-16 h-16 text-red-500" />}
        {error?.type === 'INVALID_API_KEY' && <Key className="w-16 h-16 text-amber-500" />}
        {error?.type === 'API_NOT_CONFIGURED' && <AlertCircle className="w-16 h-16 text-amber-500" />}
        {error?.type === 'ZERO_RESULTS' && <SearchX className="w-16 h-16 text-amber-500" />}
        {error?.type === 'UNKNOWN_ERROR' && <AlertTriangle className="w-16 h-16 text-gray-500" />}
      </div>
      
      <h3 className="text-2xl font-semibold text-gray-800 mb-3">
        {error?.type === 'NETWORK_ERROR' && 'Connection Issue'}
        {error?.type === 'QUOTA_EXCEEDED' && 'Search Limit Reached'}
        {error?.type === 'API_CREDIT_FINISHED' && 'Service Unavailable'}
        {error?.type === 'INVALID_API_KEY' && 'Configuration Error'}
        {error?.type === 'API_NOT_CONFIGURED' && 'Service Not Configured'}
        {error?.type === 'ZERO_RESULTS' && 'No Results Found'}
        {error?.type === 'UNKNOWN_ERROR' && 'Search Error'}
      </h3>
      
      <p className="text-gray-600 max-w-md mb-6 leading-relaxed">
        {error?.message}
      </p>
      
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => {
            setActiveView('home');
            setError(null);
          }}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
        >
          Back to Home
        </button>
        
        {error?.recoverable && error?.action && (
          <button
            onClick={error.action.handler}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {error.action.label}
          </button>
        )}
        
        {!error?.recoverable && error?.action && (
          <button
            onClick={error.action.handler}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            {error.action.label}
          </button>
        )}
      </div>
      
      {/* Additional helpful info */}
      <div className="mt-8 pt-6 border-t border-gray-200 w-full max-w-md">
        <p className="text-sm text-gray-500">
          {error?.type === 'NETWORK_ERROR' && "Check your internet connection and firewall settings."}
          {error?.type === 'QUOTA_EXCEEDED' && "This is a daily limit. It will automatically reset at midnight."}
          {error?.type === 'API_CREDIT_FINISHED' && "Contact support@example.com for assistance with API credits."}
          {error?.type === 'INVALID_API_KEY' && "Ensure your API keys are correctly set in the environment variables."}
          {error?.type === 'API_NOT_CONFIGURED' && "Set VITE_GOOGLE_API_KEY and VITE_YOUTUBE_API_KEY in your .env file."}
          {error?.type === 'ZERO_RESULTS' && "Try using more general terms or different keywords."}
          {error?.type === 'UNKNOWN_ERROR' && "Please try again in a few minutes."}
        </p>
      </div>
    </div>
  );

  /* ================= HOME SCREENS ================= */
  const GoogleHome = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-10 bg-gradient-to-br from-white to-blue-50">
      <div className="text-6xl font-semibold tracking-tight text-blue-600 mb-6">
        Google
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        {!GOOGLE_KEY || !GOOGLE_CX ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">API not configured</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">Search ready</span>
          </div>
        )}
      </div>

      <p className="text-gray-600 text-lg max-w-xl leading-relaxed">
        Search trusted educational content, explanations, diagrams, and
        reference material — all without leaving the whiteboard.
      </p>

      <div className="mt-8 text-sm text-gray-400">
        Suggested searches:
        <div className="mt-2 flex gap-3 justify-center flex-wrap">
          <button 
            onClick={() => {
              setQuery("Photosynthesis diagram");
              search();
            }}
            className="px-3 py-1 bg-white hover:bg-blue-50 rounded-full shadow-sm transition-colors"
            disabled={!GOOGLE_KEY || !GOOGLE_CX}
          >
            Photosynthesis diagram
          </button>
          <button 
            onClick={() => {
              setQuery("Newton's laws");
              search();
            }}
            className="px-3 py-1 bg-white hover:bg-blue-50 rounded-full shadow-sm transition-colors"
            disabled={!GOOGLE_KEY || !GOOGLE_CX}
          >
            Newton's laws
          </button>
          <button 
            onClick={() => {
              setQuery("Human heart labeled");
              search();
            }}
            className="px-3 py-1 bg-white hover:bg-blue-50 rounded-full shadow-sm transition-colors"
            disabled={!GOOGLE_KEY || !GOOGLE_CX}
          >
            Human heart labeled
          </button>
        </div>
      </div>
      
      {(!GOOGLE_KEY || !GOOGLE_CX) && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-amber-800">Setup Required</p>
              <p className="text-sm text-amber-700 mt-1">
                Google Search API is not configured. Add your API keys to enable search functionality.
              </p>
              <button
                onClick={() => {
                  console.log('Current API Keys:', {
                    GOOGLE_KEY: GOOGLE_KEY || 'Not set',
                    GOOGLE_CX: GOOGLE_CX || 'Not set'
                  });
                  alert(`API Key Status:\nGoogle API Key: ${GOOGLE_KEY ? 'Set' : 'Missing'}\nGoogle CX: ${GOOGLE_CX ? 'Set' : 'Missing'}`);
                }}
                className="mt-2 text-xs bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
              >
                Check Current Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const YouTubeHome = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-10 bg-gradient-to-br from-white to-red-50">
      <div className="text-6xl font-semibold tracking-tight text-red-600 mb-6">
        YouTube
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        {!YT_KEY ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">API not configured</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <Youtube className="w-4 h-4" />
            <span className="text-sm font-medium">Video search ready</span>
          </div>
        )}
      </div>

      <p className="text-gray-600 text-lg max-w-xl leading-relaxed">
        Watch curated educational videos directly inside your classroom —
        distraction-free and fullscreen-safe.
      </p>

      <div className="mt-8 text-sm text-gray-400">
        Popular topics:
        <div className="mt-2 flex gap-3 justify-center flex-wrap">
          <button 
            onClick={() => {
              setQuery("Solar system animation");
              search();
            }}
            className="px-3 py-1 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors"
            disabled={!YT_KEY}
          >
            Solar system animation
          </button>
          <button 
            onClick={() => {
              setQuery("Trigonometry basics");
              search();
            }}
            className="px-3 py-1 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors"
            disabled={!YT_KEY}
          >
            Trigonometry basics
          </button>
          <button 
            onClick={() => {
              setQuery("Cell division mitosis");
              search();
            }}
            className="px-3 py-1 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors"
            disabled={!YT_KEY}
          >
            Cell division mitosis
          </button>
        </div>
      </div>
      
      {!YT_KEY && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-amber-800">Setup Required</p>
              <p className="text-sm text-amber-700 mt-1">
                YouTube Data API is not configured. Add your API key to enable video search.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ================= RESULTS UI ================= */
  const ResultsView = () => (
    <div className="p-4 overflow-y-auto h-full">
      {searchState === 'LOADING' && (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <span className="text-gray-600">Searching for "{query}"...</span>
          <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
        </div>
      )}
      
      {searchState === 'SUCCESS' && mode === "google" && (
        <>
          <div className="mb-4 px-2">
            <p className="text-sm text-gray-600">
              Found {googleResults.length} result{googleResults.length !== 1 ? 's' : ''} for "{query}"
            </p>
          </div>
          {googleResults.map((r, i) => (
            <div key={i} className="mb-4 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
              <button
                onClick={() => {
                  setActiveUrl(r.link);
                  setActiveView("googlePreview");
                }}
                className="text-blue-600 font-medium hover:underline text-left mb-1 block w-full "
              >
                {r.title}
              </button>
              <p className="text-sm text-gray-600 mb-2">{r.snippet}</p>
              <p className="text-xs text-gray-400 truncate">{r.link}</p>
            </div>
          ))}
        </>
      )}
      
      {searchState === 'SUCCESS' && mode === "youtube" && (
        <>
          <div className="mb-4 px-2">
            <p className="text-sm text-gray-600">
              Found {ytResults.length} video{ytResults.length !== 1 ? 's' : ''} for "{query}"
            </p>
          </div>
          {ytResults.map((v) => (
            <div
              key={v.id.videoId}
              onClick={() => {
                setVideoId(v.id.videoId);
                setActiveView("youtubePlayer");
              }}
              className="flex gap-3 mb-4 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer border border-gray-100"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={v.snippet.thumbnails.medium.url}
                  className="w-40 rounded"
                  alt={v.snippet.title}
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-2 line-clamp-2">{v.snippet.title}</p>
                <div className="text-xs text-gray-500">
                  Click to play in classroom mode
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  /* ================= EMPTY STATE ================= */
  const EmptyResultsView = () => (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <SearchX className="w-20 h-20 text-gray-300 mb-4" />
      <p className="text-gray-500">No search results to display</p>
      <p className="text-sm text-gray-400 mt-2">Enter a search query to begin</p>
    </div>
  );

  /* ================= RENDER ================= */
  return (
    <div
      className="absolute bg-white rounded-2xl shadow-2xl border overflow-hidden"
      style={{
        left: x,
        top: y,
        width: size.width,
        height: size.height,
        zIndex: locked ? 5 : 50,
        pointerEvents: locked ? "none" : "auto",
      }}
    >
      {/* HEADER */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur border-b shadow-sm cursor-move"
      >
        <button
          onClick={onClose} 
          className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors" 
          title="Close widget"
        >
          <X size={20} />
        </button>

        <button
          onClick={() => {
            setMode("google");
            setActiveView("home");
            setError(null);
          }}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title="Google Search"
        >
          <Globe
            size={18}
            className="text-blue-600 focus:ring-2 focus:ring-blue-400"
          />
        </button>

        <button
          onClick={() => {
            setMode("youtube");
            setActiveView("home");
            setError(null);
          }}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title="YouTube Search"
        >
          <Youtube
            size={18}
            className="text-red-600"
          />
        </button>

        <button 
          onClick={onToggleLock}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title={locked ? "Unlock widget" : "Lock widget"}
        >
          {locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        <div className="flex items-center flex-1 gap-2 ml-3">
          {/* <Search size={16} className="text-gray-400" /> */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={
              mode === "google"
                ? "Search Google"
                : "Search YouTube videos"
            }
            disabled={searchState === 'LOADING' || (!GOOGLE_KEY && mode === 'google') || (!YT_KEY && mode === 'youtube')}
            className="flex-1 px-4 py-2 border rounded-full outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500 transition-all"
          />
          {searchState === 'LOADING' && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          )}
        </div>

        {activeView !== "home" && activeView !== 'error' && (
          <button
            onClick={() => {
              if (activeView === "results") {
                setActiveView("home");
              } else {
                setActiveView("results");
              }
              setActiveUrl(null);
              setVideoId(null);
              setError(null);
            }}
            className="ml-2 flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>

      {/* BODY */}
      <div className="h-[calc(100%-56px)]">
        {activeView === "home" &&
          (mode === "google" ? <GoogleHome /> : <YouTubeHome />)}

        {activeView === "googlePreview" && activeUrl && (
          <div className="  w-full h-full flex flex-col">
            {/* <div className="p-2 border-b absolute top-3 left-36  flex justify-end">
              <span className="text-sm text-gray-600 truncate flex-1 mr-2">
                Preview: {new URL(activeUrl).hostname}
              </span>
              <button
                onClick={() => setActiveView("results")}
                className="text-sm text-blue-600  hover:underline whitespace-nowrap"
              >
                ← 
              </button>
            </div> */}
            <iframe
              src={activeUrl}
              className="w-full flex-1"
              sandbox="allow-scripts allow-forms allow-same-origin"
              referrerPolicy="no-referrer"
              title="Google Preview"
            />
          </div>
        )}

        {activeView === "youtubePlayer" && videoId && (
          <div className="w-full h-full flex flex-col">
            {/* <div className="p-2 border-b bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600 truncate flex-1 mr-2">
                Educational Video Player
              </span>
              <button
                onClick={() => setActiveView("results")}
                className="text-sm text-blue-600 hover:underline whitespace-nowrap"
              >
                ← Back to videos
              </button>
            </div> */}
            <iframe
              className="w-full flex-1"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&fs=1`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              title="YouTube Player"
              allowFullScreen
            />
          </div>
        )}

        {activeView === "results" && (
          <>
            {searchState === 'SUCCESS' && (
              (mode === 'google' && googleResults.length > 0) || 
              (mode === 'youtube' && ytResults.length > 0) ? (
                <ResultsView />
              ) : (
                <EmptyResultsView />
              )
            )}
            {searchState === 'LOADING' && <ResultsView />}
          </>
        )}
        
        {activeView === "error" && <ErrorView />}
      </div>
      
      {/* Resize handle */}
      <div
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={(e) => {
          e.stopPropagation();
          resizing.current = true;
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resizing.current = true;
        }}
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #cbd5e0 50%)',
        }}
      />
    </div>
  );
};

export default ChromeSearchWidget;