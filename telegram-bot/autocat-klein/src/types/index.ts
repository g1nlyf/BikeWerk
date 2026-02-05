export type ProcessedMode = "html-only" | "multimodal";

export interface FinalJson {
  originalUrl: string;
  brand: string | null;
  model: string | null;
  price: number | null;
  isNegotiable: boolean | null;
  deliveryOption: "available" | "not_available" | null;
  description: string | null;
  frameSize: string | null;
  year: number | null;
  category: string | null;
  discipline: string | null;
  location: string | null;
  sellerName: string | null;
  sellerMemberSince: string | null;
  sellerBadges: string[] | null;
  sellerType: string | null;
  sourceAdId: string | null;
  wheelDiameter: string | null;
  isBike: boolean | null;
  processedByGemini: true;
  processingDate: string; // ISO
  processedMode: ProcessedMode;
  isActive: boolean | null;
  images?: string[]; // Remote URLs
  localImages?: string[]; // Local paths
}

export interface FetchResult {
  url: string;
  html: string;
  status: number;
  fetchTimeMs: number;
  minifiedHtml?: string;
}

export interface ParsedCandidates {
  title: string | null;
  priceCandidate: string | null;
  locationCandidate: string | null;
  rawAdId: string | null;
  descriptionCandidate: string | null;
  imageCandidates: string[];
  metaTags: Record<string, string>;
}

export interface LLMFastPassResult {
  data: Partial<FinalJson>;
  confidence: Record<string, number>;
  uncertain_fields: string[];
  needs_playwright: boolean;
  reasons: string[];
}

export interface PlaywrightPlanStep {
  action: "click" | "waitForSelector" | "screenshot" | "extract" | "fill" | "scroll";
  selector?: string;
  selectors?: string[];
  value?: string;
  name?: string;
  timeout?: number;
  notes?: string;
}

export interface PlaywrightPlan {
  steps: PlaywrightPlanStep[];
  fallbackStrategies: string[];
}

export interface PlaywrightExecutionResult {
  html: string;
  screenshots: Record<string, string>; // name -> base64 or path
  xhrResponses: any[];
  extractedImages: string[];
  cookiesAccepted: boolean;
  success: boolean;
  error?: string;
}

export interface ParseLog {
  url: string;
  fetchTime: number;
  llmLatency: number;
  playwrightUsed: boolean;
  finalScore: number;
  savedAs: "draft" | "published" | "discarded";
  timestamp: string;
}
