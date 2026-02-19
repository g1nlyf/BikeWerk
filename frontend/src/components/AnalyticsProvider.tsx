import React, { createContext, useContext, useEffect, useRef } from 'react';
import { tracker, type AnalyticsEvent, type EventType } from '@/lib/analytics';
import { canUseAnalyticsCookies } from '@/lib/legal';

interface AnalyticsContextType {
  trackEvent: (type: EventType, bikeId: number, bikeData?: { price?: number; discipline?: string; brand?: string }, metadata?: any) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const trackEvent = (
    type: EventType, 
    bikeId: number, 
    bikeData?: { price?: number; discipline?: string; brand?: string }, 
    metadata?: any
  ) => {
    if (!canUseAnalyticsCookies()) return;
    tracker.track({
      type,
      bikeId,
      timestamp: Date.now(),
      metadata
    }, bikeData);
  };

  return (
    <AnalyticsContext.Provider value={{ trackEvent }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

// Helper hook for tracking impressions (Intersection Observer)
export const useImpression = (
  ref: React.RefObject<Element>, 
  bikeId: number, 
  bikeData?: { price?: number; discipline?: string; brand?: string }
) => {
  const { trackEvent } = useAnalytics();
  const hasTracked = useRef(false);
  const timerRef = useRef<number | null>(null);
  const scrollStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // 1. Impression (Visible > 0.5s)
          timerRef.current = window.setTimeout(() => {
            if (!hasTracked.current) {
              trackEvent('impression', bikeId, bikeData);
              hasTracked.current = true;
            }
          }, 500);

          // 2. Scroll Stop (Visible > 1.5s) - Stronger signal
          scrollStopTimerRef.current = window.setTimeout(() => {
            trackEvent('scroll_stop', bikeId, bikeData);
          }, 1500);

        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (scrollStopTimerRef.current) {
            clearTimeout(scrollStopTimerRef.current);
            scrollStopTimerRef.current = null;
          }
        }
      },
      { threshold: 0.6 } // 60% visibility required
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    };
  }, [ref, bikeId, trackEvent]);
};
