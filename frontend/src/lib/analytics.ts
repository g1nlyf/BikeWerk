import { apiPost, API_BASE } from '@/api';
import { createMetricsEventId, getMetricsSessionId } from '@/lib/session';
import { getAttributionMetadata } from '@/lib/traffic';

export type EventType = 
  | 'impression'      // Bike visible in viewport
  | 'hover'           // Mouse hover > 500ms
  | 'click'           // Clicked to view details
  | 'gallery_swipe'   // Swiped/Clicked next photo in card
  | 'favorite'        // Added to favorites
  | 'cart_add'        // Added to cart
  | 'share'           // Shared link
  | 'scroll_stop';    // Stopped scrolling on this item

export interface AnalyticsEvent {
  type: EventType;
  bikeId: number;
  metadata?: Record<string, unknown>; // e.g., { index: 2 } for gallery_swipe
  timestamp: number;
  event_id?: string;
  session_id?: string;
  referrer?: string;
  source_path?: string;
}

export interface UserInterestProfile {
  disciplines: Record<string, number>;
  brands: Record<string, number>;
  priceSensitivity: {
    sum: number;
    count: number;
    weightedAverage: number;
  };
  lastActive: number;
}

const STORAGE_KEY = 'eubike_user_dna';
const BATCH_INTERVAL = 30000; // 30 seconds
const BATCH_SIZE_LIMIT = 20;

class UserActivityTracker {
  private queue: AnalyticsEvent[] = [];
  private flushTimer: number | null = null;
  private profile: UserInterestProfile;

  constructor() {
    this.profile = this.loadProfile();
    this.startFlushTimer();
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private loadProfile(): UserInterestProfile {
    if (typeof window === 'undefined') return this.getDefaultProfile();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : this.getDefaultProfile();
    } catch {
      return this.getDefaultProfile();
    }
  }

  private getDefaultProfile(): UserInterestProfile {
    return {
      disciplines: {},
      brands: {},
      priceSensitivity: { sum: 0, count: 0, weightedAverage: 0 },
      lastActive: Date.now()
    };
  }

  private saveProfile() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch { void 0 }
  }

  public track(event: AnalyticsEvent, bikeData?: { price?: number; discipline?: string; brand?: string }) {
    this.queue.push(event);
    this.updateProfile(event, bikeData);
    
    if (this.queue.length >= BATCH_SIZE_LIMIT) {
      this.flush();
    }
  }

  private updateProfile(event: AnalyticsEvent, bikeData?: { price?: number; discipline?: string; brand?: string }) {
    if (!bikeData) return;

    // Weights for profile update (Digital Body Language)
    const weights: Record<EventType, number> = {
      impression: 0.1,    // Glanced at
      scroll_stop: 1.0,   // Stopped to look (>1.5s)
      hover: 1.0,         // Mouse over (>0.5s)
      gallery_swipe: 3.0, // Active interest in photos
      click: 10.0,        // Detail view
      share: 50.0,        // High intent
      favorite: 70.0,     // Very high intent
      cart_add: 100.0     // Max intent
    };

    const weight = weights[event.type] || 0;
    if (weight === 0) return;

    // Update Discipline Affinity
    if (bikeData.discipline) {
      const d = bikeData.discipline;
      this.profile.disciplines[d] = (this.profile.disciplines[d] || 0) + weight;
    }

    // Update Brand Affinity
    if (bikeData.brand) {
      const b = bikeData.brand;
      // Boost brand affinity slightly less than discipline
      this.profile.brands[b] = (this.profile.brands[b] || 0) + (weight * 0.8);
    }

    // Update Price Sensitivity (Only for strong signals)
    // We include scroll_stop and hover as they indicate interest in that price point
    if (bikeData.price && weight >= 1) {
      this.profile.priceSensitivity.sum += bikeData.price * weight;
      this.profile.priceSensitivity.count += weight;
      this.profile.priceSensitivity.weightedAverage = 
        this.profile.priceSensitivity.sum / this.profile.priceSensitivity.count;
    }

    this.profile.lastActive = Date.now();
    this.saveProfile();
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];
    const sessionId = getMetricsSessionId();
    const trafficMeta = getAttributionMetadata();
    const enhanced = batch.map((event, idx) => ({
      ...event,
      event_id: event.event_id ?? createMetricsEventId(sessionId, Date.now() + idx),
      session_id: event.session_id ?? sessionId,
      referrer: event.referrer ?? (typeof document !== 'undefined' ? document.referrer : ''),
      source_path: event.source_path ?? (typeof location !== 'undefined' ? location.pathname : ''),
      metadata: {
        ...trafficMeta,
        ...(event.metadata || {})
      }
    }));

    try {
      const payload = JSON.stringify({ events: enhanced });

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const ok = navigator.sendBeacon(
          `${API_BASE}/metrics/events`,
          new Blob([payload], { type: 'application/json' })
        );
        if (ok) return;
      }

      apiPost('/metrics/events', { events: enhanced }, { keepalive: true, headers: { 'x-session-id': sessionId } }).catch(() => void 0);
    } catch (e) {
      void e;
    }
  }

  private startFlushTimer() {
    if (typeof window === 'undefined') return;
    this.flushTimer = window.setInterval(() => this.flush(), BATCH_INTERVAL);
  }

  public getProfile(): UserInterestProfile {
    return this.profile;
  }

}

export const tracker = new UserActivityTracker();
