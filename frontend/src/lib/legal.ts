export const LEGAL_DOCS_VERSION = '2026-02-19';
export const LEGAL_DOCS_EFFECTIVE_DATE = '19.02.2026';

export const LEGAL_ROUTES = {
  documents: '/documents',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  consent: '/legal/consent',
  cookies: '/legal/cookies',
  imprint: '/legal/imprint',
  refunds: '/legal/refunds',
  sanctions: '/legal/sanctions',
} as const;

export const LEGAL_DOWNLOADS = {
  termsPdf: `/legal/BikeWerk_Public_Offer_Terms_${LEGAL_DOCS_VERSION}.pdf`,
  privacyPdf: `/legal/BikeWerk_Privacy_Policy_${LEGAL_DOCS_VERSION}.pdf`,
  consentPdf: `/legal/BikeWerk_PD_Consent_${LEGAL_DOCS_VERSION}.pdf`,
  cookiesPdf: `/legal/BikeWerk_Cookie_Policy_${LEGAL_DOCS_VERSION}.pdf`,
  imprintPdf: `/legal/BikeWerk_Imprint_${LEGAL_DOCS_VERSION}.pdf`,
  refundsPdf: `/legal/BikeWerk_Cancellations_Refunds_${LEGAL_DOCS_VERSION}.pdf`,
  sanctionsPdf: `/legal/BikeWerk_Sanctions_Compliance_${LEGAL_DOCS_VERSION}.pdf`,
} as const;

export type FormLegalConsent = {
  termsAccepted: boolean;
  personalDataAccepted: boolean;
  marketingAccepted: boolean;
};

export const DEFAULT_FORM_LEGAL_CONSENT: FormLegalConsent = {
  termsAccepted: false,
  personalDataAccepted: false,
  marketingAccepted: false,
};

export function hasRequiredFormLegalConsent(value: FormLegalConsent): boolean {
  return Boolean(value.termsAccepted && value.personalDataAccepted);
}

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
  updatedAt: string;
};

const COOKIE_CONSENT_STORAGE_KEY = 'bikewerk_cookie_consent_v1';
const COOKIE_CONSENT_EVENT = 'bikewerk:cookie-consent-updated';
const OPEN_COOKIE_SETTINGS_EVENT = 'bikewerk:cookie-settings-open';

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeCookieConsent(raw: unknown): CookieConsent | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  return {
    necessary: true,
    analytics: Boolean(value.analytics),
    marketing: Boolean(value.marketing),
    version: typeof value.version === 'string' && value.version ? value.version : LEGAL_DOCS_VERSION,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt ? value.updatedAt : '',
  };
}

export function getCookieConsent(): CookieConsent | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeCookieConsent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasCookieConsentDecision(): boolean {
  return Boolean(getCookieConsent());
}

export function setCookieConsent(next: { analytics: boolean; marketing: boolean }): CookieConsent {
  const payload: CookieConsent = {
    necessary: true,
    analytics: Boolean(next.analytics),
    marketing: Boolean(next.marketing),
    version: LEGAL_DOCS_VERSION,
    updatedAt: new Date().toISOString(),
  };

  if (isBrowser()) {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      void 0;
    }
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: payload }));
  }

  return payload;
}

export function acceptAllCookies() {
  return setCookieConsent({ analytics: true, marketing: true });
}

export function acceptOnlyNecessaryCookies() {
  return setCookieConsent({ analytics: false, marketing: false });
}

export function canUseAnalyticsCookies(): boolean {
  return Boolean(getCookieConsent()?.analytics);
}

export function canUseMarketingCookies(): boolean {
  return Boolean(getCookieConsent()?.marketing);
}

export function subscribeCookieConsent(listener: (consent: CookieConsent) => void): () => void {
  if (!isBrowser()) return () => void 0;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsent>).detail;
    const normalized = normalizeCookieConsent(detail);
    if (normalized) listener(normalized);
  };

  window.addEventListener(COOKIE_CONSENT_EVENT, handler as EventListener);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler as EventListener);
}

export function openCookieSettings() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

export function subscribeCookieSettingsOpen(listener: () => void): () => void {
  if (!isBrowser()) return () => void 0;
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, listener as EventListener);
  return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, listener as EventListener);
}

export function buildLegalAuditLine(marketingConsent: boolean): string {
  return [
    `[LEGAL v${LEGAL_DOCS_VERSION}]`,
    'terms=1',
    'pd_consent=1',
    `marketing=${marketingConsent ? 1 : 0}`,
    `at=${new Date().toISOString()}`,
  ].join(' ');
}
