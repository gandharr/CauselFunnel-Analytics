import { TrackedEvent, SessionSummary } from './types';

// Storage key
const STORAGE_KEY = 'causalfunnel_vdb_events';

// Default seeded events helper
function getSeedEvents(): TrackedEvent[] {
  const now = Date.now();
  const sampleEvents: TrackedEvent[] = [];

  // ⚠️ DEMO DATA - These are sample events for testing. Clear them to see only real tracking data.
  // Session 1: Alpha user (Purchasing flow)
  const s1Start = now - 1000 * 60 * 45; // 45 mins ago
  sampleEvents.push({
    _id: 'alpha_1',
    sessionId: 'sess_user_alpha',
    eventType: 'page_view',
    pageUrl: 'https://causalfunnel-demo.com/home',
    pathname: '/home',
    timestamp: s1Start,
    referrer: 'https://google.com',
    userAgent: 'Mozilla/5.0 Chrome 123.0',
    deviceType: 'Desktop',
    browserName: 'Chrome',
    country: 'United States',
    city: 'San Francisco',
    isDemo: true, // Mark as demo data
  });

  sampleEvents.push({
    _id: 'alpha_2',
    sessionId: 'sess_user_alpha',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/home',
    pathname: '/home',
    timestamp: s1Start + 15 * 1000,
    x: 320,
    y: 180,
    xPct: 0.25,
    yPct: 0.18,
    screenWidth: 1280,
    screenHeight: 800,
    elementId: 'hero-btn-cta',
    elementText: 'See Pricing',
    deviceType: 'Desktop',
    browserName: 'Chrome',
    country: 'United States',
    city: 'San Francisco',
  });

  sampleEvents.push({
    _id: 'alpha_3',
    sessionId: 'sess_user_alpha',
    eventType: 'page_view',
    pageUrl: 'https://causalfunnel-demo.com/pricing',
    pathname: '/pricing',
    timestamp: s1Start + 18 * 1000,
    referrer: 'https://causalfunnel-demo.com/home',
    userAgent: 'Mozilla/5.0 Chrome 123.0',
    deviceType: 'Desktop',
    browserName: 'Chrome',
    country: 'United States',
    city: 'San Francisco',
  });

  sampleEvents.push({
    _id: 'alpha_4',
    sessionId: 'sess_user_alpha',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/pricing',
    pathname: '/pricing',
    timestamp: s1Start + 45 * 1000,
    x: 640,
    y: 420,
    xPct: 0.50,
    yPct: 0.52,
    screenWidth: 1280,
    screenHeight: 800,
    elementId: 'pricing-tier-pro',
    elementText: 'Buy Pro Tier ($49/mo)',
    deviceType: 'Desktop',
    browserName: 'Chrome',
    country: 'United States',
    city: 'San Francisco',
  });

  sampleEvents.push({
    _id: 'alpha_5',
    sessionId: 'sess_user_alpha',
    eventType: 'page_view',
    pageUrl: 'https://causalfunnel-demo.com/pricing/success',
    pathname: '/pricing/success',
    timestamp: s1Start + 48 * 1000,
    referrer: 'https://causalfunnel-demo.com/pricing',
    userAgent: 'Mozilla/5.0 Chrome 123.0',
    deviceType: 'Desktop',
    browserName: 'Chrome',
    country: 'United States',
    city: 'San Francisco',
  });

  // Session 2: Beta user (Reading products but leaving)
  const s2Start = now - 1000 * 60 * 20; // 20 mins ago
  sampleEvents.push({
    _id: 'beta_1',
    sessionId: 'sess_user_beta',
    eventType: 'page_view',
    pageUrl: 'https://causalfunnel-demo.com/home',
    pathname: '/home',
    timestamp: s2Start,
    referrer: 'https://twitter.com',
    userAgent: 'Mozilla/5.0 Mobile Safari 17.0',
    deviceType: 'Mobile',
    browserName: 'Safari',
    country: 'United Kingdom',
    city: 'London',
  });

  sampleEvents.push({
    _id: 'beta_2',
    sessionId: 'sess_user_beta',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/home',
    pathname: '/home',
    timestamp: s2Start + 8 * 1000,
    x: 150,
    y: 200,
    xPct: 0.35,
    yPct: 0.51,
    screenWidth: 430,
    screenHeight: 932,
    elementId: 'nav-products',
    elementText: 'Browse Products',
    deviceType: 'Mobile',
    browserName: 'Safari',
    country: 'United Kingdom',
    city: 'London',
  });

  sampleEvents.push({
    _id: 'beta_3',
    sessionId: 'sess_user_beta',
    eventType: 'page_view',
    pageUrl: 'https://causalfunnel-demo.com/products',
    pathname: '/products',
    timestamp: s2Start + 9 * 1000,
    referrer: 'https://causalfunnel-demo.com/home',
    userAgent: 'Mozilla/5.0 Mobile Safari 17.0',
    deviceType: 'Mobile',
    browserName: 'Safari',
    country: 'United Kingdom',
    city: 'London',
  });

  sampleEvents.push({
    _id: 'beta_4',
    sessionId: 'sess_user_beta',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/products',
    pathname: '/products',
    timestamp: s2Start + 22 * 1000,
    x: 215,
    y: 450,
    xPct: 0.50,
    yPct: 0.48,
    screenWidth: 430,
    screenHeight: 932,
    elementId: 'product-item-card-1',
    elementText: 'View Smart Funnel',
    deviceType: 'Mobile',
    browserName: 'Safari',
    country: 'United Kingdom',
    city: 'London',
  });

  sampleEvents.push({
    _id: 'beta_5',
    sessionId: 'sess_user_beta',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/products',
    pathname: '/products',
    timestamp: s2Start + 45 * 1000,
    x: 380,
    y: 50,
    xPct: 0.88,
    yPct: 0.05,
    screenWidth: 430,
    screenHeight: 932,
    elementId: 'mobile-menu-btn',
    elementText: 'Menu',
    deviceType: 'Mobile',
    browserName: 'Safari',
    country: 'United Kingdom',
    city: 'London',
  });

  // Session 3: Gamma user (Browsing and clicking heavily)
  const s3Start = now - 1000 * 60 * 5; // 5 mins ago
  sampleEvents.push({
    _id: 'gamma_1',
    sessionId: 'sess_user_gamma',
    eventType: 'page_view',
    pageUrl: 'https://causalfunnel-demo.com/pricing',
    pathname: '/pricing',
    timestamp: s3Start,
    referrer: '',
    userAgent: 'Mozilla/5.0 Firefox 120.0',
    deviceType: 'Desktop',
    browserName: 'Firefox',
    country: 'Germany',
    city: 'Berlin',
  });

  sampleEvents.push({
    _id: 'gamma_2',
    sessionId: 'sess_user_gamma',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/pricing',
    pathname: '/pricing',
    timestamp: s3Start + 3 * 1000,
    x: 480,
    y: 350,
    xPct: 0.38,
    yPct: 0.44,
    screenWidth: 1280,
    screenHeight: 800,
    elementId: 'faq-toggle-1',
    elementText: 'How refunds work?',
    deviceType: 'Desktop',
    browserName: 'Firefox',
    country: 'Germany',
    city: 'Berlin',
  });

  sampleEvents.push({
    _id: 'gamma_3',
    sessionId: 'sess_user_gamma',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/pricing',
    pathname: '/pricing',
    timestamp: s3Start + 12 * 1000,
    x: 490,
    y: 430,
    xPct: 0.38,
    yPct: 0.54,
    screenWidth: 1280,
    screenHeight: 800,
    elementId: 'faq-toggle-2',
    elementText: 'Integrates with Shopify?',
    deviceType: 'Desktop',
    browserName: 'Firefox',
    country: 'Germany',
    city: 'Berlin',
  });

  sampleEvents.push({
    _id: 'gamma_4',
    sessionId: 'sess_user_gamma',
    eventType: 'click',
    pageUrl: 'https://causalfunnel-demo.com/pricing',
    pathname: '/pricing',
    timestamp: s3Start + 18 * 1000,
    x: 820,
    y: 450,
    xPct: 0.64,
    yPct: 0.56,
    screenWidth: 1280,
    screenHeight: 800,
    elementId: 'pricing-tier-enterprise',
    elementText: 'Contact Enterprise Sales',
    deviceType: 'Desktop',
    browserName: 'Firefox',
    country: 'Germany',
    city: 'Berlin',
  });

  return sampleEvents;
}

