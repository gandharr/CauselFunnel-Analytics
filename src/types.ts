export interface TrackedEvent {
  _id: string;
  sessionId: string;
  eventType: 'page_view' | 'click' | 'session_end';
  pageUrl: string;
  pathname: string;
  timestamp: number;
  // Mouse coordinates (for clicks)
  x?: number;
  y?: number;
  xPct?: number; // relative coordinate from 0 to 1
  yPct?: number; // relative coordinate from 0 to 1
  screenWidth?: number;
  screenHeight?: number;
  // Context
  elementId?: string;
  elementText?: string;
  elementSelectorPath?: string;
  referrer?: string;
  userAgent?: string;
  // Device & Geography
  deviceType?: string; // Desktop, Mobile, Tablet
  browserName?: string; // Chrome, Safari, Firefox, Edge, etc.
  country?: string;
  city?: string;
}

export interface SessionSummary {
  sessionId: string;
  totalEvents: number;
  pageViews: number;
  clicks: number;
  createdAt: number;
  lastActive: number;
  durationMs: number;
  deviceType?: string;
  browserName?: string;
  country?: string;
  city?: string;
  domains?: string[];
  pageUrls?: string[];
}

export interface PageHeatmapPoint {
  x: number;
  y: number;
  xPct: number;
  yPct: number;
  screenWidth: number;
  screenHeight: number;
  timestamp: number;
  elementText?: string;
}
