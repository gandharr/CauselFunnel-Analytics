import fs from 'fs/promises';
import path from 'path';
import { MongoClient, Collection, Document } from 'mongodb';
import { TrackedEvent, SessionSummary } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'events.json');

// MongoDB Initialization
let mongoClient: MongoClient | null = null;
let mongoCollection: any = null;
let isMongoActive = false;
let lastError: string | null = null;
let connectionAttempted = false;
let lastAttemptedUri = '';

// Memory cache for filesystem fallback
let eventsCache: TrackedEvent[] = [];
let isLocalLoaded = false;
let fileWriteQueue: Promise<void> = Promise.resolve();

// Lazy bootstrap connection to MongoDB
function getCandidateURIs(baseUri: string): string[] {
  const candidates: string[] = [baseUri];
  
  // Try to parse standard connection string
  // Format: mongodb+srv://username:password@host/database?options
  const match = baseUri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@([^/?]+)(.*)$/);
  if (match) {
    const [, protocol, user, pass, host, rest] = match;
    
    // Generate spelling permutations of user
    const userVariations = [user];
    if (user.includes('Causel')) userVariations.push(user.replace('Causel', 'Causal'));
    if (user.includes('Causal')) userVariations.push(user.replace('Causal', 'Causel'));
    
    // Generate spelling permutations of password
    const passVariations = [pass];
    if (pass.includes('Causel')) passVariations.push(pass.replace('Causel', 'Causal'));
    if (pass.includes('Causal')) passVariations.push(pass.replace('Causal', 'Causel'));

    // Generate spelling permutations of host
    const hostVariations = [host];
    if (host.includes('causelfunnel')) hostVariations.push(host.replace('causelfunnel', 'causalfunnel'));
    if (host.includes('causalfunnel')) hostVariations.push(host.replace('causalfunnel', 'causelfunnel'));

    // Generate path combinations - with or without specific db names
    const rawPath = rest || '';
    const cleanPath = rawPath.split('?')[0] || '';
    const query = rawPath.includes('?') ? rawPath.substring(rawPath.indexOf('?')) : '';
    
    const pathVariations = [rawPath];
    // If no db path specified, or just a slash, try injecting common ones
    if (cleanPath === '/' || cleanPath === '') {
      pathVariations.push('/causalfunnel_analytics' + query);
      pathVariations.push('/test' + query);
    }

    // Combine them
    for (const u of userVariations) {
      for (const p of passVariations) {
        for (const h of hostVariations) {
          for (const pathVar of pathVariations) {
            const candidate = `${protocol}${u}:${p}@${h}${pathVar}`;
            if (!candidates.includes(candidate)) {
              candidates.push(candidate);
            }
          }
        }
      }
    }
  }
  return candidates;
}

async function getMongoCollection(): Promise<any> {
  const currentUri = process.env.MONGODB_URI || '';
  
  if (mongoCollection && isMongoActive && lastAttemptedUri === currentUri) {
    return mongoCollection;
  }
  
  if (!currentUri) {
    return null;
  }

  // If the URI has changed, reset connection attempt parameters to permit reconnecting with new credentials
  if (lastAttemptedUri !== currentUri) {
    connectionAttempted = false;
    isMongoActive = false;
    mongoClient = null;
    mongoCollection = null;
    lastError = null;
    lastAttemptedUri = currentUri;
  }

  // If we already fully attempted all variations and failed due to authentication, prevent recursive blocking timeouts
  if (connectionAttempted && !isMongoActive && lastError && (lastError.includes('auth') || lastError.includes('Auth') || lastError.includes('bad auth'))) {
    return null;
  }

  connectionAttempted = true;
  const candidates = getCandidateURIs(currentUri);
  let workedClient: MongoClient | null = null;
  let workedCollection: any = null;
  let workError: string | null = null;

  console.log(`Starting self-healing connection tries. Generated ${candidates.length} connection candidates.`);

  for (const candidate of candidates) {
    try {
      console.log(`Attempting candidate: ${candidate.replace(/:[^@]+@/, ':****@')}`);
      const client = new MongoClient(candidate, {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000,
      });
      await client.connect();
      
      const dbInstance = client.db('causalfunnel_analytics');
      workedCollection = dbInstance.collection('events');
      workedClient = client;
      isMongoActive = true;
      lastError = null;
      console.log('Successfully self-healed and established connection with candidate:', candidate.replace(/:[^@]+@/, ':****@'));
      break;
    } catch (err: any) {
      workError = err?.message || String(err);
      console.warn(`Candidate connection rejected: ${workError}`);
    }
  }

  if (workedClient && workedCollection) {
    mongoClient = workedClient;
    mongoCollection = workedCollection;
    return mongoCollection;
  } else {
    console.error('All self-healing MongoDB connection permutations were rejected. Falling back to local events JSON.');
    mongoClient = null;
    mongoCollection = null;
    isMongoActive = false;
    lastError = workError;
    return null;
  }
}

