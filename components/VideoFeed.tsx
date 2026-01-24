import React, { useState, useEffect } from 'react';
import { Camera, Maximize, RefreshCw, Mic, Volume2 } from 'lucide-react';
import { CameraFeed, UserRole } from '../types';

interface VideoFeedProps {
  feed: CameraFeed;
  userRole: UserRole;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ feed, userRole }) => {
  const [loading, setLoading] = useState(true);
  const [ptzActive, setPtzActive] = useState(false);

  // Simulate stream loading connection
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500 + Math.random() * 2000);
    return () => clearTimeout(timer);
  }, []);

  const canControl = userRole === UserRole.ADMIN || userRole === UserRole.OPERATOR;

  return (
    <div className="relative group bg-stone-900 border border-stone-800 rounded-lg overflow-hidden aspect-video flex flex-col shadow-lg transition-all hover:border-techno-600">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-2 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white shadow-black drop-shadow-md">{feed.name}</span>
          <span className="text-[10px] text-stone-300 font-mono">{feed.location}</span>
        </div>
        <div className="flex gap-2">
           <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${feed.protocol === 'WebRTC' ? 'bg-techno-600/20 text-techno-400 border border-techno-600/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
            {feed.protocol}
          </span>
        </div>
      </div>

      {/* Video Area */}
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
             <RefreshCw className="w-6 h-6 text-techno-600 animate-spin" />
             <span className="text-xs text-techno-600 font-mono animate-pulse">CONNECTING {feed.protocol.toUpperCase()}...</span>
          </div>
        ) : (
          <>
            <img 
              src={feed.thumbnailUrl} 
              alt={feed.name} 
              className="w-full h-full object-cover opacity-80"
            />
            
            {/* Live Indicator */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full border border-techno-600/40">
              <div className="w-2 h-2 rounded-full bg-techno-500 animate-pulse-fast"></div>
              <span className="text-[10px] font-bold text-techno-500 tracking-wider">LIVE</span>
            </div>

            {/* Simulating Motion Detection Bounding Box (Random) */}
            {feed.status === 'RECORDING' && (
               <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-techno-500/50 rounded-sm pointer-events-none opacity-40">
                  <div className="absolute -top-4 left-0 text-[10px] bg-techno-500/80 text-black px-1">MOTION 98%</div>
               </div>
            )}
            
            {/* Timestamp Overlay */}
            <div className="absolute bottom-2 right-2 text-xs font-mono text-white/90 drop-shadow-md select-none">
              {new Date().toLocaleTimeString()}
            </div>
          </>
        )}
      </div>

      {/* Controls Overlay (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-stone-900/90 backdrop-blur border-t border-stone-800 h-10 flex items-center justify-between px-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200">
        <div className="flex items-center gap-3">
            <button title="Snapshot" className="text-stone-400 hover:text-white transition-colors">
                <Camera className="w-4 h-4" />
            </button>
            <button title="Audio" className="text-stone-400 hover:text-white transition-colors">
                {userRole === UserRole.VIEWER ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
        </div>

        {canControl && (
           <div className="flex items-center gap-1">
              <button 
                onClick={() => setPtzActive(!ptzActive)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${ptzActive ? 'bg-techno-600 text-white border-techno-600' : 'text-stone-400 border-stone-600 hover:border-stone-400'}`}
              >
                PTZ
              </button>
           </div>
        )}

        <button title="Fullscreen" className="text-stone-400 hover:text-white transition-colors">
            <Maximize className="w-4 h-4" />
        </button>
      </div>
      
      {/* PTZ Controls Layer */}
      {ptzActive && canControl && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
           <div className="w-32 h-32 relative opacity-50 pointer-events-auto">
              <div className="absolute inset-x-0 top-0 h-8 flex justify-center cursor-pointer hover:bg-white/10 rounded"><div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-white mt-2"></div></div>
              <div className="absolute inset-x-0 bottom-0 h-8 flex justify-center cursor-pointer hover:bg-white/10 rounded"><div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white mb-2"></div></div>
              <div className="absolute inset-y-0 left-0 w-8 flex items-center justify-center cursor-pointer hover:bg-white/10 rounded"><div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-white ml-2"></div></div>
              <div className="absolute inset-y-0 right-0 w-8 flex items-center justify-center cursor-pointer hover:bg-white/10 rounded"><div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-white mr-2"></div></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default VideoFeed;