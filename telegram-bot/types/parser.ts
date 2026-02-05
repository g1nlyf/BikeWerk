// Interfaces for the Kleinanzeigen Parser

export interface BikeData {
  originalUrl: string;
  brand: string | null;
  model: string | null;
  price: number | null;
  oldPrice?: number | null;
  isNegotiable: boolean | null;
  deliveryOption: "available" | "not_available" | null;
  description: string | null;
  frameSize: string | null;
  year: number | null;
  category: string | null;
  discipline: string | null;
  location: string | null;
  sellerName: string | null;
  sellerMemberSince: string | null; // ISO date if parsable
  sellerBadges: string[] | null;
  sellerType: string | null;
  sourceAdId: string | null;
  wheelDiameter: string | null;
  isBike: boolean | null;
  initial_quality_class?: 'A' | 'B' | 'C' | null;
  processedByGemini: true;
  processingDate: string; // ISO timestamp
  processedMode: "multimodal" | "html_only";
  isActive: boolean | null;
}

export interface PlaywrightPlan {
  steps: Array<{
    action: "click" | "waitForSelector" | "navigate" | "extractHTML" | "screenshot" | "wait" | "type";
    selector?: string;
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
    description: string;
    timeout?: number;
  }>;
  fallbackStrategies: string[];
  expectedArtifacts: string[];
}

// --- New Optimized Structure ---

export interface Stage1Result {
  data: BikeData;
  confidence: Record<string, number>;
  uncertain_fields: string[];
  needs_playwright: boolean;
  reasons?: string[];
}

export interface Stage2Result {
  playwright_plan?: PlaywrightPlan;
  critical_fields?: string[];
  why_needed?: string;
}

export interface MetadataResult {
  url: string;
  html_size: number;
  timestamp: string;
}

export interface OptimizedLLMResult {
  stage1: Stage1Result;
  stage2?: Stage2Result;
  metadata: MetadataResult;
}