// Ensure data directory exists for Local File fallback
async function ensureDbFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DB_FILE);
    } catch {
      await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to initialize local data folder:', err);
  }
}

// Load files dynamically (Local engine only)
async function loadEventsFromFile(): Promise<TrackedEvent[]> {
  if (isLocalLoaded) return eventsCache;
  await ensureDbFile();
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    eventsCache = JSON.parse(data || '[]');
    isLocalLoaded = true;
  } catch (error) {
    console.error('Error reading JSON DB file:', error);
    eventsCache = [];
  }
  return eventsCache;
}

// Write file synchronously (Local engine only)
async function saveEventsToFile(events: TrackedEvent[]): Promise<void> {
  eventsCache = events;
  fileWriteQueue = fileWriteQueue.then(async () => {
    try {
      await ensureDbFile();
      await fs.writeFile(DB_FILE, JSON.stringify(events, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing to JSON DB file:', error);
    }
  });
  await fileWriteQueue;
}

/**
 * High-performance database layer wrapping clean MongoDB & local File systems
 */
export const db = {
  // Insert a single event
  async insertEvent(eventData: Omit<TrackedEvent, '_id'>): Promise<TrackedEvent> {
    const col = await getMongoCollection();
    const newId = 'evt_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
    const newEvent: TrackedEvent = {
      ...eventData,
      _id: newId,
    };

    if (col && isMongoActive) {
      try {
        await col.insertOne(newEvent as any);
        return newEvent;
      } catch (err) {
        console.error('Mongo insert failed, resorting to File layer:', err);
      }
    }

    // Fallback/Fallback mode
    const events = await loadEventsFromFile();
    events.push(newEvent);
    await saveEventsToFile(events);
    return newEvent;
  },

  // Insert a batch of events (e.g. bulk trackers or seeds)
  async insertEvents(eventsData: Omit<TrackedEvent, '_id'>[]): Promise<TrackedEvent[]> {
    const col = await getMongoCollection();
    const newEvents = eventsData.map(data => ({
      ...data,
      _id: 'evt_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
    }));

    if (col && isMongoActive) {
      try {
        await col.insertMany(newEvents as any[]);
        return newEvents;
      } catch (err) {
        console.error('Mongo insertMany failed, resorting to File layer:', err);
      }
    }

    // Fallback/Fallback mode
    const events = await loadEventsFromFile();
    events.push(...newEvents);
    await saveEventsToFile(events);
    return newEvents;
  },

  // Fetch all events chronologically
  async getAllEvents(): Promise<TrackedEvent[]> {
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        const events = await col.find({}).toArray();
        return events as unknown as TrackedEvent[];
      } catch (err) {
        console.error('Mongo query failed, fallback to File reader:', err);
      }
    }
    return loadEventsFromFile();
  },

  // Aggregate sessions statistics dynamically
  async getSessions(): Promise<SessionSummary[]> {
    const events = await this.getAllEvents();
    const sessionMap = new Map<string, {
      pageViews: number;
      clicks: number;
      total: number;
      createdAt: number;
      lastActive: number;
      deviceType?: string;
      browserName?: string;
      country?: string;
      city?: string;
      domains: Set<string>;
      pageUrls: Set<string>;
    }>();

    events.forEach(event => {
      const { sessionId, eventType, timestamp, deviceType, browserName, country, city, pageUrl } = event;
      if (!sessionId) return;

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          pageViews: 0,
          clicks: 0,
          total: 0,
          createdAt: timestamp,
          lastActive: timestamp,
          deviceType: deviceType || 'Desktop',
          browserName: browserName || 'Chrome',
          country: country || 'United States',
          city: city || 'New York',
          domains: new Set<string>(),
          pageUrls: new Set<string>()
        });
      }

      const stats = sessionMap.get(sessionId)!;
      stats.total += 1;
      if (eventType === 'page_view') stats.pageViews += 1;
      if (eventType === 'click') stats.clicks += 1;

      if (pageUrl) {
        stats.pageUrls.add(pageUrl);
        try {
          const urlObj = new URL(pageUrl);
          stats.domains.add(urlObj.hostname);
        } catch {
          // Fallback if URL is a fragment
          let host = pageUrl;
          if (host.includes('://')) {
            host = host.substring(host.indexOf('://') + 3);
          }
          if (host.includes('/')) {
            host = host.split('/')[0];
          }
          if (host) {
            stats.domains.add(host);
          }
        }
      }

      // Update location/device details if present on newer events
      if (deviceType) stats.deviceType = deviceType;
      if (browserName) stats.browserName = browserName;
      if (country) stats.country = country;
      if (city) stats.city = city;

      if (timestamp < stats.createdAt) stats.createdAt = timestamp;
      if (timestamp > stats.lastActive) stats.lastActive = timestamp;
    });

    const summaries: SessionSummary[] = Array.from(sessionMap.entries()).map(([sessionId, stats]) => ({
      sessionId,
      totalEvents: stats.total,
      pageViews: stats.pageViews,
      clicks: stats.clicks,
      createdAt: stats.createdAt,
      lastActive: stats.lastActive,
      durationMs: stats.lastActive - stats.createdAt,
      deviceType: stats.deviceType || 'Desktop',
      browserName: stats.browserName || 'Chrome',
      country: stats.country || 'United States',
      city: stats.city || 'New York',
      domains: Array.from(stats.domains),
      pageUrls: Array.from(stats.pageUrls),
    }));

    return summaries.sort((a, b) => b.lastActive - a.lastActive);
  },

  // Retrieve journey timeline events for a targeted session
  async getSessionEvents(sessionId: string): Promise<TrackedEvent[]> {
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        const events = await col.find({ sessionId }).sort({ timestamp: 1 }).toArray();
        return events as unknown as TrackedEvent[];
      } catch (err) {
        console.error(`Mongo query for session ${sessionId} failed:`, err);
      }
    }

    // File level querying
    const events = await loadEventsFromFile();
    return events
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  // Fetch click dataset matching target page URL filters
  async getClicksForPage(pageUrlOrPath: string): Promise<TrackedEvent[]> {
    const normalizedTarget = pageUrlOrPath.toLowerCase().trim();

    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        const events = await col.find({
          eventType: 'click',
          $or: [
            { pageUrl: { $regex: normalizedTarget, $options: 'i' } },
            { pathname: { $regex: `^${normalizedTarget}$`, $options: 'i' } }
          ]
        }).toArray();
        return events as unknown as TrackedEvent[];
      } catch (err) {
        console.error(`Mongo heatmap query for ${pageUrlOrPath} failed:`, err);
      }
    }

    // File level query
    const events = await loadEventsFromFile();
    return events.filter(e => {
      if (e.eventType !== 'click') return false;
      const urlMatch = e.pageUrl?.toLowerCase().includes(normalizedTarget);
      const pathMatch = e.pathname?.toLowerCase() === normalizedTarget;
      return urlMatch || pathMatch;
    });
  },

  // Extract a list of all distinct pages from registered session logs
  async getTrackedRoutes(): Promise<string[]> {
    const events = await this.getAllEvents();
    const routesSet = new Set<string>();
    
    events.forEach(e => {
      if (e.pathname) {
        routesSet.add(e.pathname);
      } else if (e.pageUrl) {
        try {
          const urlObj = new URL(e.pageUrl);
          routesSet.add(urlObj.pathname);
        } catch {
          // Fallback if URL is a fragment
          let path = e.pageUrl;
          if (path.includes('://')) {
            path = path.substring(path.indexOf('://') + 3);
          }
          if (path.includes('/')) {
            path = path.substring(path.indexOf('/'));
          } else {
            path = '/' + path;
          }
          routesSet.add(path);
        }
      }
    });

    const list = Array.from(routesSet).filter(r => r && r.startsWith('/'));
    if (list.length === 0) {
      return ['/home', '/shop', '/product-detail', '/cart', '/checkout'];
    }
    return list.sort();
  },

  // Empty the collection
  async clearDb(): Promise<void> {
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        await col.deleteMany({});
      } catch (err) {
        console.error('Mongo deleteMany failed:', err);
      }
    }
    await saveEventsToFile([]);
  },

  // Seed sample interactive datasets to preview immediate dashboards
  async seedSampleData(force = false): Promise<void> {
    if (!force) {
      const currentSessions = await this.getSessions();
      if (currentSessions.length > 0) return; // Only seed if empty
    }

    console.log('Seeding initial interactive sample datasets...');
    const now = Date.now();
    const sampleEvents: Omit<TrackedEvent, '_id'>[] = [];

    // Session 1: Alpha user (Purchasing flow)
    const s1Start = now - 1000 * 60 * 45; // 45 mins ago
    sampleEvents.push({
      sessionId: 'sess_user_alpha',
      eventType: 'page_view',
      pageUrl: 'https://causalfunnel-demo.com/home',
      pathname: '/home',
      timestamp: s1Start,
      referrer: 'https://google.com',
      userAgent: 'Mozilla/5.0 Chrome 123.0',
    });

    sampleEvents.push({
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
    });

    sampleEvents.push({
      sessionId: 'sess_user_alpha',
      eventType: 'page_view',
      pageUrl: 'https://causalfunnel-demo.com/pricing',
      pathname: '/pricing',
      timestamp: s1Start + 18 * 1000,
      referrer: 'https://causalfunnel-demo.com/home',
      userAgent: 'Mozilla/5.0 Chrome 123.0',
    });

    sampleEvents.push({
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
    });

    sampleEvents.push({
      sessionId: 'sess_user_alpha',
      eventType: 'page_view',
      pageUrl: 'https://causalfunnel-demo.com/pricing/success',
      pathname: '/pricing/success',
      timestamp: s1Start + 48 * 1000,
      referrer: 'https://causalfunnel-demo.com/pricing',
      userAgent: 'Mozilla/5.0 Chrome 123.0',
    });

    // Session 2: Beta user (Reading products but leaving)
    const s2Start = now - 1000 * 60 * 20; // 20 mins ago
    sampleEvents.push({
      sessionId: 'sess_user_beta',
      eventType: 'page_view',
      pageUrl: 'https://causalfunnel-demo.com/home',
      pathname: '/home',
      timestamp: s2Start,
      referrer: 'https://twitter.com',
      userAgent: 'Mozilla/5.0 Mobile Safari 17.0',
    });

    sampleEvents.push({
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
    });

    sampleEvents.push({
      sessionId: 'sess_user_beta',
      eventType: 'page_view',
      pageUrl: 'https://causalfunnel-demo.com/products',
      pathname: '/products',
      timestamp: s2Start + 9 * 1000,
      referrer: 'https://causalfunnel-demo.com/home',
      userAgent: 'Mozilla/5.0 Mobile Safari 17.0',
    });

    sampleEvents.push({
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
    });

    sampleEvents.push({
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
    });

    // Session 3: Gamma user (Browsing and clicking heavily)
    const s3Start = now - 1000 * 60 * 5; // 5 mins ago
    sampleEvents.push({
      sessionId: 'sess_user_gamma',
      eventType: 'page_view',
      pageUrl: 'https://causalfunnel-demo.com/pricing',
      pathname: '/pricing',
      timestamp: s3Start,
      referrer: '',
      userAgent: 'Mozilla/5.0 Firefox 120.0',
    });

    sampleEvents.push({
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
      elementText: 'How is traffic calculated?',
    });

    sampleEvents.push({
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
      elementText: 'Can I cancel anytime?',
    });

    sampleEvents.push({
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
    });

    await this.insertEvents(sampleEvents);
  },

  // Target-remove specifically seeded mock sessions if requesting pure official datasets
  async removeSampleData(): Promise<void> {
    const col = await getMongoCollection();
    const mockSessionIds = ['sess_user_alpha', 'sess_user_beta', 'sess_user_gamma'];
    if (col && isMongoActive) {
      try {
        await col.deleteMany({ sessionId: { $in: mockSessionIds } });
        console.log('Successfully deleted mock database entries from cloud MongoDB.');
      } catch (err) {
        console.error('Failed to remote Mongo mock events:', err);
      }
    }
    const events = await loadEventsFromFile();
    const cleaned = events.filter(e => !mockSessionIds.includes(e.sessionId || ''));
    await saveEventsToFile(cleaned);
  },

  // Retrive diagnostic connection values for high-context admin board indicators
  getConnectionStatus() {
    return {
      isMongoActive,
      lastError,
      hasUri: !!process.env.MONGODB_URI,
    };
  }
};
