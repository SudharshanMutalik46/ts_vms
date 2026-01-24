import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid,
  Settings,
  LogOut,
  Bell,
  Search,
  Cpu,
  Activity,
  Shield,
  User as UserIcon,
  ChevronDown,
  Menu,
  Camera,
  BrainCircuit,
  Users,
  MapPin,
  Plus,
  Wifi,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Save,
  Move,
  ScanLine,
  ShieldAlert,
  Car,
  ScanFace,
  Flame,
  Siren,
  Fingerprint,
  CheckSquare,
  Square,
  X,
  Sliders,
  Target,
  MousePointer2,
  AlertTriangle,
  Eye,
  BarChart3,
  TrendingUp,
  Clock,
  Calendar,
  PieChart,
  Download
} from 'lucide-react';
import { User, UserRole, CameraFeed, AiConfig, AIEvent } from '../types';
import VideoFeed from './VideoFeed';
import AuthenticatedImage from './AuthenticatedImage';
import { analyzeSystemStatus } from '../services/geminiService';
import { fetchAIEvents, getSnapshotUrl } from '../services/apiService';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const INITIAL_FEEDS: CameraFeed[] = [
  { id: '1', name: 'Main Entrance', location: 'Building A - Ext', status: 'RECORDING', protocol: 'WebRTC', thumbnailUrl: 'https://picsum.photos/800/450?random=1' },
  { id: '2', name: 'Lobby North', location: 'Building A - Int', status: 'ONLINE', protocol: 'HLS', thumbnailUrl: 'https://picsum.photos/800/450?random=2' },
  { id: '3', name: 'Warehouse Dock', location: 'Building B - Ext', status: 'RECORDING', protocol: 'WebRTC', thumbnailUrl: 'https://picsum.photos/800/450?random=3' },
  { id: '4', name: 'Server Room', location: 'Building A - Secure', status: 'ONLINE', protocol: 'RTSP', thumbnailUrl: 'https://picsum.photos/800/450?random=4' },
];

const AI_FEATURES = [
  { id: 'people', name: 'People Counting', description: 'Real-time crowd analysis and footfall counting.', icon: Users },
  { id: 'motion', name: 'Motion Detection', description: 'Detects movement in static zones.', icon: Move },
  { id: 'border', name: 'Border Crossing', description: 'Alerts when line boundaries are crossed.', icon: ScanLine },
  { id: 'intrusion', name: 'Intrusion Detection', description: 'Secure zone breach monitoring.', icon: ShieldAlert },
  { id: 'parking', name: 'Illegal Parking', description: 'Detects unauthorized vehicle stops.', icon: Car },
  { id: 'face', name: 'Face Recognition', description: 'Tracking, attendance, and behavior analysis.', icon: ScanFace },
  { id: 'fire', name: 'Fire / Flame Detection', description: 'Thermal and visual fire identification.', icon: Flame },
  { id: 'traffic', name: 'Traffic Violations', description: 'Wrong way, speeding, and illegal turns.', icon: Siren },
  { id: 'criminal', name: 'Criminal Activity', description: 'Behavior correlation and threat prediction.', icon: Fingerprint },
];

