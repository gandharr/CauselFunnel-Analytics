var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_ws = require("ws");

// src/backend/db.ts
var import_promises = __toESM(require("fs/promises"), 1);
var import_path = __toESM(require("path"), 1);
var import_mongodb = require("mongodb");
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var DB_FILE = import_path.default.join(DATA_DIR, "events.json");
var mongoClient = null;
var mongoCollection = null;
var isMongoActive = false;
var lastError = null;
var connectionAttempted = false;
var lastAttemptedUri = "";
var eventsCache = [];
var isLocalLoaded = false;
var fileWriteQueue = Promise.resolve();
function getCandidateURIs(baseUri) {
  const candidates = [baseUri];
  const match = baseUri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@([^/?]+)(.*)$/);
  if (match) {
    const [, protocol, user, pass, host, rest] = match;
    const userVariations = [user];
    if (user.includes("Causel")) userVariations.push(user.replace("Causel", "Causal"));
    if (user.includes("Causal")) userVariations.push(user.replace("Causal", "Causel"));
    const passVariations = [pass];
    if (pass.includes("Causel")) passVariations.push(pass.replace("Causel", "Causal"));
    if (pass.includes("Causal")) passVariations.push(pass.replace("Causal", "Causel"));
    const hostVariations = [host];
    if (host.includes("causelfunnel")) hostVariations.push(host.replace("causelfunnel", "causalfunnel"));
    if (host.includes("causalfunnel")) hostVariations.push(host.replace("causalfunnel", "causelfunnel"));
    const rawPath = rest || "";
    const cleanPath = rawPath.split("?")[0] || "";
    const query = rawPath.includes("?") ? rawPath.substring(rawPath.indexOf("?")) : "";
    const pathVariations = [rawPath];
    if (cleanPath === "/" || cleanPath === "") {
      pathVariations.push("/causalfunnel_analytics" + query);
      pathVariations.push("/test" + query);
    }
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
async function getMongoCollection() {
  const currentUri = process.env.MONGODB_URI || "";
  if (mongoCollection && isMongoActive && lastAttemptedUri === currentUri) {
    return mongoCollection;
  }
  if (!currentUri) {
    return null;
  }
  if (lastAttemptedUri !== currentUri) {
    connectionAttempted = false;
    isMongoActive = false;
    mongoClient = null;
    mongoCollection = null;
    lastError = null;
    lastAttemptedUri = currentUri;
  }
  if (connectionAttempted && !isMongoActive && lastError && (lastError.includes("auth") || lastError.includes("Auth") || lastError.includes("bad auth"))) {
    return null;
  }
  connectionAttempted = true;
  const candidates = getCandidateURIs(currentUri);
  let workedClient = null;
  let workedCollection = null;
  let workError = null;
  console.log(`Starting self-healing connection tries. Generated ${candidates.length} connection candidates.`);
  for (const candidate of candidates) {
    try {
      console.log(`Attempting candidate: ${candidate.replace(/:[^@]+@/, ":****@")}`);
      const client = new import_mongodb.MongoClient(candidate, {
        connectTimeoutMS: 3e3,
        serverSelectionTimeoutMS: 3e3
      });
      await client.connect();
      const dbInstance = client.db("causalfunnel_analytics");
      workedCollection = dbInstance.collection("events");
      workedClient = client;
      isMongoActive = true;
      lastError = null;
      console.log("Successfully self-healed and established connection with candidate:", candidate.replace(/:[^@]+@/, ":****@"));
      break;
    } catch (err) {
      workError = err?.message || String(err);
      console.warn(`Candidate connection rejected: ${workError}`);
    }
  }
  if (workedClient && workedCollection) {
    mongoClient = workedClient;
    mongoCollection = workedCollection;
    return mongoCollection;
  } else {
    console.error("All self-healing MongoDB connection permutations were rejected. Falling back to local events JSON.");
    mongoClient = null;
    mongoCollection = null;
    isMongoActive = false;
    lastError = workError;
    return null;
  }
}
async function ensureDbFile() {
  try {
    await import_promises.default.mkdir(DATA_DIR, { recursive: true });
    try {
      await import_promises.default.access(DB_FILE);
    } catch {
      await import_promises.default.writeFile(DB_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to initialize local data folder:", err);
  }
}
async function loadEventsFromFile() {
  if (isLocalLoaded) return eventsCache;
  await ensureDbFile();
  try {
    const data = await import_promises.default.readFile(DB_FILE, "utf-8");
    eventsCache = JSON.parse(data || "[]");
    isLocalLoaded = true;
  } catch (error) {
    console.error("Error reading JSON DB file:", error);
    eventsCache = [];
  }
  return eventsCache;
}
async function saveEventsToFile(events) {
  eventsCache = events;
  fileWriteQueue = fileWriteQueue.then(async () => {
    try {
      await ensureDbFile();
      await import_promises.default.writeFile(DB_FILE, JSON.stringify(events, null, 2), "utf-8");
    } catch (error) {
      console.error("Error writing to JSON DB file:", error);
    }
  });
  await fileWriteQueue;
}
var db = {
  // Insert a single event
  async insertEvent(eventData) {
    const col = await getMongoCollection();
    const newId = "evt_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const newEvent = {
      ...eventData,
      _id: newId
    };
    if (col && isMongoActive) {
      try {
        await col.insertOne(newEvent);
        return newEvent;
      } catch (err) {
        console.error("Mongo insert failed, resorting to File layer:", err);
      }
    }
    const events = await loadEventsFromFile();
    events.push(newEvent);
    await saveEventsToFile(events);
    return newEvent;
  },
  // Insert a batch of events (e.g. bulk trackers or seeds)
  async insertEvents(eventsData) {
    const col = await getMongoCollection();
    const newEvents = eventsData.map((data) => ({
      ...data,
      _id: "evt_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    }));
    if (col && isMongoActive) {
      try {
        await col.insertMany(newEvents);
        return newEvents;
      } catch (err) {
        console.error("Mongo insertMany failed, resorting to File layer:", err);
      }
    }
    const events = await loadEventsFromFile();
    events.push(...newEvents);
    await saveEventsToFile(events);
    return newEvents;
  },
  // Fetch all events chronologically
  async getAllEvents() {
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        const events = await col.find({}).toArray();
        return events;
      } catch (err) {
        console.error("Mongo query failed, fallback to File reader:", err);
      }
    }
    return loadEventsFromFile();
  },
  // Aggregate sessions statistics dynamically
  async getSessions() {
    const events = await this.getAllEvents();
    const sessionMap = /* @__PURE__ */ new Map();
    events.forEach((event) => {
      const { sessionId, eventType, timestamp, deviceType, browserName, country, city, pageUrl } = event;
      if (!sessionId) return;
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          pageViews: 0,
          clicks: 0,
          total: 0,
          createdAt: timestamp,
          lastActive: timestamp,
          deviceType: deviceType || "Desktop",
          browserName: browserName || "Chrome",
          country: country || "United States",
          city: city || "New York",
          domains: /* @__PURE__ */ new Set(),
          pageUrls: /* @__PURE__ */ new Set()
        });
      }
      const stats = sessionMap.get(sessionId);
      stats.total += 1;
      if (eventType === "page_view") stats.pageViews += 1;
      if (eventType === "click") stats.clicks += 1;
      if (pageUrl) {
        stats.pageUrls.add(pageUrl);
        try {
          const urlObj = new URL(pageUrl);
          stats.domains.add(urlObj.hostname);
        } catch {
          let host = pageUrl;
          if (host.includes("://")) {
            host = host.substring(host.indexOf("://") + 3);
          }
          if (host.includes("/")) {
            host = host.split("/")[0];
          }
          if (host) {
            stats.domains.add(host);
          }
        }
      }
      if (deviceType) stats.deviceType = deviceType;
      if (browserName) stats.browserName = browserName;
      if (country) stats.country = country;
      if (city) stats.city = city;
      if (timestamp < stats.createdAt) stats.createdAt = timestamp;
      if (timestamp > stats.lastActive) stats.lastActive = timestamp;
    });
    const summaries = Array.from(sessionMap.entries()).map(([sessionId, stats]) => ({
      sessionId,
      totalEvents: stats.total,
      pageViews: stats.pageViews,
      clicks: stats.clicks,
      createdAt: stats.createdAt,
      lastActive: stats.lastActive,
      durationMs: stats.lastActive - stats.createdAt,
      deviceType: stats.deviceType || "Desktop",
      browserName: stats.browserName || "Chrome",
      country: stats.country || "United States",
      city: stats.city || "New York",
      domains: Array.from(stats.domains),
      pageUrls: Array.from(stats.pageUrls)
    }));
    return summaries.sort((a, b) => b.lastActive - a.lastActive);
  },
  // Retrieve journey timeline events for a targeted session
  async getSessionEvents(sessionId) {
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        const events2 = await col.find({ sessionId }).sort({ timestamp: 1 }).toArray();
        return events2;
      } catch (err) {
        console.error(`Mongo query for session ${sessionId} failed:`, err);
      }
    }
    const events = await loadEventsFromFile();
    return events.filter((e) => e.sessionId === sessionId).sort((a, b) => a.timestamp - b.timestamp);
  },
  // Fetch click dataset matching target page URL filters
  async getClicksForPage(pageUrlOrPath) {
    const normalizedTarget = pageUrlOrPath.toLowerCase().trim();
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        const events2 = await col.find({
          eventType: "click",
          $or: [
            { pageUrl: { $regex: normalizedTarget, $options: "i" } },
            { pathname: { $regex: `^${normalizedTarget}$`, $options: "i" } }
          ]
        }).toArray();
        return events2;
      } catch (err) {
        console.error(`Mongo heatmap query for ${pageUrlOrPath} failed:`, err);
      }
    }
    const events = await loadEventsFromFile();
    return events.filter((e) => {
      if (e.eventType !== "click") return false;
      const urlMatch = e.pageUrl?.toLowerCase().includes(normalizedTarget);
      const pathMatch = e.pathname?.toLowerCase() === normalizedTarget;
      return urlMatch || pathMatch;
    });
  },
  // Extract a list of all distinct pages from registered session logs
  async getTrackedRoutes() {
    const events = await this.getAllEvents();
    const routesSet = /* @__PURE__ */ new Set();
    events.forEach((e) => {
      if (e.pathname) {
        routesSet.add(e.pathname);
      } else if (e.pageUrl) {
        try {
          const urlObj = new URL(e.pageUrl);
          routesSet.add(urlObj.pathname);
        } catch {
          let path3 = e.pageUrl;
          if (path3.includes("://")) {
            path3 = path3.substring(path3.indexOf("://") + 3);
          }
          if (path3.includes("/")) {
            path3 = path3.substring(path3.indexOf("/"));
          } else {
            path3 = "/" + path3;
          }
          routesSet.add(path3);
        }
      }
    });
    const list = Array.from(routesSet).filter((r) => r && r.startsWith("/"));
    if (list.length === 0) {
      return ["/home", "/shop", "/product-detail", "/cart", "/checkout"];
    }
    return list.sort();
  },
  // Empty the collection
  async clearDb() {
    const col = await getMongoCollection();
    if (col && isMongoActive) {
      try {
        await col.deleteMany({});
      } catch (err) {
        console.error("Mongo deleteMany failed:", err);
      }
    }
    await saveEventsToFile([]);
  },
  // Seed sample interactive datasets to preview immediate dashboards
  async seedSampleData(force = false) {
    if (!force) {
      const currentSessions = await this.getSessions();
      if (currentSessions.length > 0) return;
    }
    console.log("Seeding initial interactive sample datasets...");
    const now = Date.now();
    const sampleEvents = [];
    const s1Start = now - 1e3 * 60 * 45;
    sampleEvents.push({
      sessionId: "sess_user_alpha",
      eventType: "page_view",
      pageUrl: "https://causalfunnel-demo.com/home",
      pathname: "/home",
      timestamp: s1Start,
      referrer: "https://google.com",
      userAgent: "Mozilla/5.0 Chrome 123.0"
    });
    sampleEvents.push({
      sessionId: "sess_user_alpha",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/home",
      pathname: "/home",
      timestamp: s1Start + 15 * 1e3,
      x: 320,
      y: 180,
      xPct: 0.25,
      yPct: 0.18,
      screenWidth: 1280,
      screenHeight: 800,
      elementId: "hero-btn-cta",
      elementText: "See Pricing"
    });
    sampleEvents.push({
      sessionId: "sess_user_alpha",
      eventType: "page_view",
      pageUrl: "https://causalfunnel-demo.com/pricing",
      pathname: "/pricing",
      timestamp: s1Start + 18 * 1e3,
      referrer: "https://causalfunnel-demo.com/home",
      userAgent: "Mozilla/5.0 Chrome 123.0"
    });
    sampleEvents.push({
      sessionId: "sess_user_alpha",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/pricing",
      pathname: "/pricing",
      timestamp: s1Start + 45 * 1e3,
      x: 640,
      y: 420,
      xPct: 0.5,
      yPct: 0.52,
      screenWidth: 1280,
      screenHeight: 800,
      elementId: "pricing-tier-pro",
      elementText: "Buy Pro Tier ($49/mo)"
    });
    sampleEvents.push({
      sessionId: "sess_user_alpha",
      eventType: "page_view",
      pageUrl: "https://causalfunnel-demo.com/pricing/success",
      pathname: "/pricing/success",
      timestamp: s1Start + 48 * 1e3,
      referrer: "https://causalfunnel-demo.com/pricing",
      userAgent: "Mozilla/5.0 Chrome 123.0"
    });
    const s2Start = now - 1e3 * 60 * 20;
    sampleEvents.push({
      sessionId: "sess_user_beta",
      eventType: "page_view",
      pageUrl: "https://causalfunnel-demo.com/home",
      pathname: "/home",
      timestamp: s2Start,
      referrer: "https://twitter.com",
      userAgent: "Mozilla/5.0 Mobile Safari 17.0"
    });
    sampleEvents.push({
      sessionId: "sess_user_beta",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/home",
      pathname: "/home",
      timestamp: s2Start + 8 * 1e3,
      x: 150,
      y: 200,
      xPct: 0.35,
      yPct: 0.51,
      screenWidth: 430,
      screenHeight: 932,
      elementId: "nav-products",
      elementText: "Browse Products"
    });
    sampleEvents.push({
      sessionId: "sess_user_beta",
      eventType: "page_view",
      pageUrl: "https://causalfunnel-demo.com/products",
      pathname: "/products",
      timestamp: s2Start + 9 * 1e3,
      referrer: "https://causalfunnel-demo.com/home",
      userAgent: "Mozilla/5.0 Mobile Safari 17.0"
    });
    sampleEvents.push({
      sessionId: "sess_user_beta",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/products",
      pathname: "/products",
      timestamp: s2Start + 22 * 1e3,
      x: 215,
      y: 450,
      xPct: 0.5,
      yPct: 0.48,
      screenWidth: 430,
      screenHeight: 932,
      elementId: "product-item-card-1",
      elementText: "View Smart Funnel"
    });
    sampleEvents.push({
      sessionId: "sess_user_beta",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/products",
      pathname: "/products",
      timestamp: s2Start + 45 * 1e3,
      x: 380,
      y: 50,
      xPct: 0.88,
      yPct: 0.05,
      screenWidth: 430,
      screenHeight: 932,
      elementId: "mobile-menu-btn",
      elementText: "Menu"
    });
    const s3Start = now - 1e3 * 60 * 5;
    sampleEvents.push({
      sessionId: "sess_user_gamma",
      eventType: "page_view",
      pageUrl: "https://causalfunnel-demo.com/pricing",
      pathname: "/pricing",
      timestamp: s3Start,
      referrer: "",
      userAgent: "Mozilla/5.0 Firefox 120.0"
    });
    sampleEvents.push({
      sessionId: "sess_user_gamma",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/pricing",
      pathname: "/pricing",
      timestamp: s3Start + 3 * 1e3,
      x: 480,
      y: 350,
      xPct: 0.38,
      yPct: 0.44,
      screenWidth: 1280,
      screenHeight: 800,
      elementId: "faq-toggle-1",
      elementText: "How is traffic calculated?"
    });
    sampleEvents.push({
      sessionId: "sess_user_gamma",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/pricing",
      pathname: "/pricing",
      timestamp: s3Start + 12 * 1e3,
      x: 490,
      y: 430,
      xPct: 0.38,
      yPct: 0.54,
      screenWidth: 1280,
      screenHeight: 800,
      elementId: "faq-toggle-2",
      elementText: "Can I cancel anytime?"
    });
    sampleEvents.push({
      sessionId: "sess_user_gamma",
      eventType: "click",
      pageUrl: "https://causalfunnel-demo.com/pricing",
      pathname: "/pricing",
      timestamp: s3Start + 18 * 1e3,
      x: 820,
      y: 450,
      xPct: 0.64,
      yPct: 0.56,
      screenWidth: 1280,
      screenHeight: 800,
      elementId: "pricing-tier-enterprise",
      elementText: "Contact Enterprise Sales"
    });
    await this.insertEvents(sampleEvents);
  },
  // Target-remove specifically seeded mock sessions if requesting pure official datasets
  async removeSampleData() {
    const col = await getMongoCollection();
    const mockSessionIds = ["sess_user_alpha", "sess_user_beta", "sess_user_gamma"];
    if (col && isMongoActive) {
      try {
        await col.deleteMany({ sessionId: { $in: mockSessionIds } });
        console.log("Successfully deleted mock database entries from cloud MongoDB.");
      } catch (err) {
        console.error("Failed to remote Mongo mock events:", err);
      }
    }
    const events = await loadEventsFromFile();
    const cleaned = events.filter((e) => !mockSessionIds.includes(e.sessionId || ""));
    await saveEventsToFile(cleaned);
  },
  // Retrive diagnostic connection values for high-context admin board indicators
  getConnectionStatus() {
    return {
      isMongoActive,
      lastError,
      hasUri: !!process.env.MONGODB_URI
    };
  }
};

