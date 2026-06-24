import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  MousePointerClick, 
  Users, 
  Clock, 
  Calendar, 
  RefreshCw, 
  Trash2, 
  Play, 
  Layers, 
  Code,
  ArrowRight,
  Eye,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Layout,
  Flame,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrackedEvent, SessionSummary } from './types';
import WebsiteSandbox from './components/WebsiteSandbox';
import causalfunnelLogo from './assets/images/causalfunnel_logo_1782107327101.jpg';

// Local developer tracking session ID generated uniquely per browser session load
const generateSessionId = () => {
  return 'sess_dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString().slice(-4);
};

interface CanvasHeatmapOverlayProps {
  clicks: TrackedEvent[];
  radius: number;
}

function CanvasHeatmapOverlay({ clicks, radius }: CanvasHeatmapOverlayProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth || 500;
        canvas.height = parent.clientHeight || 460;
      }

      // Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render multi-layered glowing thermal spectrum grids
      clicks.forEach(click => {
        if (click.xPct === undefined || click.yPct === undefined) return;
        
        const x = click.xPct * canvas.width;
        const y = click.yPct * canvas.height;

        // Draw advanced thermal glow: Deep Blue (cold) -> Green -> Amber (warm) -> Red (climax) -> White (super hot center)
        const grad = ctx.createRadialGradient(x, y, 1, x, y, radius * 2.5);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');       // Hot core center
        grad.addColorStop(0.15, 'rgba(239, 68, 68, 0.85)');       // Red Climax
        grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.65)');      // Orange Warm
        grad.addColorStop(0.7, 'rgba(16, 185, 129, 0.35)');       // Green transition
        grad.addColorStop(0.9, 'rgba(59, 130, 246, 0.15)');       // Blue cold outer
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');            // Fade out

        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();
      });
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [clicks, radius]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-80 mix-blend-multiply"
    />
  );
}

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionEvents, setSelectedSessionEvents] = useState<TrackedEvent[]>([]);
  
  const [heatmapPath, setHeatmapPath] = useState<string>('/home');
  const [heatmapClicks, setHeatmapClicks] = useState<TrackedEvent[]>([]);
  
  const [activeMainTab, setActiveMainTab] = useState<'sessions' | 'heatmap' | 'integration'>('sessions');
  const [developerSessionId, setDeveloperSessionId] = useState<string>(generateSessionId);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Heatmap configuration settings
  const [heatmapRadius, setHeatmapRadius] = useState<number>(14);
  const [showCoordinateLines, setShowCoordinateLines] = useState<boolean>(true);

  // New customization toolkit states
  const [minDensity, setMinDensity] = useState<number>(1);
  const [showThermalOverlay, setShowThermalOverlay] = useState<boolean>(true);
  const [trackedRoutes, setTrackedRoutes] = useState<string[]>(['/home', '/products', '/pricing', '/pricing/success']);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  
  const [dbStatus, setDbStatus] = useState<{
    isMongoActive: boolean;
    lastError: string | null;
    hasUri: boolean;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(current => current === message ? null : current);
    }, 4000);
  }, []);

  // Fetch session details from server
  const fetchSessionEvents = useCallback(async (sessId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessId}/events`);
      if (res.ok) {
        const events = await res.json();
        setSelectedSessionEvents(events);
      }
    } catch (err) {
      console.error(`Error loading session timeline for ${sessId}:`, err);
    }
  }, []);

  // Fetch click dataset for compiling heatmaps
  const fetchHeatmapPoints = useCallback(async (pathName: string) => {
    try {
      const res = await fetch(`/api/heatmap?pageUrl=${encodeURIComponent(pathName)}`);
      if (res.ok) {
        const clicks = await res.json();
        setHeatmapClicks(clicks);
      }
    } catch (err) {
      console.error('Error fetching heatmap clicks:', err);
    }
  }, []);

  // Core aggregator to pull updated database telemetry
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        
        // Auto-select first session if none is selected, or if the previously selected session no longer exists in the loaded data
        if (data.length > 0) {
          setSelectedSessionId(current => {
            if (!current) return data[0].sessionId;
            const exists = data.some((s: any) => s.sessionId === current);
            return exists ? current : data[0].sessionId;
          });
        } else {
          setSelectedSessionId(null);
        }
      }

      // Fetch list of tracked URL logs pathnames
      try {
        const routesRes = await fetch('/api/tracked-routes');
        if (routesRes.ok) {
          const rData = await routesRes.json();
          if (Array.isArray(rData) && rData.length > 0) {
            setTrackedRoutes(rData);
          }
        }
      } catch (err) {
        console.warn('Fail retrieving active telemetry log paths:', err);
      }

      // Fetch dynamic database cluster connection status
      const dbRes = await fetch('/api/db-status');
      if (dbRes.ok) {
         const dStatus = await dbRes.json();
         setDbStatus(dStatus);
      }
    } catch (err) {
      console.error('Failed to connect to analytics REST endpoints:', err);
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  // Connect WebSocket for WebSockets live metric streaming (and fallback virtual telemetry stream)
  useEffect(() => {
    // Listen for local virtual events (for static serverless fallback)
    const handleVirtualEvent = (e: Event) => {
      const ev = (e as CustomEvent).detail;
      console.log('Virtual client-side event packet received:', ev);
      
      if (ev.sessionId === selectedSessionId) {
        setSelectedSessionEvents(prev => {
          if (prev.some(p => p._id === ev._id || (p.timestamp === ev.timestamp && p.eventType === ev.eventType && p.pathname === ev.pathname))) return prev;
          return [...prev, ev];
        });
      }

      loadDashboardData();

      if (activeMainTab === 'heatmap' && (heatmapPath === ev.pathname || heatmapPath === ev.pageUrl)) {
        fetchHeatmapPoints(heatmapPath);
      }
    };

    window.addEventListener('virtual-telemetry-event', handleVirtualEvent);

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function initWS() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      console.log('Connecting dashboard WS link:', wsUrl);
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket link successfully established.');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'TELEMETRY_EVENT') {
            const ev = payload.data;
            console.log('Live WS event packet received:', ev);
            
            // Instantly append click or view event dynamically to current session timeline smoothly without full pages reload
            if (ev.sessionId === selectedSessionId) {
              setSelectedSessionEvents(prev => {
                // Prevent duplicate receipts
                if (prev.some(p => p._id === ev._id)) return prev;
                return [...prev, ev];
              });
            }

            // Sync overall counts & session cards
            loadDashboardData();

            // Refresh heatmaps dynamically if the active focus path matches the live event path
            if (activeMainTab === 'heatmap' && (heatmapPath === ev.pathname || heatmapPath === ev.pageUrl)) {
              fetchHeatmapPoints(heatmapPath);
            }
          }
        } catch (err) {
          console.error('Error reading WebSocket signal payload:', err);
        }
      };

      ws.onclose = () => {
        console.warn('Dashboard websocket severed. Swapping backup reconnect...');
        reconnectTimeout = setTimeout(initWS, 4000);
      };
    }

    initWS();

    return () => {
      window.removeEventListener('virtual-telemetry-event', handleVirtualEvent);
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedSessionId, heatmapPath, activeMainTab, showToast, loadDashboardData, fetchHeatmapPoints]);

  // Initialize and load dashboard telemetry
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Whenever a session is selected, fetch its chronological journey events
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionEvents(selectedSessionId);
    } else {
      setSelectedSessionEvents([]);
    }
  }, [selectedSessionId, fetchSessionEvents]);

  // Whenever the heatmap target path or sessions update, fetch the coordinate point sets
  useEffect(() => {
    fetchHeatmapPoints(heatmapPath);
  }, [heatmapPath, sessions, fetchHeatmapPoints]);

  // Trigger state mutation: clear out active schema events
  const handleResetDatabase = async () => {
    setConfirmModal({
      title: 'Wipe Database Tracker Log',
      message: 'Are you sure you want to drop all standard tracked events and completely wipe your active analytics database? This action is permanent.',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/reset', { method: 'POST' });
          if (res.ok) {
            setSessions([]);
            setSelectedSessionId(null);
            setSelectedSessionEvents([]);
            setHeatmapClicks([]);
            showToast('Database wiped successfully!', 'success');
            loadDashboardData();
          }
        } catch (err) {
          console.error('Reset database failed:', err);
          showToast('Failed to reset the database log.', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  // Trigger state mutation: seed default tracking events to quickly preview patterns
  const handleSeedDatabase = async () => {
    const proceedWithSeeding = async () => {
      try {
        const res = await fetch('/api/seed', { method: 'POST' });
        if (res.ok) {
          setSelectedSessionId(null);
          showToast('Sample datasets successfully seeded. Re-aggregating...', 'success');
          loadDashboardData();
        }
      } catch (err) {
        console.error('Seeding database failed:', err);
        showToast('Failed to seed datasets.', 'error');
      }
    };

    if (dbStatus?.isMongoActive) {
      setConfirmModal({
        title: 'Seed Live Cloud Table?',
        message: 'Warning: You are currently connected to a Live MongoDB Cloud Atlas database. Are you sure you want to insert mock telemetry records into your live cloud tables?',
        onConfirm: async () => {
          await proceedWithSeeding();
          setConfirmModal(null);
        }
      });
    } else {
      await proceedWithSeeding();
    }
  };

  // Format helper for relative chronological time display (duration)
  const formatDuration = (ms: number) => {
    if (ms <= 0) return 'Just view';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatFullDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Extract unique domains found inside sessions logs
  const availableDomains = React.useMemo(() => {
    const set = new Set<string>();
    set.add('causalfunnel-demo.com');
    sessions.forEach(s => {
      if (s.domains && Array.isArray(s.domains)) {
        s.domains.forEach(d => {
          if (d && d.trim() !== '') {
            set.add(d);
          }
        });
      }
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Filter sessions by domain selections
  const filteredSessions = React.useMemo(() => {
    return sessions.filter(s => {
      if (selectedDomain === 'all') return true;
      return s.domains && s.domains.includes(selectedDomain);
    });
  }, [sessions, selectedDomain]);

  // Dynamic routes based on selected domain
  const availableRoutesForDomain = React.useMemo(() => {
    const routesSet = new Set<string>();
    
    // Add default sandbox routes by default if selectedDomain is 'all' or 'causalfunnel-demo.com'
    if (selectedDomain === 'all' || selectedDomain === 'causalfunnel-demo.com') {
      routesSet.add('/home');
      routesSet.add('/products');
      routesSet.add('/pricing');
      routesSet.add('/pricing/success');
    }

    sessions.forEach(s => {
      if (selectedDomain !== 'all' && s.domains && !s.domains.includes(selectedDomain)) {
        return;
      }
      if (s.pageUrls) {
        s.pageUrls.forEach(url => {
          try {
            const urlObj = new URL(url);
            if (selectedDomain === 'all' || urlObj.hostname === selectedDomain) {
              routesSet.add(urlObj.pathname);
            }
          } catch {
            if (url.startsWith('/')) {
              routesSet.add(url);
            }
          }
        });
      }
    });

    return Array.from(routesSet).sort();
  }, [sessions, selectedDomain]);

  // Handle auto-updating the selected focus route if it isn't listed in the domain's routes
  useEffect(() => {
    if (availableRoutesForDomain.length > 0 && !availableRoutesForDomain.includes(heatmapPath)) {
      setHeatmapPath(availableRoutesForDomain[0]);
    }
  }, [selectedDomain, availableRoutesForDomain, heatmapPath]);

  // Aggregated analytical constants computed client-side based on filtered domain segments
  const totalEventsCount = filteredSessions.reduce((sum, s) => sum + s.totalEvents, 0);
  const totalClicksCount = filteredSessions.reduce((sum, s) => sum + s.clicks, 0);
  const totalPageViewsCount = filteredSessions.reduce((sum, s) => sum + s.pageViews, 0);
  const averageEventDensityValue = filteredSessions.length > 0 ? (totalEventsCount / filteredSessions.length).toFixed(1) : '0';

  return (
    <div id="analytics-app-root" className="min-h-screen bg-[#F4F5FA] font-sans antialiased text-slate-800">
      
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl border animate-bounce ${
          toastType === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : toastType === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
        }`}>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              toastType === 'success' ? 'bg-emerald-400' : toastType === 'error' ? 'bg-rose-400' : 'bg-indigo-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              toastType === 'success' ? 'bg-emerald-500' : toastType === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
            }`}></span>
          </span>
          <span className="text-xs font-bold leading-none">{toastMessage}</span>
        </div>
      )}

      {/* Top Professional Header Bar */}
      <header id="main-app-header" className="sticky top-0 z-[100] bg-white border-b border-slate-200/80 shadow-xs px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-600/10 border border-slate-100 bg-white flex items-center justify-center shrink-0">
            <img 
              src={causalfunnelLogo} 
              alt="CausalFunnel Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">CausalFunnel</h1>
            </div>
            <p className="text-xs text-slate-500 font-medium">User Analytics Dashboard</p>
          </div>
        </div>

        {/* Database Quick Controller Actions */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Device Session</p>
            <p className="text-xs font-mono font-bold text-indigo-600 truncate max-w-[150px]">{developerSessionId}</p>
          </div>
          
          <button 
            id="seed-dataset-btn"
            onClick={handleSeedDatabase}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
            title="Wipe database and reload default analytical metrics"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Load Mock Telemetry</span>
          </button>

          <div className="w-px h-6 bg-slate-200" />

          {/* Refresh indicators */}
          <button 
            id="manual-refresh-btn"
            onClick={loadDashboardData}
            className={`p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer ${isLoading ? 'bg-slate-50' : 'bg-white'}`}
            title="Fetch latest telemetry summaries"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Database Connection Status banner */}
        {dbStatus && dbStatus.hasUri && !dbStatus.isMongoActive && (
          <div id="db-status-banner-warning" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-800 mt-0.5 md:mt-0 shrink-0">
                <Settings className="w-5 h-5 animate-pulse text-amber-700" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-amber-900">MongoDB Connection Auth Warning</h4>
                <p className="text-xs text-amber-700 font-medium mt-0.5">
                  Your <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[10px]">MONGODB_URI</code> credentials rejected connection: <span className="font-bold font-mono text-[10px] text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">{dbStatus.lastError || 'authentication failed'}</span>.
                </p>
                <p className="text-[11px] text-amber-600 mt-1.5 leading-relaxed">
                  💡 <strong>Workspace Active:</strong> We have seamlessly shifted analytics storage to our robust server-side local JSON transactional engine. The workspace is 100% operational! To resolve the database lock, check your username, password and whitelist parameters in the Settings panel.
                </p>
              </div>
            </div>
          </div>
        )}

        {dbStatus && dbStatus.isMongoActive && (
          <div id="db-status-banner-success" className="bg-emerald-50/80 border border-emerald-200/60 rounded-2xl p-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-extrabold text-emerald-800 tracking-tight">
                Securely Linked to Live MongoDB Cloud Atlas Cluster
              </span>
            </div>
            <span className="text-[10px] bg-emerald-100/80 text-emerald-850 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-200/50">
              Atlas Active
            </span>
          </div>
        )}

        {/* Website Domain workspace Profile Filter */}
        <div id="website-workspace-profile-filter" className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Focus Tracking Website / Domain</label>
              <select
                id="workspace-domain-selector"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs min-w-[240px] transition-all"
              >
                <option value="all">🌐 All Websites / Domains (Combined)</option>
                {availableDomains.map(dom => (
                  <option key={dom} value={dom}>🖥️ {dom}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2">
            💡 Displaying data segment: <strong className="text-indigo-950">{selectedDomain === 'all' ? 'All Active Ingestion Streams' : selectedDomain}</strong>
          </div>
        </div>

        {/* 1. Materio-Inspired Metric Board Widgets */}
        <motion.section 
          id="metrical-dashboard-cards" 
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05
              }
            }
          }}
        >
          
          {/* Card 1: Unique Sessions */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
            }}
            whileHover={{ y: -5, scale: 1.015, boxShadow: "0 12px 24px -10px rgba(99,102,241,0.12)" }}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-[120px] cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-slate-400 capitalize tracking-wide">Unique Sessions</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{filteredSessions.length}</h3>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Active cookies tracking uniquely on site
            </div>
          </motion.div>

          {/* Card 2: Total Events */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
            }}
            whileHover={{ y: -5, scale: 1.015, boxShadow: "0 12px 24px -10px rgba(168,85,247,0.12)" }}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-[120px] cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-slate-400 capitalize tracking-wide">Tracked Events</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{totalEventsCount}</h3>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-extrabold text-indigo-600">{averageEventDensityValue}</span>
              <span className="font-medium">avg interactive steps per session</span>
            </div>
          </motion.div>

          {/* Card 3: Clicks & Heat Ratio */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
            }}
            whileHover={{ y: -5, scale: 1.015, boxShadow: "0 12px 24px -10px rgba(249,115,22,0.12)" }}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-[120px] cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-slate-400 capitalize tracking-wide">Interactive Clicks</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{totalClicksCount}</h3>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FFF4E5] text-[#FF9F43]">
                <MousePointerClick className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>CLICK RATIO</span>
                <span>{totalEventsCount > 0 ? Math.round((totalClicksCount / totalEventsCount) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-[#FF9F43] h-full rounded" 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalEventsCount > 0 ? (totalClicksCount / totalEventsCount) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>

          {/* Card 4: Page Views Volume */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
            }}
            whileHover={{ y: -5, scale: 1.015, boxShadow: "0 12px 24px -10px rgba(16,185,129,0.12)" }}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-[120px] cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-slate-400 capitalize tracking-wide">Page Views</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{totalPageViewsCount}</h3>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>VIEW PERCENTAGE</span>
                <span>{totalEventsCount > 0 ? Math.round((totalPageViewsCount / totalEventsCount) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-emerald-500 h-full rounded" 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalEventsCount > 0 ? (totalPageViewsCount / totalEventsCount) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>

        </motion.section>

        {/* 2. Main Double-Column Layout */}
        <section id="analytics-split-workspace" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* A. LEFT COLUMN (5 Columns width): Interactive Simulation Workspace */}
          <div id="left-sidebar-sandbox-panel" className="lg:col-span-5 space-y-6">
            
            {/* The Live Sandbox Visual Frame */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Interactive Telemetry Generator</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-mono animate-pulse">Auto-Capture Mode</span>
              </div>
              
              <WebsiteSandbox 
                onEventSent={loadDashboardData}
                currentSessionId={developerSessionId}
                onResetSessionId={() => {
                  const nextSess = 'sess_dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString().slice(-4);
                  setDeveloperSessionId(nextSess);
                  showToast('A fresh guest checkout funnel segment is spawned!', 'success');
                }}
              />
            </div>

            {/* Embed Instructions card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-[#8C57FF]">
                <Code className="w-4.5 h-4.5" />
                <h3 className="text-sm font-bold text-slate-800">Production Embed Snippet</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                To capture coordinates and user session heatmaps on external webpages, embed this client-side asynchronous script before the closing <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono text-[11px]">&lt;/body&gt;</code> element:
              </p>
              
              {/* Embed codebox */}
              <div className="relative">
                <pre className="bg-slate-900 text-slate-300 font-mono text-[10px] p-3.5 rounded-xl overflow-x-auto border border-slate-800 leading-normal select-all">
{`<!-- CausalFunnel Event Script -->
<script 
  src="${window.location.origin}/tracker.js" 
  async>