// Read events from localStorage
export function getEventsFromStorage(): TrackedEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Start with empty events on GitHub Pages - only track real clicks, not demo data
      // Users can click "Load Demo" button if they want to see sample data
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse virtual storage:', e);
    return [];
  }
}

// Write events to localStorage
export function saveEventsToStorage(events: TrackedEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('Failed to write to virtual storage:', e);
  }
}

// Generate session summaries based on events
export function getSessionSummaries(events: TrackedEvent[]): SessionSummary[] {
  const groups: { [key: string]: TrackedEvent[] } = {};
  events.forEach(evt => {
    if (!groups[evt.sessionId]) {
      groups[evt.sessionId] = [];
    }
    groups[evt.sessionId].push(evt);
  });

  return Object.keys(groups).map(sessId => {
    const sessEvents = groups[sessId].sort((a, b) => a.timestamp - b.timestamp);
    const first = sessEvents[0];
    const last = sessEvents[sessEvents.length - 1];

    const clicks = sessEvents.filter(e => e.eventType === 'click').length;
    const pageViews = sessEvents.filter(e => e.eventType === 'page_view').length;
    const uniqueUrls = Array.from(new Set(sessEvents.map(e => e.pageUrl).filter(Boolean)));

    return {
      sessionId: sessId,
      totalEvents: sessEvents.length,
      clicks,
      pageViews,
      createdAt: first.timestamp,
      lastActive: last.timestamp,
      durationMs: Math.max(last.timestamp - first.timestamp, 1000),
      deviceType: first.deviceType || 'Desktop',
      browserName: first.browserName || 'Chrome',
      country: first.country || 'United States',
      city: first.city || 'San Francisco',
      domains: ['causalfunnel-demo.com'],
      pageUrls: uniqueUrls,
    };
  }).sort((a, b) => b.lastActive - a.lastActive);
}