// Mock Chart Data for Analytics View
const ANALYTICS_DATA = [
  { time: '00:30', value: 4200 },
  { time: '01:30', value: 4200 },
  { time: '02:30', value: 4350 },
  { time: '03:30', value: 2700 },
  { time: '04:30', value: 5100 },
  { time: '05:30', value: 4500 },
  { time: '06:30', value: 2800 },
  { time: '07:30', value: 1200 },
  { time: '08:30', value: 4800 },
  { time: '09:30', value: 3500 },
  { time: '10:30', value: 1500 },
  { time: '11:30', value: 4500 },
  { time: '12:30', value: 3800 },
  { time: '13:30', value: 4400 },
];

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'LIVE' | 'PLAYBACK' | 'AI_MONITOR' | 'AI_EVENTS' | 'CAMERAS' | 'AI_MODULES' | 'USERS' | 'SITES'>('LIVE');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [feeds, setFeeds] = useState<CameraFeed[]>(INITIAL_FEEDS);

  // View State
  const [gridSize, setGridSize] = useState<number>(4);

  // AI Configuration State
  const [selectedAiModule, setSelectedAiModule] = useState<any | null>(null);
  const [configuringCamera, setConfiguringCamera] = useState<CameraFeed | null>(null);
  const [activeAiConfigs, setActiveAiConfigs] = useState<AiConfig[]>([]);

  // Analytics Detail State
  const [detailViewId, setDetailViewId] = useState<string | null>(null);

  // Temp config state for the modal
  const [tempConfig, setTempConfig] = useState({
    sensitivity: 75,
    threshold: 80,
    alertPriority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    drawZone: false
  });

  // AI Events State
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  const [aiEventsLoading, setAiEventsLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  // Add Camera State
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: '',
    location: '',
    url: '',
    username: '',
    password: '',
    protocol: 'RTSP'
  });
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CHECKING' | 'SUCCESS' | 'ERROR'>('IDLE');

  const handleCheckConnection = () => {
    if (!newCamera.url) {
      setConnectionStatus('ERROR');
      return;
    }
    setConnectionStatus('CHECKING');
    setTimeout(() => {
      setConnectionStatus('SUCCESS');
    }, 2000);
  };

  const handleSaveCamera = () => {
    if (connectionStatus !== 'SUCCESS') return;
    const newFeed: CameraFeed = {
      id: Date.now().toString(),
      name: newCamera.name || `Camera ${feeds.length + 1}`,
      location: newCamera.location || 'Default Location',
      status: 'ONLINE',
      protocol: newCamera.protocol as any,
      thumbnailUrl: `https://picsum.photos/800/450?random=${Date.now()}`
    };
    setFeeds([...feeds, newFeed]);
    setIsAddingCamera(false);
    setNewCamera({ name: '', location: '', url: '', username: '', password: '', protocol: 'RTSP' });
    setConnectionStatus('IDLE');
  };

  const handleStartConfig = (camera: CameraFeed) => {
    // Check if config exists
    const existing = activeAiConfigs.find(c => c.moduleId === selectedAiModule.id && c.cameraId === camera.id);
    if (existing) {
      setTempConfig(existing.parameters);
    } else {
      setTempConfig({
        sensitivity: 75,
        threshold: 80,
        alertPriority: 'MEDIUM',
        drawZone: false
      });
    }
    setConfiguringCamera(camera);
  };

  const handleSaveAiConfig = () => {
    if (!selectedAiModule || !configuringCamera) return;

    const newConfig: AiConfig = {
      id: `${selectedAiModule.id}-${configuringCamera.id}`,
      moduleId: selectedAiModule.id,
      moduleName: selectedAiModule.name,
      cameraId: configuringCamera.id,
      active: true,
      parameters: { ...tempConfig }
    };

    setActiveAiConfigs(prev => {
      // Remove existing if any, then add new
      const filtered = prev.filter(c => c.id !== newConfig.id);
      return [...filtered, newConfig];
    });

    setConfiguringCamera(null);
    setSelectedAiModule(null);
    setActiveTab('AI_MONITOR'); // Redirect to AI Viewer
  };

  // Load AI Events from API
  const loadAIEvents = async () => {
    setAiEventsLoading(true);
    try {
      const result = await fetchAIEvents({ limit: 50 });
      if (result && result.events) {
        setAiEvents(result.events);
      } else {
        // Fallback to mock data for demo
        setAiEvents([
          { id: '1', camera_id: '1', camera_name: 'Main Entrance', event_type: 'MOTION', confidence: 0.95, event_time: new Date().toISOString(), status: 'COMPLETED', has_clip: false, clip_url: null, has_snapshot: true, snapshot_url: '/api/ai/events/1/snapshot', created_at: new Date().toISOString() },
          { id: '2', camera_id: '2', camera_name: 'Lobby North', event_type: 'PERSON', confidence: 0.87, event_time: new Date(Date.now() - 60000).toISOString(), status: 'COMPLETED', has_clip: true, clip_url: '/api/ai/events/2/clip', has_snapshot: true, snapshot_url: '/api/ai/events/2/snapshot', created_at: new Date().toISOString() },
          { id: '3', camera_id: '3', camera_name: 'Warehouse Dock', event_type: 'VEHICLE', confidence: 0.92, event_time: new Date(Date.now() - 120000).toISOString(), status: 'PENDING', has_clip: false, clip_url: null, has_snapshot: false, snapshot_url: null, created_at: new Date().toISOString() },
        ]);
      }
    } catch (error) {
      console.error('Failed to load AI events:', error);
    } finally {
      setAiEventsLoading(false);
    }
  };

  // Render SVG Line Chart
  const renderLineChart = () => {
    const height = 200;
    const width = 600;
    const padding = 20;
    const maxValue = Math.max(...ANALYTICS_DATA.map(d => d.value)) * 1.2;

    // Generate points
    const points = ANALYTICS_DATA.map((d, i) => {
      const x = padding + (i * ((width - 2 * padding) / (ANALYTICS_DATA.length - 1)));
      const y = height - padding - ((d.value / maxValue) * (height - 2 * padding));
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = height - padding - (tick * (height - 2 * padding));
          return (
            <g key={tick}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#333" strokeDasharray="4 4" strokeWidth="1" />
              <text x={0} y={y + 4} fill="#666" fontSize="10" textAnchor="start">{Math.round(tick * maxValue)}</text>
            </g>
          )
        })}

        {/* The Line */}
        <polyline
          fill="none"
          stroke="#22c55e" // Green
          strokeWidth="3"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
        />

        {/* Data Points */}
        {ANALYTICS_DATA.map((d, i) => {
          const x = padding + (i * ((width - 2 * padding) / (ANALYTICS_DATA.length - 1)));
          const y = height - padding - ((d.value / maxValue) * (height - 2 * padding));
          return (
            <g key={i} className="group">
              <circle cx={x} cy={y} r="4" fill="#000" stroke="#22c55e" strokeWidth="2" className="group-hover:r-6 transition-all" />
              {/* Tooltip on hover */}
              <text x={x} y={y - 12} fill="#22c55e" fontSize="12" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold">{d.value}</text>
              {/* X Axis Labels */}
              {i % 2 === 0 && (
                <text x={x} y={height} fill="#9ca3af" fontSize="10" textAnchor="middle">{d.time}</text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 flex overflow-hidden font-sans relative">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-stone-900 border-r border-stone-800 transition-all duration-300 flex flex-col z-20`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-stone-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <span className="font-bold text-lg tracking-tight text-techno-600">techno</span>
                <span className="font-bold text-lg tracking-tight text-techno-600">support</span>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-stone-800 rounded text-stone-400">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto">
          <NavItem icon={<Grid size={20} />} label="Live View" active={activeTab === 'LIVE'} onClick={() => setActiveTab('LIVE')} collapsed={!sidebarOpen} />
          <NavItem icon={<Activity size={20} />} label="Playback" active={activeTab === 'PLAYBACK'} onClick={() => setActiveTab('PLAYBACK')} collapsed={!sidebarOpen} />

          <div className="my-1 border-t border-stone-800 mx-2 opacity-50" />

          <NavItem icon={<BrainCircuit size={20} />} label="AI Modules" active={activeTab === 'AI_MODULES'} onClick={() => setActiveTab('AI_MODULES')} collapsed={!sidebarOpen} />
          <NavItem icon={<Eye size={20} />} label="AI Monitor" active={activeTab === 'AI_MONITOR'} onClick={() => { setActiveTab('AI_MONITOR'); setDetailViewId(null); }} collapsed={!sidebarOpen} />
          <NavItem icon={<Bell size={20} />} label="AI Events" active={activeTab === 'AI_EVENTS'} onClick={() => { setActiveTab('AI_EVENTS'); loadAIEvents(); }} collapsed={!sidebarOpen} />

          <div className="my-1 border-t border-stone-800 mx-2 opacity-50" />

          <NavItem icon={<Camera size={20} />} label="Cameras" active={activeTab === 'CAMERAS'} onClick={() => { setActiveTab('CAMERAS'); setIsAddingCamera(false); }} collapsed={!sidebarOpen} />
          <NavItem icon={<Users size={20} />} label="Users" active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} collapsed={!sidebarOpen} />
          <NavItem icon={<MapPin size={20} />} label="Sites" active={activeTab === 'SITES'} onClick={() => setActiveTab('SITES')} collapsed={!sidebarOpen} />

          <div className="my-2 border-t border-stone-800 mx-2" />

          {user.role === UserRole.ADMIN && (
            <NavItem icon={<Settings size={20} />} label="System Config" active={false} onClick={() => { }} collapsed={!sidebarOpen} />
          )}
        </nav>

        <div className="p-4 border-t border-stone-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-stone-400 hover:text-techno-500 transition-colors w-full p-2 rounded hover:bg-stone-800/50">
            <LogOut size={20} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0a09]">
        {/* Top Header */}
        <header className="h-16 bg-stone-900/80 backdrop-blur border-b border-stone-800 flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4 bg-stone-800/50 px-3 py-1.5 rounded-lg border border-stone-700/50 focus-within:border-techno-600/50 transition-colors">
            <Search className="w-4 h-4 text-stone-400" />
            <input type="text" placeholder="Search cameras, events..." className="bg-transparent border-none outline-none text-sm text-white placeholder-stone-500 w-64" />
          </div>

          <div className="flex items-center gap-6">
            <div className="relative cursor-pointer">
              <Bell className="w-5 h-5 text-stone-400 hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-techno-600 rounded-full border-2 border-stone-900"></span>
            </div>

            <div className="flex items-center gap-3 border-l border-stone-700 pl-6">
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium text-white">{user.username}</div>
                <div className="text-xs text-techno-600 font-mono uppercase font-bold">{user.role}</div>
              </div>
              <div className="w-9 h-9 bg-stone-700 rounded-full flex items-center justify-center border border-stone-600 ring-2 ring-transparent hover:ring-techno-600/50 transition-all">
                <UserIcon className="w-5 h-5 text-stone-300" />
              </div>
              <ChevronDown className="w-4 h-4 text-stone-500" />
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 p-6 overflow-y-auto relative">

          {activeTab === 'LIVE' && (
            <div className="h-full flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-techno-600 animate-pulse"></div>
                  Live Monitoring
                </h2>
                <div className="flex gap-2">
                  <select
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="bg-stone-900 border border-stone-700 rounded px-3 py-1 text-sm text-stone-300 outline-none focus:border-techno-600"
                  >
                    <option value={4}>4-Split View</option>
                    <option value={9}>9-Split View</option>
                    <option value={32}>32-Split View</option>
                    <option value={1}>Full Screen</option>
                  </select>
                </div>
              </div>

              <div className={`grid gap-4 flex-1 ${gridSize === 1 ? 'grid-cols-1' :
                gridSize === 9 ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-3' :
                  gridSize === 32 ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8' :
                    'grid-cols-1 md:grid-cols-2 lg:grid-cols-2' // Default 4
                }`}>
                {feeds.map(feed => (
                  <VideoFeed key={feed.id} feed={feed} userRole={user.role} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'AI_MONITOR' && (
            <div className="h-full flex flex-col gap-4">
              {/* Conditional Render: Grid View vs Detail View */}
              {!detailViewId ? (
                <>
                  {/* Grid Header */}
                  <div className="flex items-center justify-between shrink-0">
                    <div>
                      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-techno-600" />
                        AI Monitor Overview
                      </h2>
                      <p className="text-stone-400 text-sm mt-1">Select a feed to view detailed analytics.</p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="bg-stone-900 border border-stone-800 px-3 py-1 rounded-full text-stone-400 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-techno-500" />
                        Active Agents: <span className="text-white font-bold">{activeAiConfigs.length}</span>
                      </span>
                    </div>
                  </div>

                  {activeAiConfigs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-stone-800 rounded-xl bg-stone-900/30">
                      <BrainCircuit className="w-12 h-12 text-stone-600 mb-4" />
                      <h3 className="text-lg font-medium text-stone-400">No AI Agents Configured</h3>
                      <p className="text-stone-500 mb-4">Go to AI Modules to set up detection rules.</p>
                      <button onClick={() => setActiveTab('AI_MODULES')} className="text-techno-500 hover:text-techno-400 text-sm font-medium">
                        Configure Modules &rarr;
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto">
                      {activeAiConfigs.map(config => {
                        const feed = feeds.find(f => f.id === config.cameraId);
                        if (!feed) return null;
                        return (
                          <div
                            key={config.id}
                            onClick={() => setDetailViewId(config.id)}
                            className="relative bg-stone-950 border border-stone-800 rounded-xl overflow-hidden group shadow-lg cursor-pointer hover:border-techno-600 transition-all hover:-translate-y-1"
                          >
                            {/* Feed Wrapper */}
                            <div className="relative aspect-video">
                              <img src={feed.thumbnailUrl} className="w-full h-full object-cover opacity-90" />

                              {/* Overlay: Module Tag */}
                              <div className="absolute top-2 left-2 flex items-center gap-2">
                                <span className="bg-techno-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wide">
                                  {config.moduleName}
                                </span>
                              </div>

                              {/* Play Overlay Icon on Hover */}
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <BarChart3 className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>
                            <div className="p-3 bg-stone-900">
                              <h4 className="font-bold text-white text-sm">{feed.name}</h4>
                              <p className="text-xs text-stone-500">{feed.location}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* DETAIL ANALYTICS VIEW */
                (() => {
                  const config = activeAiConfigs.find(c => c.id === detailViewId);
                  const feed = config ? feeds.find(f => f.id === config.cameraId) : null;

                  if (!config || !feed) return null;

                  return (
                    <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* Top Bar */}
                      <div className="flex items-center gap-4 shrink-0">
                        <button
                          onClick={() => setDetailViewId(null)}
                          className="p-2 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {feed.name}
                            <span className="text-stone-500 font-normal">/</span>
                            <span className="text-techno-500">{config.moduleName} Analytics</span>
                          </h2>
                        </div>
                      </div>

                      {/* Full Width Video Section */}
                      <div className="w-full aspect-[21/9] bg-black rounded-xl border border-stone-800 overflow-hidden relative shadow-2xl shrink-0">
                        <img src={feed.thumbnailUrl} className="w-full h-full object-cover opacity-90" />

                        {/* Live Indicator */}
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-techno-500/30">
                          <div className="w-2 h-2 rounded-full bg-techno-500 animate-pulse"></div>
                          <span className="text-xs font-bold text-white">LIVE ANALYSIS</span>
                        </div>

                        {/* AI Visual Overlay (Simulation) */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute bottom-6 left-6 max-w-sm">
                            <div className="bg-black/70 backdrop-blur p-3 rounded-lg border border-stone-700">
                              <div className="text-xs text-stone-400 mb-1">REAL-TIME EVENTS</div>
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between gap-4 text-sm text-white font-mono">
                                  <span>Person Detected</span>
                                  <span className="text-techno-500">98%</span>
                                </div>
                                <div className="flex justify-between gap-4 text-sm text-white font-mono">
                                  <span>Motion Vector</span>
                                  <span className="text-stone-400">East &rarr; West</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Graphics / Analytics Panel */}
                      <div className="flex-1 bg-stone-900 border border-stone-800 rounded-xl p-6 flex flex-col gap-6 shadow-xl">

                        {/* Filter Controls Row */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-800">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] uppercase text-stone-500 font-bold">Time Range</label>
                              <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded px-3 py-1.5 text-sm text-stone-300 cursor-pointer hover:border-techno-600">
                                <Calendar className="w-4 h-4 text-stone-500" />
                                <span>2025-07-10</span>
                                <ChevronDown className="w-3 h-3 text-stone-500" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] uppercase text-stone-500 font-bold">Camera</label>
                              <div className="flex items-center gap-2 bg-stone-950 border border-stone-700 rounded px-3 py-1.5 text-sm text-stone-300 cursor-not-allowed opacity-80">
                                <Camera className="w-4 h-4 text-stone-500" />
                                <span>{feed.name}</span>
                                <ChevronDown className="w-3 h-3 text-stone-500" />
                              </div>
                            </div>
                            <div className="flex items-end h-full pt-4">
                              <button className="text-xs text-techno-500 border border-techno-600/50 px-4 py-1.5 rounded hover:bg-techno-600 hover:text-white transition-all">
                                RESET
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <button className="flex items-center gap-2 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20 hover:bg-emerald-500/20">
                              <Download className="w-4 h-4" /> EXPORT CSV
                            </button>
                          </div>
                        </div>

                        {/* Charts Area */}
                        <div className="flex-1 flex flex-col lg:flex-row gap-8">

                          {/* Line Chart */}
                          <div className="flex-[2] flex flex-col min-h-[300px]">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-6 text-sm">
                                <span className="font-bold text-white border-b-2 border-transparent hover:border-techno-500 cursor-pointer">Weeks</span>
                                <span className="font-bold text-stone-500 hover:text-white cursor-pointer">Months</span>
                                <span className="font-bold text-stone-500 hover:text-white cursor-pointer">Lines</span>
                              </div>
                            </div>
                            <div className="flex-1 bg-stone-950/50 border border-stone-800 rounded-lg p-4 relative">
                              {renderLineChart()}
                            </div>
                          </div>

                          {/* Donut Chart */}
                          <div className="flex-1 flex flex-col min-h-[300px] items-center justify-center bg-stone-950/30 border border-stone-800 rounded-lg p-4">
                            <div className="relative w-48 h-48">
                              {/* Simple CSS Donut */}
                              <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                                {/* Background Circle */}
                                <path className="text-stone-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                {/* Foreground Circle (Cyan/Teal) */}
                                <path className="text-cyan-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" strokeDasharray="85, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-bold text-white">85%</span>
                                <span className="text-[10px] text-stone-500 uppercase tracking-widest">Occupancy</span>
                              </div>
                            </div>
                            <div className="mt-6 flex items-center gap-2">
                              <div className="w-3 h-3 bg-cyan-500 rounded-sm"></div>
                              <span className="text-sm text-stone-300">People Count <span className="text-white font-bold ml-1">100.0%</span></span>
                            </div>
                          </div>

                        </div>

                        {/* Footer Data Table */}
                        <div className="grid grid-cols-4 gap-px bg-stone-800 border border-stone-800 rounded-lg overflow-hidden text-sm">
                          {/* Headers */}
                          <div className="bg-stone-900/80 p-3 text-stone-400 font-bold uppercase text-xs">Date</div>
                          <div className="bg-stone-900/80 p-3 text-stone-400 font-bold uppercase text-xs col-span-2 text-center">People</div>
                          <div className="bg-stone-900/80 p-3 text-stone-400 font-bold uppercase text-xs">Total</div>

                          {/* Values */}
                          <div className="bg-stone-950 p-3 text-stone-300 font-mono">00:30</div>
                          <div className="bg-stone-950 p-3 text-cyan-500 font-bold font-mono text-center text-lg">3891</div>
                          <div className="bg-stone-950 p-3 text-red-500 font-bold font-mono text-center text-lg">784</div>
                          <div className="bg-stone-950 p-3 text-white font-bold font-mono text-lg">4445</div>
                        </div>
                      </div>

                    </div>
                  );
                })()
              )}
            </div>
          )}

          {activeTab === 'AI_EVENTS' && (
            <div className="h-full flex flex-col gap-4">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Bell className="w-6 h-6 text-techno-600" />
                    AI Events
                  </h2>
                  <p className="text-stone-400 text-sm mt-1">Recent detections across all cameras.</p>
                </div>
                <button
                  onClick={loadAIEvents}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 border border-stone-700"
                >
                  <Activity className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {aiEventsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-techno-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : aiEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-stone-800 rounded-xl bg-stone-900/30">
                  <Bell className="w-12 h-12 text-stone-600 mb-4" />
                  <h3 className="text-lg font-medium text-stone-400">No AI Events</h3>
                  <p className="text-stone-500">Events will appear here when detected.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {aiEvents.map(event => (
                      <div
                        key={event.id}
                        className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden hover:border-techno-600/50 transition-all group"
                      >
                        {/* Snapshot Thumbnail */}
                        <div
                          className="relative aspect-video bg-stone-950 cursor-pointer"
                          onClick={() => event.has_snapshot && event.snapshot_url && setSelectedSnapshot(getSnapshotUrl(event.id))}
                        >
                          {event.has_snapshot && event.snapshot_url ? (
                            <AuthenticatedImage
                              src={getSnapshotUrl(event.id)}
                              alt={`${event.event_type} snapshot`}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                              fallback={<div className="w-full h-full bg-stone-900" />}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-600">
                              <Camera className="w-10 h-10" />
                            </div>
                          )}

                          {/* Event Type Badge */}
                          <div className="absolute top-2 left-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${event.event_type === 'MOTION' ? 'bg-amber-500 text-black' :
                              event.event_type === 'PERSON' ? 'bg-blue-500 text-white' :
                                event.event_type === 'VEHICLE' ? 'bg-purple-500 text-white' :
                                  'bg-techno-600 text-white'
                              }`}>
                              {event.event_type}
                            </span>
                          </div>

                          {/* Confidence */}
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-xs font-mono text-white">
                            {Math.round(event.confidence * 100)}%
                          </div>

                          {/* Expand overlay on hover (only if snapshot exists) */}
                          {event.has_snapshot && (
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                <Eye className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Event Info */}
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-white text-sm truncate">{event.camera_name}</h4>
                            <span className={`w-2 h-2 rounded-full ${event.status === 'COMPLETED' ? 'bg-emerald-500' : event.status === 'PENDING' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(event.event_time).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Snapshot Lightbox Modal */}
              {selectedSnapshot && (
                <div
                  className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                  onClick={() => setSelectedSnapshot(null)}
                >
                  <button
                    className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
                    onClick={() => setSelectedSnapshot(null)}
                  >
                    <X className="w-8 h-8" />
                  </button>
                  <AuthenticatedImage
                    src={selectedSnapshot}
                    alt="Event snapshot"
                    className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                  />
                  <div className="absolute bottom-6 flex gap-4">
                    <button
                      className="bg-techno-600 hover:bg-techno-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg flex items-center gap-2"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const token = localStorage.getItem('vms_token');
                          const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
                          const res = await fetch(selectedSnapshot, { headers });
                          if (!res.ok) throw new Error('Download failed');
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `snapshot_${selectedSnapshot.split('/').pop() || 'event'}.jpg`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error('Download error:', err);
                        }
                      }}
                    >
                      <Download className="w-5 h-5" />
                      Download Image
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'CAMERAS' && (
            <div className="h-full">
              {!isAddingCamera ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Camera Management</h2>
                      <p className="text-stone-400 text-sm">Configure and manage video streams.</p>
                    </div>
                    <button
                      onClick={() => setIsAddingCamera(true)}
                      className="bg-techno-600 hover:bg-techno-500 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-techno-600/20"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Camera
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                    {feeds.map((feed) => (
                      <div key={feed.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden hover:border-techno-600 transition-colors group">
                        <div className="relative aspect-video bg-black">
                          <img src={feed.thumbnailUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] font-bold text-stone-300 border border-stone-700">
                            {feed.protocol}
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-white">{feed.name}</h3>
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${feed.status === 'ONLINE' || feed.status === 'RECORDING' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          </div>
                          <p className="text-xs text-stone-400 mb-4">{feed.location}</p>
                          <div className="flex gap-2">
                            <button className="flex-1 bg-stone-800 hover:bg-stone-700 text-xs py-2 rounded text-stone-300 transition-colors border border-stone-700">Edit</button>
                            <button className="flex-1 bg-stone-800 hover:bg-red-900/30 hover:text-red-400 hover:border-red-900/50 text-xs py-2 rounded text-stone-300 transition-colors border border-stone-700">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Empty State / Add Placeholder */}
                    <button
                      onClick={() => setIsAddingCamera(true)}
                      className="bg-stone-900/50 border-2 border-dashed border-stone-800 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-techno-600/50 hover:bg-stone-900 transition-all group aspect-video md:aspect-auto"
                    >
                      <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center group-hover:bg-techno-600/20 group-hover:text-techno-500 transition-colors">
                        <Plus className="w-6 h-6 text-stone-500 group-hover:text-techno-500" />
                      </div>
                      <span className="text-sm font-medium text-stone-500 group-hover:text-stone-300">Add Camera</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto">
                  <div className="mb-6 flex items-center gap-4">
                    <button onClick={() => setIsAddingCamera(false)} className="p-2 hover:bg-stone-800 rounded-lg text-stone-400 transition-colors">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Add New Camera</h2>
                      <p className="text-stone-400 text-sm">Enter stream details to connect a new device.</p>
                    </div>
                  </div>

                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase">Camera Name</label>
                        <input
                          type="text"
                          value={newCamera.name}
                          onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 text-white focus:border-techno-600 focus:outline-none transition-colors"
                          placeholder="e.g. North Gate"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase">Location / Group</label>
                        <input
                          type="text"
                          value={newCamera.location}
                          onChange={(e) => setNewCamera({ ...newCamera, location: e.target.value })}
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 text-white focus:border-techno-600 focus:outline-none transition-colors"
                          placeholder="e.g. Building A"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase">Stream URL</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={newCamera.url}
                            onChange={(e) => {
                              setNewCamera({ ...newCamera, url: e.target.value });
                              setConnectionStatus('IDLE');
                            }}
                            className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 pl-10 text-white focus:border-techno-600 focus:outline-none transition-colors font-mono text-sm"
                            placeholder="rtsp://192.168.1.100:554/stream1"
                          />
                          <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase">Username</label>
                        <input
                          type="text"
                          value={newCamera.username}
                          onChange={(e) => setNewCamera({ ...newCamera, username: e.target.value })}
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 text-white focus:border-techno-600 focus:outline-none transition-colors"
                          placeholder="admin"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase">Password</label>
                        <input
                          type="password"
                          value={newCamera.password}
                          onChange={(e) => setNewCamera({ ...newCamera, password: e.target.value })}
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 text-white focus:border-techno-600 focus:outline-none transition-colors"
                          placeholder="••••••"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase">Protocol</label>
                        <div className="flex gap-4">
                          {['RTSP', 'WebRTC', 'HLS'].map((proto) => (
                            <label key={proto} className={`flex-1 cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${newCamera.protocol === proto ? 'bg-techno-600/20 border-techno-600 text-techno-500' : 'bg-stone-950 border-stone-700 text-stone-400 hover:border-stone-500'}`}>
                              <input
                                type="radio"
                                name="protocol"
                                value={proto}
                                checked={newCamera.protocol === proto}
                                onChange={() => setNewCamera({ ...newCamera, protocol: proto })}
                                className="hidden"
                              />
                              <span className="font-medium text-sm">{proto}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-stone-800">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleCheckConnection}
                          disabled={connectionStatus === 'CHECKING' || !newCamera.url}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2 ${connectionStatus === 'SUCCESS'
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 cursor-default'
                            : connectionStatus === 'ERROR'
                              ? 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20'
                              : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                        >
                          {connectionStatus === 'CHECKING' && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                          {connectionStatus === 'SUCCESS' && <CheckCircle className="w-4 h-4" />}
                          {connectionStatus === 'ERROR' && <XCircle className="w-4 h-4" />}
                          {connectionStatus === 'IDLE' ? 'Check Connection' : connectionStatus === 'SUCCESS' ? 'Connection Verified' : connectionStatus === 'ERROR' ? 'Connection Failed' : 'Testing...'}
                        </button>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsAddingCamera(false)}
                          className="px-6 py-2 rounded-lg text-sm font-medium text-stone-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveCamera}
                          disabled={connectionStatus !== 'SUCCESS'}
                          className="bg-techno-600 hover:bg-techno-500 disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-all shadow-lg shadow-techno-600/20 disabled:shadow-none flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Save Camera
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'AI_MODULES' && (
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">AI Modules</h2>
                <p className="text-stone-400 text-sm">Deploy advanced computer vision models to your streams.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
                {AI_FEATURES.map((feature) => {
                  const activeCount = activeAiConfigs.filter(c => c.moduleId === feature.id).length;
                  return (
                    <button
                      key={feature.id}
                      onClick={() => setSelectedAiModule(feature)}
                      className="flex flex-col items-start bg-stone-900 border border-stone-800 hover:border-techno-600 p-6 rounded-xl text-left transition-all group relative overflow-hidden"
                    >
                      {/* Active Indicator Strip */}
                      {activeCount > 0 && <div className="absolute top-0 left-0 bottom-0 w-1 bg-techno-600"></div>}

                      <div className="w-12 h-12 bg-stone-800 rounded-lg flex items-center justify-center mb-4 group-hover:bg-techno-600/10 group-hover:text-techno-500 transition-colors">
                        <feature.icon className="w-6 h-6 text-stone-400 group-hover:text-techno-500" />
                      </div>
                      <h3 className="font-semibold text-white text-lg mb-1">{feature.name}</h3>
                      <p className="text-sm text-stone-400 mb-4 line-clamp-2">{feature.description}</p>

                      <div className="mt-auto flex items-center gap-2 text-xs font-mono">
                        {activeCount > 0 ? (
                          <span className="text-techno-500 font-bold bg-techno-600/10 px-2 py-1 rounded border border-techno-600/20">
                            {activeCount} CAMERA{activeCount !== 1 ? 'S' : ''} ACTIVE
                          </span>
                        ) : (
                          <span className="text-stone-600 px-2 py-1">NOT CONFIGURED</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'USERS' && (
            <div className="flex flex-col items-center justify-center h-full text-stone-500">
              <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mb-4 border border-stone-800">
                <Users className="w-8 h-8 text-techno-600" />
              </div>
              <h3 className="text-lg font-medium text-stone-300">User Management</h3>
              <p>Administer user roles, permissions, and access logs.</p>
            </div>
          )}

          {activeTab === 'SITES' && (
            <div className="flex flex-col items-center justify-center h-full text-stone-500">
              <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mb-4 border border-stone-800">
                <MapPin className="w-8 h-8 text-techno-600" />
              </div>
              <h3 className="text-lg font-medium text-stone-300">Site Management</h3>
              <p>Configure physical locations and map layouts.</p>
            </div>
          )}

        </div>
      </main >

      {/* AI Module: Camera Selection Modal */}
      {
        selectedAiModule && !configuringCamera && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-stone-800 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-techno-600/10 rounded-lg flex items-center justify-center text-techno-500">
                    <selectedAiModule.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedAiModule.name}</h3>
                    <p className="text-stone-400 text-sm">Select a camera to configure this module.</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAiModule(null)}
                  className="p-1 hover:bg-stone-800 rounded text-stone-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-2 overflow-y-auto flex-1">
                {feeds.map(feed => {
                  const isConfigured = activeAiConfigs.some(c => c.moduleId === selectedAiModule.id && c.cameraId === feed.id);
                  return (
                    <div
                      key={feed.id}
                      onClick={() => handleStartConfig(feed)}
                      className="flex items-center p-4 m-2 rounded-xl border border-stone-800 bg-stone-950/50 hover:bg-stone-900 hover:border-techno-600/50 cursor-pointer transition-all group"
                    >
                      <div className="w-16 h-9 bg-black rounded overflow-hidden mr-4 border border-stone-800 group-hover:border-stone-600">
                        <img src={feed.thumbnailUrl} className="w-full h-full object-cover opacity-60" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-stone-200 group-hover:text-white">{feed.name}</h4>
                          {isConfigured && <span className="text-[10px] bg-techno-900/50 text-techno-400 px-2 py-0.5 rounded border border-techno-900">CONFIGURED</span>}
                        </div>
                        <p className="text-xs text-stone-500">{feed.location}</p>
                      </div>
                      <div className="ml-2 text-stone-600 group-hover:text-techno-500">
                        <Settings className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      }

      {/* AI Module: Parameter Configuration Modal */}
      {
        selectedAiModule && configuringCamera && (
          <div className="absolute inset-0 z-50 flex flex-col bg-stone-950 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-16 border-b border-stone-800 bg-stone-900 px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setConfiguringCamera(null)}
                  className="p-2 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-stone-800"></div>
                <div className="flex items-center gap-3">
                  <selectedAiModule.icon className="w-5 h-5 text-techno-600" />
                  <div>
                    <h3 className="font-bold text-white text-sm leading-none mb-1">Configure {selectedAiModule.name}</h3>
                    <p className="text-xs text-stone-400 font-mono leading-none">Target: {configuringCamera.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setConfiguringCamera(null); setSelectedAiModule(null); }} className="px-4 py-2 text-sm text-stone-400 hover:text-white">Cancel</button>
                <button onClick={handleSaveAiConfig} className="bg-techno-600 hover:bg-techno-500 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-techno-600/20">
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Config Controls (Left Sidebar) */}
              <div className="w-80 bg-stone-900 border-r border-stone-800 p-6 flex flex-col gap-8 overflow-y-auto">

                {/* Sensitivity */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-stone-300 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-techno-500" /> Motion Sensitivity
                    </label>
                    <span className="text-xs font-mono text-techno-400">{tempConfig.sensitivity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="100"
                    value={tempConfig.sensitivity}
                    onChange={(e) => setTempConfig({ ...tempConfig, sensitivity: Number(e.target.value) })}
                    className="w-full accent-techno-600 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-stone-500">Higher sensitivity detects smaller movements but may increase false alarms.</p>
                </div>

                {/* Threshold */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-stone-300 flex items-center gap-2">
                      <Target className="w-4 h-4 text-techno-500" /> Confidence Threshold
                    </label>
                    <span className="text-xs font-mono text-techno-400">{tempConfig.threshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50" max="100"
                    value={tempConfig.threshold}
                    onChange={(e) => setTempConfig({ ...tempConfig, threshold: Number(e.target.value) })}
                    className="w-full accent-techno-600 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-stone-500">Minimum AI confidence required to trigger an alert.</p>
                </div>

                {/* Priority */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-stone-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-techno-500" /> Alert Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['LOW', 'MEDIUM', 'HIGH'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setTempConfig({ ...tempConfig, alertPriority: p as any })}
                        className={`text-xs font-bold py-2 rounded border transition-all ${tempConfig.alertPriority === p ? 'bg-stone-800 border-techno-600 text-techno-500' : 'bg-stone-950 border-stone-800 text-stone-500 hover:border-stone-600'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zone Drawing Toggle */}
                <div className="pt-6 border-t border-stone-800">
                  <button
                    onClick={() => setTempConfig({ ...tempConfig, drawZone: !tempConfig.drawZone })}
                    className={`w-full py-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition-all ${tempConfig.drawZone ? 'bg-techno-600/10 border-techno-600 text-techno-500' : 'bg-stone-950 border-stone-700 text-stone-400 hover:text-white'}`}
                  >
                    <MousePointer2 className="w-4 h-4" />
                    {tempConfig.drawZone ? 'Finish Drawing Zone' : 'Draw Detection Zone'}
                  </button>
                  <p className="text-xs text-stone-500 mt-2 text-center">Click and drag on the video to define area of interest.</p>
                </div>

              </div>

              {/* Video Preview (Right Side) */}
              <div className="flex-1 bg-black relative flex items-center justify-center p-8">
                <div className="relative aspect-video w-full max-w-5xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden rounded-lg">
                  <img src={configuringCamera.thumbnailUrl} className="w-full h-full object-cover opacity-80" />

                  {/* Simulated Zone Overlay */}
                  {tempConfig.drawZone && (
                    <div className="absolute inset-0 border-2 border-techno-500/50 bg-techno-500/5 cursor-crosshair flex items-center justify-center">
                      <div className="border-2 border-dashed border-techno-400 w-1/3 h-1/3 flex items-center justify-center">
                        <span className="bg-black/50 text-white text-xs px-2 py-1 rounded">Active Zone</span>
                      </div>
                    </div>
                  )}

                  {/* Info Overlay */}
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-3 py-1.5 rounded border border-stone-700">
                    <div className="text-xs text-stone-400 font-mono">LIVE PREVIEW</div>
                    <div className="text-sm font-bold text-white">{configuringCamera.name}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

// Helper for Nav Items
const NavItem = ({ icon, label, active, onClick, collapsed }: any) => (
  <button
    onClick={onClick}
    title={collapsed ? label : ''}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-techno-600 text-white shadow-lg shadow-techno-600/20' : 'text-stone-400 hover:bg-stone-800 hover:text-white'}`}
  >
    <span className={active ? 'text-white' : 'text-stone-400'}>{icon}</span>
    {!collapsed && <span className="font-medium text-sm">{label}</span>}
  </button>
);

export default Dashboard;