// server.ts
function parseUA(uaString) {
  const ua = uaString || "";
  let deviceType = "Desktop";
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|webos/i.test(ua)) {
    deviceType = "Mobile";
  }
  let browserName = "Other";
  if (/chrome|crios/i.test(ua)) {
    browserName = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browserName = "Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browserName = "Firefox";
  } else if (/opr/i.test(ua)) {
    browserName = "Opera";
  } else if (/edg/i.test(ua)) {
    browserName = "Edge";
  }
  return { deviceType, browserName };
}
async function getGeoLocation(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("172.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    const defaultLocations = [
      { country: "United States", city: "San Francisco" },
      { country: "United States", city: "New York" },
      { country: "United Kingdom", city: "London" },
      { country: "Germany", city: "Berlin" },
      { country: "Canada", city: "Toronto" },
      { country: "India", city: "Mumbai" },
      { country: "Japan", city: "Tokyo" },
      { country: "Singapore", city: "Singapore" }
    ];
    return defaultLocations[Math.floor(Math.random() * defaultLocations.length)];
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "success") {
        return { country: data.country || "United States", city: data.city || "New York" };
      }
    }
  } catch (err) {
    console.warn("Geolocation lookup warning:", err);
  }
  return { country: "United States", city: "New York" };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(import_express.default.json());
  try {
    const isMongoConfigured = !!process.env.MONGODB_URI;
    if (isMongoConfigured) {
      console.log("MongoDB cluster linked. Proactively clearing any pre-existing mock records to ensure pristine official data...");
      await db.removeSampleData();
    } else {
      await db.seedSampleData();
      console.log("Local JSON fallback database loaded and seeded successfully.");
    }
  } catch (error) {
    console.error("Error during database initialization/cleanup:", error);
  }
  app.post("/api/events", async (req, res) => {
    try {
      const payload = req.body;
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      const geo = await getGeoLocation(ip);
      const uaInfo = parseUA(payload.userAgent || req.headers["user-agent"] || "");
      const enrichEvent = (item) => ({
        ...item,
        timestamp: item.timestamp || Date.now(),
        deviceType: item.deviceType || uaInfo.deviceType,
        browserName: item.browserName || uaInfo.browserName,
        country: item.country || geo.country,
        city: item.city || geo.city
      });
      if (Array.isArray(payload)) {
        if (payload.length === 0) {
          res.status(400).json({ error: "Empty event batch" });
          return;
        }
        const enrichedBatch = payload.map(enrichEvent);
        const results = await db.insertEvents(enrichedBatch);
        if (global.broadcastTelemetry) {
          results.forEach((event) => {
            global.broadcastTelemetry({ type: "TELEMETRY_EVENT", data: event });
          });
        }
        res.status(201).json({ success: true, count: results.length, data: results });
        return;
      }
      if (!payload.sessionId || !payload.eventType || !payload.pageUrl) {
        res.status(400).json({ error: "Missing critical parameters: sessionId, eventType, pageUrl" });
        return;
      }
      const enriched = enrichEvent(payload);
      const result = await db.insertEvent(enriched);
      if (global.broadcastTelemetry) {
        global.broadcastTelemetry({ type: "TELEMETRY_EVENT", data: result });
      }
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      console.error("Failed to store event:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await db.getSessions();
      res.json(sessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.get("/api/sessions/:sessionId/events", async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId parameter" });
        return;
      }
      const events = await db.getSessionEvents(sessionId);
      res.json(events);
    } catch (err) {
      console.error(`Failed to fetch events for session ${req.params.sessionId}:`, err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.get("/api/heatmap", async (req, res) => {
    try {
      const pageUrl = req.query.pageUrl;
      if (!pageUrl) {
        res.status(400).json({ error: "Missing pageUrl query parameter" });
        return;
      }
      const coordinates = await db.getClicksForPage(pageUrl);
      res.json(coordinates);
    } catch (err) {
      console.error("Failed to aggregate heatmap coords:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.post("/api/reset", async (req, res) => {
    try {
      await db.clearDb();
      res.json({ success: true, message: "Database reset successfully" });
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.post("/api/seed", async (req, res) => {
    try {
      await db.clearDb();
      await db.seedSampleData(true);
      res.json({ success: true, message: "Database cleared and re-seeded with mock telemetry" });
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.get("/api/db-status", (req, res) => {
    try {
      const status = db.getConnectionStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.get("/api/tracked-routes", async (req, res) => {
    try {
      const routes = await db.getTrackedRoutes();
      res.json(routes);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  app.get("/tracker.js", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    const host = req.headers.host || "localhost:3000";
    const serverOrigin = `${protocol}://${host}`;
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Access-Control-Allow-Origin", "*");
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
      return parts.join(' \u2794 ');
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched successfully at http://localhost:${PORT}`);
  });
  const wss = new import_ws.WebSocketServer({ server });
  const wsClients = /* @__PURE__ */ new Set();
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    console.log(`Real-Time updates: New listener client connected (Pool: ${wsClients.size})`);
    ws.on("close", () => {
      wsClients.delete(ws);
      console.log(`Real-Time updates: Client closed connection (Pool: ${wsClients.size})`);
    });
  });
  global.broadcastTelemetry = (event) => {
    const payload = JSON.stringify(event);
    for (const ws of wsClients) {
      if (ws.readyState === import_ws.WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  };
}
startServer();
//# sourceMappingURL=server.cjs.map