// Get standard geolocation and browser properties
function mockGeoAndUA(uaString: string) {
  let deviceType = 'Desktop';
  if (/mobile|iphone|ipod|android/i.test(uaString)) {
    deviceType = 'Mobile';
  } else if (/tablet|ipad/i.test(uaString)) {
    deviceType = 'Tablet';
  }

  let browserName = 'Chrome';
  if (/firefox/i.test(uaString)) {
    browserName = 'Firefox';
  } else if (/safari/i.test(uaString) && !/chrome/i.test(uaString)) {
    browserName = 'Safari';
  } else if (/edge/i.test(uaString)) {
    browserName = 'Edge';
  }

  const cities = [
    { country: 'United States', city: 'San Francisco' },
    { country: 'United States', city: 'Boston' },
    { country: 'Canada', city: 'Vancouver' },
    { country: 'Australia', city: 'Sydney' },
    { country: 'India', city: 'Bangalore' },
  ];
  const selectedGeo = cities[Math.abs(uaString.length) % cities.length];

  return { deviceType, browserName, ...selectedGeo };
}

// Interceptor hook
export function setupVirtualBackend() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Only intercept requests starting with /api/
    if (urlStr.includes('/api/')) {
      console.log('Virtual API Intercepted Request:', urlStr, init);

      try {
        const events = getEventsFromStorage();

        // 1. POST /api/events
        if (urlStr.includes('/api/events') && init?.method === 'POST') {
          const body = JSON.parse(init.body as string);
          
          const handleSingleEvent = (payload: any) => {
            const enrich = mockGeoAndUA(payload.userAgent || navigator.userAgent);
            const newEvent: TrackedEvent = {
              _id: 'evt_' + Math.random().toString(36).substring(2, 11),
              ...payload,
              timestamp: payload.timestamp || Date.now(),
              deviceType: payload.deviceType || enrich.deviceType,
              browserName: payload.browserName || enrich.browserName,
              country: payload.country || enrich.country,
              city: payload.city || enrich.city,
            };
            return newEvent;
          };

          let addedEvents: TrackedEvent[] = [];
          if (Array.isArray(body)) {
            addedEvents = body.map(handleSingleEvent);
          } else {
            addedEvents = [handleSingleEvent(body)];
          }

          const updatedEvents = [...events, ...addedEvents];
          saveEventsToStorage(updatedEvents);

          // Dispatch custom window events instantly for live-stream dashboard updates!
          addedEvents.forEach(evt => {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('virtual-telemetry-event', { detail: evt }));
            }, 50);
          });

          return new Response(JSON.stringify({ success: true, count: addedEvents.length, data: addedEvents }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 2. GET /api/sessions
        if (urlStr.includes('/api/sessions') && !urlStr.includes('/events')) {
          const summaries = getSessionSummaries(events);
          return new Response(JSON.stringify(summaries), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 3. GET /api/sessions/:sessionId/events
        const sessionEventsMatch = urlStr.match(/\/api\/sessions\/([^/]+)\/events/);
        if (sessionEventsMatch) {
          const sessionId = sessionEventsMatch[1];
          const filtered = events
            .filter(e => e.sessionId === sessionId)
            .sort((a, b) => a.timestamp - b.timestamp);
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 4. GET /api/heatmap?pageUrl=...
        if (urlStr.includes('/api/heatmap')) {
          const urlObj = new URL(urlStr, window.location.origin);
          const pageUrl = urlObj.searchParams.get('pageUrl') || '';
          const filtered = events.filter(e => {
            if (e.eventType !== 'click') return false;
            return e.pathname === pageUrl || e.pageUrl === pageUrl || e.pageUrl.endsWith(pageUrl);
          });
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 5. GET /api/tracked-routes
        if (urlStr.includes('/api/tracked-routes')) {
          const pathsSet = new Set<string>();
          events.forEach(e => {
            if (e.pathname) pathsSet.add(e.pathname);
          });
          const paths = Array.from(pathsSet);
          if (paths.length === 0) {
            paths.push('/home', '/products', '/pricing');
          }
          return new Response(JSON.stringify(paths), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 6. GET /api/db-status
        if (urlStr.includes('/api/db-status')) {
          return new Response(JSON.stringify({
            connected: true,
            mode: 'Serverless Offline Client-Side (Demo)',
            message: 'Local browser storage loaded successfully. No Node backend needed.',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 7. POST /api/reset
        if (urlStr.includes('/api/reset') && init?.method === 'POST') {
          saveEventsToStorage([]);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 8. POST /api/seed
        if (urlStr.includes('/api/seed') && init?.method === 'POST') {
          const seeded = getSeedEvents();
          saveEventsToStorage(seeded);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

      } catch (err) {
        console.error('Virtual backend error:', err);
        return new Response(JSON.stringify({ error: 'Virtual server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return originalFetch(input, init);
  };

  console.log('🚀 Virtual Serverless Interceptor activated successfully for static hosting fallbacks.');
}