</script>`}
                </pre>
              </div>

              <div className="bg-indigo-50/70 rounded-xl p-3 flex gap-2.5 border border-indigo-100/50">
                <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-indigo-800 leading-snug">
                  <strong>Device Independent Sync:</strong> The script tracks relative viewport percentages (<code className="font-mono text-[10px] text-indigo-900">xPct</code> and <code className="font-mono text-[10px] text-indigo-900">yPct</code>) rather than simple screen pixel limits. This maps click hotspots correctly across resizing viewports!
                </div>
              </div>
            </div>

          </div>

          {/* B. RIGHT COLUMN (7 Columns width): Analytics Dashboard tabs (Journeys vs. Heatmaps) */}
          <div id="right-workspace-panel" className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-h-[710px]">
            
            {/* Tab Swapper */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-xl relative">
                
                {/* Tab: Users Journeys */}
                <button 
                  id="tab-sessions-trigger"
                  onClick={() => setActiveMainTab('sessions')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition relative select-none cursor-pointer"
                >
                  {activeMainTab === 'sessions' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-white rounded-lg shadow-xs"
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 text-slate-800">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Session Journeys</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full text-[10px] font-black">{filteredSessions.length}</span>
                  </span>
                </button>

                {/* Tab: Click Heatmaps */}
                <button 
                  id="tab-heatmap-trigger"
                  onClick={() => {
                    setActiveMainTab('heatmap');
                    fetchHeatmapPoints(heatmapPath);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition relative select-none cursor-pointer"
                >
                  {activeMainTab === 'heatmap' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-white rounded-lg shadow-xs"
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 text-slate-800">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>Interactive Heatmaps</span>
                  </span>
                </button>

                {/* Tab: API Protocol Specs */}
                <button 
                  id="tab-integration-trigger"
                  onClick={() => setActiveMainTab('integration')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition relative select-none cursor-pointer"
                >
                  {activeMainTab === 'integration' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-white rounded-lg shadow-xs"
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 text-slate-800">
                    <Code className="w-3.5 h-3.5 text-[#8C57FF]" />
                    <span>API Specs</span>
                  </span>
                </button>

              </div>

              {/* Timestamp of last pull */}
              <div className="text-[11px] text-slate-400 font-medium">
                Last Sync: {lastUpdated.toLocaleTimeString()}
              </div>
            </div>

            {/* TAB CONTENT: 1. SESSION JOURNEYS VIEW */}
            {activeMainTab === 'sessions' && (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                
                {/* Sessions list Side-panel (5/12 columns) */}
                <div className="md:col-span-5 flex flex-col h-[650px] overflow-hidden">
                  <div className="h-[46px] px-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shadow-xxs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Sessions</span>
                    <span className="text-[10px] text-indigo-600 font-mono">Sorted by Activity</span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredSessions.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                        <Users className="w-8 h-8 text-slate-350 mb-2 animate-pulse" />
                        <p className="text-xs font-bold">No active sessions found</p>
                        <p className="text-[10px] text-slate-400 mt-1">Generate clicks in the sandbox to track logs live!</p>
                      </div>
                    ) : (
                      filteredSessions.map((sess, idx) => {
                        const isSelected = selectedSessionId === sess.sessionId;
                        const isCurrentDev = sess.sessionId === developerSessionId;
                        return (
                          <motion.div 
                            key={sess.sessionId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.4), type: "spring", stiffness: 200, damping: 22 }}
                            whileHover={{ backgroundColor: "rgba(248, 250, 252, 0.8)", x: 2 }}
                            onClick={() => setSelectedSessionId(sess.sessionId)}
                            className={`p-3.5 cursor-pointer text-left transition-colors relative select-none ${isSelected ? 'bg-indigo-50/50 border-l-4 border-[#8C57FF]' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-slate-800 truncate max-w-[130px] font-mono" title={sess.sessionId}>
                                {sess.sessionId}
                              </span>
                              {isCurrentDev && (
                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-sans font-bold text-[8px] px-1.5 py-0.2 rounded uppercase">You</span>
                              )}
                            </div>

                            {sess.domains && sess.domains.length > 0 && (
                              <div className="text-[9px] text-indigo-750 font-extrabold flex items-center gap-1 mb-1.5 bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-0.5 w-max">
                                <span>🖥️</span>
                                <span className="truncate max-w-[160px]">{sess.domains.join(', ')}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                              <span className="flex items-center gap-1 font-medium text-slate-450">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatDuration(sess.durationMs)}
                              </span>
                              <span className="font-bold text-slate-600">
                                {sess.totalEvents} events
                              </span>
                            </div>

                            <div className="flex gap-2">
                              {sess.pageViews > 0 && (
                                <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  <Eye className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{sess.pageViews}v</span>
                                </span>
                              )}
                              {sess.clicks > 0 && (
                                <span className="bg-slate-100 text-[#FF9F43] text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  <MousePointerClick className="w-2.5 h-2.5 text-[#FF9F43]" />
                                  <span>{sess.clicks}c</span>
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 ml-auto font-mono self-center">
                                {formatTimestamp(sess.lastActive)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Event Journey Details Timeline (7/12 columns) */}
                <div className="md:col-span-7 flex flex-col h-[650px] overflow-hidden bg-slate-50/30">
                  <div className="h-[46px] px-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shadow-xxs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Journey Timeline</span>
                    {selectedSessionId && (
                      <span className="text-xs text-indigo-700 font-mono truncate max-w-[170px] bg-indigo-50 px-2 py-0.5 rounded font-bold">
                        {selectedSessionId}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 select-none">
                    {!selectedSessionId ? (
                      <div className="text-center text-slate-400 py-20 flex flex-col items-center justify-center">
                        <BarChart3 className="w-10 h-10 text-slate-300 mb-2" />
                        <h4 className="text-xs font-bold text-slate-700">Select a Session</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Choose a session on the left to trace the sequence of user page views & click positions chronologically.</p>
                      </div>
                    ) : selectedSessionEvents.length === 0 ? (
                      <div className="text-center text-slate-400 py-20">
                        <RefreshCw className="w-6 h-6 text-slate-350 animate-spin mx-auto mb-2" />
                        <span className="text-xs font-medium">Resolving chronological journey steps...</span>
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6">
                        
                        {/* Connecting track line */}
                        <div className="timeline-line" />

                        {selectedSessionEvents.map((evt, idx) => {
                          const isPageView = evt.eventType === 'page_view';
                          const timeOffsetMs = idx === 0 ? 0 : evt.timestamp - selectedSessionEvents[0].timestamp;
                          const offsetStr = idx === 0 ? 'Commence' : `+${formatDuration(timeOffsetMs)}`;

                          return (
                            <motion.div 
                              key={evt._id || idx} 
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.05, 0.5), type: "spring", stiffness: 220, damping: 20 }}
                              className="relative text-left"
                            >
                              
                              {/* Timeline indicator node */}
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: Math.min(idx * 0.05 + 0.1, 0.6), type: "spring" }}
                                className={`absolute -left-[27px] top-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs z-10 ${isPageView ? 'bg-emerald-500 text-white' : 'bg-[#FF9F43] text-white'}`}
                              >
                                {isPageView ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <MousePointerClick className="w-3 h-3" />
                                )}
                              </motion.span>

                              {/* Card detail wrapper */}
                              <motion.div 
                                whileHover={{ y: -2, boxShadow: "0 8px 16px -8px rgba(0,0,0,0.06)" }}
                                className="bg-white rounded-xl border border-slate-200/70 p-3.5 shadow-xs transition-shadow"
                              >
                                
                                {/* Header action line */}
                                <div className="flex justify-between items-start flex-wrap gap-1 mb-2">
                                  <div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isPageView ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {isPageView ? 'page view' : 'click element'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold ml-2 font-mono uppercase tracking-wide">
                                      {offsetStr}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {formatTimestamp(evt.timestamp)}
                                  </span>
                                </div>

                                {/* Event details core */}
                                {isPageView ? (
                                  <div className="space-y-1.5">
                                    <div className="text-xs font-mono font-bold text-slate-800 break-all leading-relaxed">
                                      {evt.pathname}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex flex-col gap-0.5">
                                      <span className="truncate">URL: <span className="font-semibold text-slate-500 lowercase">{evt.pageUrl}</span></span>
                                      {evt.referrer && <span className="truncate">Referrer: <span className="font-semibold text-slate-500 font-mono">{evt.referrer}</span></span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Action description */}
                                    <div className="text-xs text-slate-800 font-medium">
                                      Clicked <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">"{evt.elementText || '(anonymous element)'}"</span>
                                    </div>

                                    {/* Sizing & coordinates breakdown */}
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-50 rounded-lg p-2 border border-slate-100">
                                      <div className="text-slate-500">
                                        Coordinate Vector:<br />
                                        <span className="text-slate-800 font-bold">X: {evt.x}px | Y: {evt.y}px</span>
                                      </div>
                                      <div className="text-slate-500">
                                        Responsive Float:<br />
                                        <span className="text-slate-850 font-bold text-amber-600">x:{(evt.xPct! * 100).toFixed(0)}% | y:{(evt.yPct! * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="col-span-2 text-slate-400 text-[9px] border-t border-slate-100/80 pt-1 flex justify-between">
                                        <span>Target Element ID: <span className="text-slate-650 font-bold">{evt.elementId || `(unspecified)`}</span></span>
                                        <span>Size: {evt.screenWidth}x{evt.screenHeight}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                              </motion.div>
                            </motion.div>
                          );
                        })}

                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: 2. CLICK HEATMAP VIEW */}
            {activeMainTab === 'heatmap' && (() => {
              // Calculate dynamic vicinity density to filter noise
              const calculateVicinityDensity = (point: TrackedEvent, allPoints: TrackedEvent[]) => {
                let count = 0;
                allPoints.forEach(p => {
                  const dx = (p.xPct || 0) - (point.xPct || 0);
                  const dy = (p.yPct || 0) - (point.yPct || 0);
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist <= 0.08) {
                    count++;
                  }
                });
                return count;
              };

              const filteredClicks = heatmapClicks.filter(c => {
                return calculateVicinityDensity(c, heatmapClicks) >= minDensity;
              });

              return (
                <div className="p-5 flex-1 flex flex-col gap-5 overflow-hidden">
                  
                  {/* Heatmap Filters Controller */}
                   <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between flex-wrap gap-4 select-none">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Focus Page: </label>
                      <select 
                        id="heatmap-path-selector"
                        value={heatmapPath} 
                        onChange={(e) => setHeatmapPath(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-900 px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs cursor-pointer"
                      >
                        {availableRoutesForDomain.map(path => (
                          <option key={path} value={path}>
                            {path} {path === '/home' ? '(Storefront Core)' : path === '/products' ? '(Features Showcase)' : path === '/pricing' ? '(Tier Options)' : path === '/pricing/success' ? '(Success Checkout)' : '(Custom Route)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span>Radius:</span>
                        <input 
                          type="range" 
                          min="8" 
                          max="25" 
                          value={heatmapRadius} 
                          onChange={(e) => setHeatmapRadius(Number(e.target.value))}
                          className="w-16 accent-indigo-600 gap-1.5 scale-90 cursor-ew-resize"
                        />
                        <span className="font-mono text-slate-600 bg-white border border-slate-200 px-1.5 rounded">{heatmapRadius}px</span>
                      </div>

                      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                        <span>Min Density:</span>
                        <input 
                          type="range" 
                          min="1" 
                          max="5" 
                          value={minDensity} 
                          onChange={(e) => setMinDensity(Number(e.target.value))}
                          className="w-14 accent-indigo-600 scale-90 cursor-ew-resize"
                          title="Filter out accidental clicks and single interaction noise"
                        />
                        <span className="font-mono text-slate-600 bg-white border border-slate-200 px-1.5 rounded">
                          {minDensity}x
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                        <input 
                          type="checkbox" 
                          id="thermal-canvas-toggle"
                          checked={showThermalOverlay} 
                          onChange={(e) => setShowThermalOverlay(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                        />
                        <label htmlFor="thermal-canvas-toggle" className="cursor-pointer font-bold text-slate-500 uppercase tracking-widest scale-95 select-none" title="Canvas thermal overlay rendering">Thermal Spectrum</label>
                      </div>

                      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                        <input 
                          type="checkbox" 
                          id="grid-coordinate-toggle"
                          checked={showCoordinateLines} 
                          onChange={(e) => setShowCoordinateLines(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                        />
                        <label htmlFor="grid-coordinate-toggle" className="cursor-pointer font-bold text-slate-500 uppercase tracking-widest scale-95 select-none">Show Grid</label>
                      </div>
                    </div>
                  </div>

                {/* Subtitle count indicator */}
                <div className="flex items-center justify-between text-xs px-1 select-none">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span className="text-slate-600 font-medium">Generated Climax hotspots on path: <strong className="text-indigo-900">{heatmapPath}</strong></span>
                  </div>
                  <span className="bg-amber-50 border border-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                    {heatmapClicks.length} Clicks Registered
                  </span>
                </div>

                {/* Visual Heatmap Wireframe (Relative Click Container) */}
                <div className="relative flex-1 bg-[#F8FAFC] border border-slate-200 rounded-2xl shadow-inner min-h-[460px] overflow-hidden flex flex-col">
                  
                  {/* Canvas Heatmap Overlay rendering */}
                  {showThermalOverlay && (
                    <CanvasHeatmapOverlay clicks={filteredClicks} radius={heatmapRadius} />
                  )}
                  
                  {/* Grid Lines Overlay */}
                  {showCoordinateLines && (
                    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-30 pointer-events-none z-10">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div key={i} className="border-r border-b border-indigo-200 border-dashed" />
                      ))}
                    </div>
                  )}

                  {/* High Fidelity Wireframe Content Mimicking Website Page Layouts */}
                  <div className="flex-1 p-5 overflow-hidden relative flex flex-col justify-between pointer-events-none select-none">
                    
                    {/* Header Menu mockup */}
                    <div className="flex justify-between items-center opacity-40 border-b border-slate-200 pb-2.5 mb-2">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <div className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-xs">CF</div>
                        <span className="text-xs font-black tracking-tight text-slate-800">CausalFunnel Co.</span>
                      </div>
                      <div className="flex gap-4 text-[10px] text-slate-600 font-bold">
                        <span className={heatmapPath === '/home' ? 'text-indigo-600 underline' : ''}>Home</span>
                        <span className={heatmapPath === '/products' ? 'text-indigo-600 underline' : ''}>Products</span>
                        <span className={heatmapPath === '/pricing' ? 'text-indigo-600 underline' : ''}>Pricing</span>
                      </div>
                    </div>

                    {/* Page Wireframe Content matching path */}
                    {heatmapPath === '/home' && (
                      <div className="my-auto space-y-4 w-full">
                        {/* Elite Hero Card */}
                        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-900/40 p-5 rounded-2xl text-center space-y-2.5 max-w-sm mx-auto shadow-md">
                          <span className="text-[8px] bg-indigo-500/25 border border-indigo-400/20 text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest">
                            Realtime Telemetry v2.0
                          </span>
                          <h4 className="text-xs font-extrabold text-white leading-snug">
                            Identify High-Intent Buyers in Real Time
                          </h4>
                          <p className="text-[9px] text-indigo-200/75 max-w-xs mx-auto leading-normal">
                            Keep active checkout funnels alive by launching context-aware customer prompts automatically.
                          </p>
                          <div className="flex justify-center gap-2 pt-1">
                            <div className="bg-indigo-600 text-[9px] font-bold text-white px-3 py-1.5 rounded-xl flex items-center gap-1 border border-indigo-500 shadow-sm shadow-indigo-600/30">
                              <span>See Pricing</span>
                              <ChevronRight className="w-2.5 h-2.5" />
                            </div>
                            <div className="bg-slate-800/80 border border-slate-700 text-slate-300 text-[9px] font-bold px-2.5 py-1.5 rounded-xl">
                              Explore Tech
                            </div>
                          </div>
                        </div>

                        {/* Feature Highlights Grid */}
                        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                          <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs">
                            <div className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5">
                              <BarChart3 className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-[10px] font-extrabold text-slate-800 mb-0.5">Smarter Analytics</div>
                            <div className="text-[8px] text-slate-450 leading-snug">Track relative vector coordinates precisely.</div>
                          </div>
                          
                          <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs">
                            <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                              <Layout className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-[10px] font-extrabold text-slate-800 mb-0.5">Dynamic UI Prompts</div>
                            <div className="text-[8px] text-slate-450 leading-snug">Activate target dialog incentives live.</div>
                          </div>
                        </div>

                        {/* Newsletter Card */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5 max-w-xs mx-auto flex items-center justify-between gap-2">
                          <div className="text-left">
                            <div className="text-[9px] font-bold text-indigo-950">Conversion Newsletter</div>
                            <div className="text-[8px] text-indigo-700/80">Tips sent straight to your logs Weekly</div>
                          </div>
                          <div className="bg-indigo-600 text-white text-[8px] font-black px-2 py-1 rounded">Subscribe</div>
                        </div>
                      </div>
                    )}

                    {heatmapPath === '/products' && (
                      <div className="my-auto space-y-4 w-full">
                        <div className="text-center max-w-xs mx-auto space-y-1">
                          <span className="text-[8px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded font-mono font-bold">Storefront Demo</span>
                          <h4 className="text-xs font-black text-slate-800 tracking-tight">CausalFunnel Products & Sandbox Features</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                          {/* Product Item 1 */}
                          <div className="bg-white border border-slate-200/70 p-3 rounded-xl shadow-xs flex flex-col justify-between h-[125px]">
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="bg-indigo-50 text-indigo-700 text-[8px] font-bold px-1.5 py-0.2 rounded">V2 Core</span>
                                <span className="text-[9px] font-extrabold text-slate-900">$49<span className="text-[7px] text-slate-400 font-normal">/mo</span></span>
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-800">High-Resolution Tracking</h5>
                              <p className="text-[8px] text-slate-405 leading-normal">Precision relative telemetry reporting for external HTML5 client wrappers.</p>
                            </div>
                            <div className="w-full bg-slate-900 text-white text-[9px] font-black py-1.5 rounded-lg text-center">
                              Add To Cart
                            </div>
                          </div>

                          {/* Product Item 2 */}
                          <div className="bg-white border border-slate-200/70 p-3 rounded-xl shadow-xs flex flex-col justify-between h-[125px]">
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.2 rounded">Prompt AI</span>
                                <span className="text-[9px] font-extrabold text-slate-900">$199<span className="text-[7px] text-slate-400 font-normal">/mo</span></span>
                              </div>
                              <h5 className="text-[10px] font-bold text-slate-800">Smart Prompt Server</h5>
                              <p className="text-[8px] text-slate-405 leading-normal">Automated user interventions triggered directly by inactivity behaviors.</p>
                            </div>
                            <div className="w-full bg-indigo-600 text-white text-[9px] font-black py-1.5 rounded-lg text-center">
                              Add To Cart
                            </div>
                          </div>
                        </div>

                        {/* Checkout Promotional Ticket */}
                        <div className="bg-emerald-50/70 border border-emerald-100/80 rounded-xl p-2.5 max-w-xs mx-auto flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-[8px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded uppercase">Special Discount</span>
                            <div className="text-[9px] font-black text-emerald-950 mt-0.5">LAUNCH_OFFER (15% Savings)</div>
                          </div>
                          <div className="bg-emerald-600 text-white text-[8px] font-bold px-2 py-1 rounded">Apply</div>
                        </div>
                      </div>
                    )}

                    {heatmapPath === '/pricing' && (
                      <div className="my-auto space-y-4 w-full">
                        <div className="text-center max-w-xs mx-auto space-y-0.5">
                          <h4 className="text-xs font-black text-slate-800">Simple, Flat-Rate Pricing Tiers</h4>
                          <p className="text-[8px] text-slate-455">Select a plan tier below to instantly simulate guest checkout funnels</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                          {/* Plan 1 */}
                          <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs flex flex-col justify-between h-[120px]">
                            <div>
                              <div className="text-[9px] font-black text-slate-700">Starter Core</div>
                              <div className="text-sm font-black text-slate-900 mt-0.5">$19<span className="text-[8px] text-slate-400 font-semibold">/mo</span></div>
                              <div className="space-y-0.5 mt-1.5">
                                <div className="text-[7px] text-slate-500 font-medium flex items-center gap-1">✓ 10k event steps/mo</div>
                                <div className="text-[7px] text-slate-500 font-medium flex items-center gap-1">✓ 1 domain tracker</div>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 text-slate-800 text-[9px] font-black py-1.5 rounded-lg text-center">
                              Select Starter
                            </div>
                          </div>

                          {/* Plan 2: Pro (Accent) */}
                          <div className="bg-indigo-50/65 border-2 border-indigo-500/60 p-3 rounded-xl shadow-md flex flex-col justify-between h-[120px] relative">
                            <span className="absolute -top-2 right-2 bg-indigo-600 text-white text-[7px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Popular
                            </span>
                            <div>
                              <div className="text-[9px] font-black text-indigo-950">Pro Automator</div>
                              <div className="text-sm font-black text-indigo-950 mt-0.5">$49<span className="text-[8px] text-indigo-400 font-semibold">/mo</span></div>
                              <div className="space-y-0.5 mt-1.5">
                                <div className="text-[7px] text-indigo-900 font-medium flex items-center gap-1">✓ Unlimited events</div>
                                <div className="text-[7px] text-indigo-900 font-medium flex items-center gap-1">✓ Smart WebSocket alerts</div>
                              </div>
                            </div>
                            <div className="w-full bg-indigo-600 text-white text-[9px] font-black py-1.5 rounded-lg text-center">
                              Buy Pro Tier ($49/mo)
                            </div>
                          </div>
                        </div>

                        {/* FAQ Links Section */}
                        <div className="flex justify-between px-6 opacity-60 text-[8px] font-bold text-slate-500">
                          <span className="hover:underline flex items-center gap-0.5">💡 FAQ: How is coordinate scaling calculated?</span>
                          <span className="hover:underline flex items-center gap-0.5">💡 FAQ: Can I whitelist external subdomains?</span>
                        </div>
                      </div>
                    )}

                    {heatmapPath === '/pricing/success' && (
                      <div className="my-auto text-center space-y-3.5 max-w-sm mx-auto w-full">
                        <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
                          <span className="text-base">✓</span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-slate-800">Checkout Complete! Welcome in.</h4>
                          <p className="text-[9px] text-slate-455">Your custom Pro Automator subscription is fully configured and live-telemetry is routing.</p>
                        </div>
                        
                        {/* Transaction Receipt Block */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-left text-[8px] font-mono space-y-0.5 max-w-xs mx-auto tracking-tight opacity-75">
                          <div className="flex justify-between mb-1 border-b border-slate-200 pb-1 text-slate-450 font-bold font-sans">
                            <span>Receipt ID</span>
                            <span>TXN_99812A_SESS</span>
                          </div>
                          <div className="flex justify-between"><span>Product SKU:</span> <span className="font-bold text-slate-800">CausFun_Pro_Mo</span></div>
                          <div className="flex justify-between"><span>Base price:</span> <span className="font-bold text-slate-800">$49.00 USD</span></div>
                          <div className="flex justify-between"><span>Discount applied:</span> <span className="font-bold text-emerald-600 font-sans font-extrabold">-$7.35 USD</span></div>
                        </div>

                        <div className="flex justify-center gap-2 max-w-xs mx-auto">
                          <div className="bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold px-3 py-1.5 rounded-xl">
                            Return Home
                          </div>
                          <div className="bg-slate-900 border border-slate-800 text-white text-[9px] font-bold px-3 py-1.5 rounded-xl">
                            Verify in Dashboard
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fallback Custom/External Route Mockup (Autonomous Page Reconstructor) */}
                    {!['/home', '/products', '/pricing', '/pricing/success'].includes(heatmapPath) && (
                      <div className="my-auto space-y-3.5 w-full text-center">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm max-w-md mx-auto space-y-3 relative z-10">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1.5">
                            <span className="text-[9px] font-black text-indigo-750 uppercase tracking-wider bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded">
                              External Website Node
                            </span>
                            <span className="text-[9px] text-slate-450 font-mono">
                              Host: {filteredClicks[0]?.pageUrl ? new URL(filteredClicks[0].pageUrl).host : 'External Client'}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-left">
                            <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                              <Layout className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Autonomous DOM Layout Analysis</span>
                            </h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              CausalFunnel dynamically reconstructed {filteredClicks.length} active click coordinate nodes intercepted on route <strong className="text-indigo-900">{heatmapPath}</strong>.
                            </p>
                          </div>

                          {/* Reconstructed Hot Elements List */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[10px] text-left space-y-2">
                            <div className="font-extrabold text-slate-450 uppercase tracking-widest text-[8px] border-b border-slate-200 pb-1">
                              Discovered Clickable DOM Selectors
                            </div>
                            <div className="max-h-[110px] overflow-y-auto space-y-1.5 pr-1 font-mono">
                              {(() => {
                                // Group clicks by selector or element text
                                const elementGroups: { [key: string]: { text: string, count: number, id: string } } = {};
                                filteredClicks.forEach(c => {
                                  const key = c.elementId || c.elementText || c.elementSelectorPath || 'anonymous-element';
                                  if (!elementGroups[key]) {
                                    elementGroups[key] = {
                                      text: c.elementText || c.elementId || 'Interactive Element',
                                      count: 0,
                                      id: c.elementId || 'No ID'
                                    };
                                  }
                                  elementGroups[key].count++;
                                });

                                const sortedGroups = Object.values(elementGroups).sort((a,b) => b.count - a.count);
                                
                                if (sortedGroups.length === 0) {
                                  return <div className="text-slate-400 italic text-[9px] py-1.5 text-center">No interactive elements captured. Place click items to preview!</div>
                                }

                                return sortedGroups.map((g, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 p-1.5 rounded-lg text-[9px]">
                                    <div className="truncate max-w-[210px] font-sans">
                                      <span className="font-bold text-slate-800">"{g.text}"</span>
                                      <span className="text-slate-400 block text-[8px] truncate">ID: {g.id}</span>
                                    </div>
                                    <span className="bg-indigo-600 text-white font-extrabold px-1.5 py-0.2 rounded-full font-mono text-[8px]">
                                      {g.count}x
                                    </span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Visual Ghost Elements placing corresponding widgets beneath points */}
                        <div className="absolute inset-0 pointer-events-none opacity-40">
                          {filteredClicks.map((click, i) => {
                            if (click.xPct === undefined || click.yPct === undefined) return null;
                            const left = `${click.xPct * 100}%`;
                            const top = `${click.yPct * 100}%`;
                            return (
                              <div
                                key={i}
                                className="absolute bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5 text-[8px] font-extrabold text-indigo-700 shadow-xs flex items-center gap-1"
                                style={{
                                  left,
                                  top,
                                  transform: 'translate(-50%, -50%)',
                                }}
                              >
                                <span className="w-1 h-1 rounded-full bg-indigo-600 animate-ping" />
                                <span className="truncate max-w-[90px]">{click.elementText || click.elementId || 'DOM Node'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer Mockup */}
                    <div className="flex justify-between items-center opacity-30 pt-2 border-t border-slate-200 mt-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">CF Telemetry Overlay v2.0</span>
                      <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">Relative Vectors</span>
                    </div>

                  </div>

                  {/* Hotspot overlays drawn perfectly by relative percentage on top of sandbox preview boundaries */}
                  <div className="absolute inset-0 z-20 pointer-events-auto">
                    {filteredClicks.map((click, i) => {
                      const absoluteLeft = `${click.xPct! * 100}%`;
                      const absoluteTop = `${click.yPct! * 100}%`;

                      return (
                        <motion.div 
                          key={click._id || i}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 18, delay: Math.min(i * 0.02, 0.3) }}
                          whileHover={{ scale: 1.25, zIndex: 40 }}
                          className="absolute group cursor-pointer"
                          style={{
                            left: absoluteLeft,
                            top: absoluteTop,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {/* Pulsing Radial Heat indicator circle with glowing halo */}
                          <div className="relative">
                            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 blur-[4px] opacity-75 group-hover:opacity-100 transition-opacity animate-pulse" />
                            <div 
                              className="relative rounded-full bg-gradient-to-r from-red-500/90 via-orange-500/90 to-yellow-400/90 shadow-lg shadow-orange-500/50"
                              style={{
                                width: `${heatmapRadius}px`,
                                height: `${heatmapRadius}px`,
                              }}
                            />
                          </div>

                          {/* Dynamic detailed popup hover details card */}
                          <div className="absolute left-1/2 bottom-full mb-2.5 -translate-x-1/2 z-50 hidden group-hover:block w-[210px] bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-2xl select-none font-sans text-xs pointer-events-none transition-all duration-300">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-800 mb-1.5 opacity-90 text-[10px] text-slate-400">
                              <span className="font-bold text-indigo-400">Spot #{i + 1}</span>
                              <span className="font-mono text-emerald-400 font-bold">{(click.xPct! * 100).toFixed(1)}%, {(click.yPct! * 100).toFixed(1)}%</span>
                            </div>
                            <p className="font-bold text-amber-400 mb-1 leading-normal italic">
                              "{click.elementText || '(anonymous click)'}"
                            </p>
                            
                            <div className="space-y-0.5 text-[10px] text-slate-350 font-mono">
                              <div>Element ID: <span className="text-slate-400 underline">{click.elementId || 'Null'}</span></div>
                              
                              {click.elementSelectorPath && (
                                <div className="text-[9px] text-indigo-300 mt-2 pt-2 border-t border-slate-800 break-words leading-tight bg-slate-950/50 p-2 rounded border border-indigo-950">
                                  <strong className="text-indigo-400 block mb-0.5 text-[8px] uppercase tracking-wider font-extrabold font-sans">Selector Inspector:</strong>
                                  {click.elementSelectorPath}
                                </div>
                              )}
                            </div>
                            
                            <p className="text-[9px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-800 flex justify-between">
                              <span>Time: {formatTimestamp(click.timestamp)}</span>
                              <span>Sim size: {click.screenWidth}px</span>
                            </p>
                          </div>

                        </motion.div>
                      );
                    })}

                    {/* Heatmap overlay empty state guidance */}
                    {filteredClicks.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#F8FAFC]/55 pointer-events-none select-none">
                        <div className="text-center max-w-xs space-y-1">
                          <Flame className="w-8 h-8 text-amber-300 mx-auto animate-pulse mb-1" />
                          <h4 className="text-xs font-bold text-slate-600">No heatmap telemetry recorded</h4>
                          <p className="text-[10px] text-slate-500 leading-normal">
                            Either no clicks exist or the Click Density filter is active on route <strong>{heatmapPath}</strong>. Lower density or click structural elements in the Demo Sandbox to instantly see thermal hotspot indicators!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Heatmap intensity gradient metadata legend */}
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 select-none px-1">
                  <span>Legend: </span>
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                    <span>Cool Spot</span>
                    <div className="w-24 h-2 rounded bg-gradient-to-r from-yellow-400 via-orange-500 to-red-650 inline-block rounded-md shadow-xs" />
                    <span>Hot Climax</span>
                  </div>
                  <span className="font-mono text-slate-400">Device Scaled Vector (xPct, yPct)</span>
                </div>

              </div>
            )})()}

            {/* TAB CONTENT: 3. INTEGRATION SPEC SHEET VIEW */}
            {activeMainTab === 'integration' && (
              <div className="p-6 select-none space-y-5 text-left">
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">CausalFunnel REST API Protocol Specification</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  For native applet frameworks and microservices, target API events can be relayed asynchronously directly onto HTTP endpoints.
                </p>

                <div className="space-y-4">
                  {/* Endpoint 1 */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded">POST /api/events</span>
                      <span className="text-[10px] font-extrabold text-emerald-600">JSON Payload</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Receives and commits single event tracks or structured batches. Keeps session statistics coherent.
                    </p>
                  </div>

                  {/* Endpoint 2 */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded">GET /api/sessions</span>
                      <span className="text-[10px] font-extrabold text-indigo-600">JSON List</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Returns descending list of sessions aggregated dynamically including page count sizes and duration bounds.
                    </p>
                  </div>

                  {/* Endpoint 3 */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded">GET /api/sessions/:sessionId/events</span>
                      <span className="text-[10px] font-extrabold text-teal-600">Trace Array</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Fetches chronological step list of page_view and click instances associated with a target session.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </section>

      </main>

      {/* Subtle Developer footer metadata */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-6 text-center select-none space-y-1">
        <p className="text-xs text-slate-400 font-medium">CausalFunnel - Crafted for Assessment Analysis</p>
        <p className="text-[11px] text-slate-400">© {new Date().getFullYear()} CausalFunnel. All rights reserved.</p>
      </footer>

      {confirmModal && (
        <div id="custom-confirm-modal" className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 shrink-0">
                <HelpCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/10 transition cursor-pointer"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
