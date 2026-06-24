import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './src/backend/db';

function parseUA(uaString: string) {
  const ua = uaString || '';
  let deviceType = 'Desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|webos/i.test(ua)) {
    deviceType = 'Mobile';
  }
  
  let browserName = 'Other';
  if (/chrome|crios/i.test(ua)) {
    browserName = 'Chrome';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browserName = 'Safari';
  } else if (/firefox|fxios/i.test(ua)) {
    browserName = 'Firefox';
  } else if (/opr/i.test(ua)) {
    browserName = 'Opera';
  } else if (/edg/i.test(ua)) {
    browserName = 'Edge';
  }
  return { deviceType, browserName };
}

async function getGeoLocation(ip: string) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.') || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    const defaultLocations = [
      { country: 'United States', city: 'San Francisco' },
      { country: 'United States', city: 'New York' },
      { country: 'United Kingdom', city: 'London' },
      { country: 'Germany', city: 'Berlin' },
      { country: 'Canada', city: 'Toronto' },
      { country: 'India', city: 'Mumbai' },
      { country: 'Japan', city: 'Tokyo' },
      { country: 'Singapore', city: 'Singapore' }
    ];
    return defaultLocations[Math.floor(Math.random() * defaultLocations.length)];
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return { country: data.country || 'United States', city: data.city || 'New York' };
      }
    }
  } catch (err) {
    console.warn('Geolocation lookup warning:', err);
  }
  return { country: 'United States', city: 'New York' };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Automatically allow full CORS access for any external domain requests and preflight OPTIONS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Handle OPTIONS preflight requests immediately
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Middleware to parse incoming request payloads
  app.use(express.json());

  // Automatically manage telemetry seeding/cleanup based on user preferences and database mode
  try {
    const isMongoConfigured = !!process.env.MONGODB_URI;
    if (isMongoConfigured) {
      console.log('MongoDB cluster linked. Proactively clearing any pre-existing mock records to ensure pristine official data...');
      await db.removeSampleData();
    } else {
      await db.seedSampleData();
      console.log('Local JSON fallback database loaded and seeded successfully.');
    }
  } catch (error) {
    console.error('Error during database initialization/cleanup:', error);
  }

  // --- API Routes ---

  // 1. Post Event (Store single tracking logs)
  app.post('/api/events', async (req, res) => {
    try {
      const payload = req.body;
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      const geo = await getGeoLocation(ip);
      const uaInfo = parseUA(payload.userAgent || req.headers['user-agent'] || '');

      const enrichEvent = (item: any) => ({
        ...item,
        timestamp: item.timestamp || Date.now(),
        deviceType: item.deviceType || uaInfo.deviceType,
        browserName: item.browserName || uaInfo.browserName,
        country: item.country || geo.country,
        city: item.city || geo.city
      });

      // Support batch inserting
      if (Array.isArray(payload)) {
        if (payload.length === 0) {
          res.status(400).json({ error: 'Empty event batch' });
          return;
        }
        const enrichedBatch = payload.map(enrichEvent);
        const results = await db.insertEvents(enrichedBatch);
        if ((global as any).broadcastTelemetry) {
          results.forEach(event => {
            (global as any).broadcastTelemetry({ type: 'TELEMETRY_EVENT', data: event });
          });
        }
        res.status(201).json({ success: true, count: results.length, data: results });
        return;
      }

      // Single item insertion
      if (!payload.sessionId || !payload.eventType || !payload.pageUrl) {
        res.status(400).json({ error: 'Missing critical parameters: sessionId, eventType, pageUrl' });
        return;
      }

      const enriched = enrichEvent(payload);
      const result = await db.insertEvent(enriched);
      if ((global as any).broadcastTelemetry) {
        (global as any).broadcastTelemetry({ type: 'TELEMETRY_EVENT', data: result });
      }
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error('Failed to store event:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 2. Fetch all sessions with dynamic counts
  app.get('/api/sessions', async (req, res) => {
    try {
      const sessions = await db.getSessions();
      res.json(sessions);
    } catch (err: any) {
      console.error('Failed to load sessions:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 3. Fetch ordered events for specific session
  app.get('/api/sessions/:sessionId/events', async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing sessionId parameter' });
        return;
      }
      const events = await db.getSessionEvents(sessionId);
      res.json(events);
    } catch (err: any) {
      console.error(`Failed to fetch events for session ${req.params.sessionId}:`, err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 4. Fetch click coordinates for heatmap with page filters
  app.get('/api/heatmap', async (req, res) => {
    try {
      const pageUrl = req.query.pageUrl as string;
      if (!pageUrl) {
        res.status(400).json({ error: 'Missing pageUrl query parameter' });
        return;
      }
      const coordinates = await db.getClicksForPage(pageUrl);
      res.json(coordinates);
    } catch (err: any) {
      console.error('Failed to aggregate heatmap coords:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 5. Developer clear events endpoint
  app.post('/api/reset', async (req, res) => {
    try {
      await db.clearDb();
      res.json({ success: true, message: 'Database reset successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 6. Developer re-seed standard datasets
  app.post('/api/seed', async (req, res) => {
    try {
      await db.clearDb();
      await db.seedSampleData(true);
      res.json({ success: true, message: 'Database cleared and re-seeded with mock telemetry' });
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 6b. Database and Cloud Storage status diagnostics
  app.get('/api/db-status', (req, res) => {
    try {
      const status = db.getConnectionStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 7. Get tracked routes currently gathering interactions in logs
  app.get('/api/tracked-routes', async (req, res) => {
    try {
      const routes = await db.getTrackedRoutes();
      res.json(routes);
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Serve client-side JS script dynamically to integrate with static web embeds
  app.get('/tracker.js', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers.host || 'localhost:3000';
    const serverOrigin = `${protocol}://${host}`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(`
/**
 * CausalFunnel Analytics Tracker Script v1.0
 * Embed this script dynamically on any page to track customer interactions with WebSockets.
 */
(function() {
  // Gracefully calculate active target backend from script src origin or fallback to server origin
  let scriptOrigin = '';
  if (document.currentScript && document.currentScript.src) {
    try {
      scriptOrigin = new URL(document.currentScript.src).origin;
    } catch (e) {}
  }
  const API_ENDPOINT = (scriptOrigin || '${serverOrigin}') + '/api/events';
  const SESSION_KEY = 'cf_analytics_session_id';
  const LAST_ACTIVE_KEY = 'cf_analytics_last_active';
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  let idleTimer = null;
  let isSessionActive = true;

  function getOrCreateSessionId() {
    let sessId = localStorage.getItem(SESSION_KEY);
    if (!sessId) {
      sessId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem(SESSION_KEY, sessId);
    }
    return sessId;
  }

  const sessionId = getOrCreateSessionId();

  function sendEvent(eventData, isUnloading = false) {
    const payload = JSON.stringify(eventData);
    if (isUnloading && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(API_ENDPOINT, blob);
    } else {
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(err => console.warn('CausalFunnel Tracker dispatch failed', err));
    }
  }

  function getBaseContext() {
    return {
      sessionId: sessionId,
      pageUrl: window.location.href,
      pathname: window.location.pathname,
      timestamp: Date.now(),
      referrer: document.referrer || '',
      userAgent: navigator.userAgent
    };
  }

  function getElementSelectorPath(el) {
    try {
      if (!el || el.nodeType !== 1) return '';
      const parts = [];
      let cur = el;
      while (cur && cur.nodeType === 1) {
        let name = cur.nodeName.toLowerCase();
        if (cur.id) {
          name += '#' + cur.id;
          parts.unshift(name);
          break; // Stop climbing when tag has unique ID
        } else {
          if (cur.className && typeof cur.className === 'string') {
            const firstClass = cur.className.trim().split(/\\s+/)[0];
            if (firstClass && !firstClass.includes(':')) {
              name += '.' + firstClass;
            }
          }
          parts.unshift(name);
        }
        cur = cur.parentNode;
      }
      return parts.join(' ➔ ');
    } catch (e) {
      return '';
    }
  }

  function trackPageView() {
    const data = Object.assign(getBaseContext(), {
      eventType: 'page_view'
    });
    setTimeout(function() {
      sendEvent(data);
    }, 100);
  }

  function handleDocumentClick(event) {
    if (!isSessionActive) return;
    
    const base = getBaseContext();
    const scrollW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const scrollH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const absoluteX = event.pageX;
    const absoluteY = event.pageY;
    const pctX = scrollW > 0 ? Number((absoluteX / scrollW).toFixed(4)) : 0;
    const pctY = scrollH > 0 ? Number((absoluteY / scrollH).toFixed(4)) : 0;

    let targetEl = event.target;
    let targetId = targetEl.id || '';
    let targetText = (targetEl.innerText || targetEl.value || '').trim().substring(0, 50);
    let selectorPath = getElementSelectorPath(targetEl);

    const clickData = Object.assign(base, {
      eventType: 'click',
      x: absoluteX,
      y: absoluteY,
      xPct: pctX,
      yPct: pctY,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      elementId: targetId,
      elementText: targetText,
      elementSelectorPath: selectorPath
    });

    sendEvent(clickData);
    resetInactivityTimer();
  }

  function fireSessionEnd() {
    if (!isSessionActive) return;
    isSessionActive = false;
    
    const data = Object.assign(getBaseContext(), {
      eventType: 'session_end'
    });
    
    sendEvent(data, true);
    localStorage.removeItem(SESSION_KEY);
    console.log('CausalFunnel Tracking Agent: Session terminated due to inactivity.');
  }

  function resetInactivityTimer() {
    if (!isSessionActive) return;
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(fireSessionEnd, INACTIVITY_TIMEOUT);
  }

  // Hook sliding activity reset listeners
  const eventsToReset = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'focus'];
  eventsToReset.forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
  });

  // Check last active state on boot
  const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
  if (lastActive) {
    const idleDuration = Date.now() - parseInt(lastActive, 10);
    if (idleDuration > INACTIVITY_TIMEOUT) {
      // Create new session ID right away
      localStorage.removeItem(SESSION_KEY);
    }
  }

  // Event hookup
  if (document.readyState === 'complete') {
    trackPageView();
  } else {
    window.addEventListener('load', trackPageView);
  }

  document.addEventListener('click', handleDocumentClick, true);
  resetInactivityTimer();
  console.log('CausalFunnel Analytics script operating. Active Session ID: ' + sessionId);
})();
    `);
  });

  // --- UI Integration Layer ---

  // Vite middleware or express.static depending on development status
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start listen binds strictly on port 3000 to direct incoming reverse proxies
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server launched successfully at http://localhost:${PORT}`);
  });

  // Upgrade and attach real-time WebSocket protocol
  const wss = new WebSocketServer({ server });
  const wsClients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log(`Real-Time updates: New listener client connected (Pool: ${wsClients.size})`);
    
    ws.on('close', () => {
      wsClients.delete(ws);
      console.log(`Real-Time updates: Client closed connection (Pool: ${wsClients.size})`);
    });
  });

  // Broadcast channel
  (global as any).broadcastTelemetry = (event: any) => {
    const payload = JSON.stringify(event);
    for (const ws of wsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  };
}

startServer();
