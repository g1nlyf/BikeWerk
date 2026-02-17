import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { metricsApi } from "@/api";
import { getMetricsSessionId } from "@/lib/session";
import { startWebVitalsTracking } from "@/lib/webVitals";
import { startJourneyGuardian } from "@/lib/journeyGuardian";
import CatalogPage from "@/pages/CatalogPage";
import CatalogAdminPage from "@/pages/CatalogAdminPage";
import MiniCatalogPage from "@/pages/MiniCatalogPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CalculatorPage from "@/pages/CalculatorPage";
import LoginPage from "@/pages/LoginPage";
import CartPage from "@/pages/CartPage";
import FavoritesPage from "@/pages/FavoritesPage";
import PasswordResetPage from "@/pages/PasswordResetPage";
import GuestOrderWizardPage from "@/pages/GuestOrderWizardPage";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import BuyoutConditionsPage from "@/pages/BuyoutConditionsPage";
import BookingFinalizePage from "@/pages/BookingFinalizePage";
import TestBikeflipLanding2 from "@/pages/TestBikeflipLanding2";
import AboutPage from "@/pages/AboutPage";
import { AdminMobileDashboard } from "@/pages/AdminDashboard/AdminMobileDashboard";
import SniperPage from "@/pages/SniperPage";
import MarketAnalyticsPage from "@/pages/MarketAnalyticsPage";
import JournalPage from "@/pages/JournalPage";
import JournalArticlePage from "@/pages/JournalArticlePage";
import FMVCoveragePage from "@/pages/FMVCoveragePage";
import AdminMetricsCorePage from "@/pages/AdminMetricsCorePage";
import AdminGrowthAttributionPage from "@/pages/AdminGrowthAttributionPage";
import BuybackDialog from "@/components/checkout/BuybackDialog";
import { CartNotification } from "@/components/cart/CartNotification";
import CRMProtectedRoute from "@/components/crm/ProtectedRoute";
import { CRMLayout, CRMLoginPage, CRMCompleteProfilePage, DashboardPage, OrdersListPage, OrderDetailPage, CustomersPage, CustomerDetailPage, LeadsPage, TasksPage, AiRopPage } from "@/pages/crm";
import HowItWorksPage from "@/pages/HowItWorksPage";
import GuaranteesPage from "@/pages/GuaranteesPage";
import DeliveryPage from "@/pages/DeliveryPage";
import PaymentPage from "@/pages/PaymentPage";
import DocumentsPage from "@/pages/DocumentsPage";
import FAQPage from "@/pages/FAQPage";

function detectPageType(pathname: string): string {
  if (pathname.startsWith('/catalog')) return 'catalog';
  if (pathname.startsWith('/product/')) return 'product';
  if (pathname.startsWith('/cart')) return 'cart';
  if (pathname.startsWith('/guest-order') || pathname.startsWith('/booking-checkout')) return 'checkout';
  if (pathname.startsWith('/order-tracking')) return 'order_tracking';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'generic';
}

function MetricsRouteProbe() {
  const location = useLocation();
  const currentPathRef = React.useRef(location.pathname);
  const lastUiClickTsRef = React.useRef(0);

  const shouldEmitInWindow = React.useCallback((key: string, windowMs = 1500) => {
    try {
      const now = Date.now();
      const storageKey = `metrics_emit_guard_v1:${key}`;
      const prev = Number(sessionStorage.getItem(storageKey) || '0');
      if (Number.isFinite(prev) && prev > 0 && (now - prev) < windowMs) return false;
      sessionStorage.setItem(storageKey, String(now));
      return true;
    } catch {
      return true;
    }
  }, []);

  const buildClickMetadata = React.useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const clickable = target.closest('a,button,[role="button"],input[type="button"],input[type="submit"],[data-testid]') as HTMLElement | null;
    if (!clickable) return null;

    const anchor = clickable.closest('a') as HTMLAnchorElement | null;
    const hrefRaw = anchor?.getAttribute('href') || '';
    let targetPath: string | null = null;
    if (hrefRaw) {
      try {
        const parsed = new URL(hrefRaw, window.location.origin);
        targetPath = parsed.pathname || '/';
      } catch {
        targetPath = null;
      }
    }

    const tag = String(clickable.tagName || '').toLowerCase();
    const role = clickable.getAttribute('role') || '';
    const dataTestId = clickable.getAttribute('data-testid') || '';
    const ariaLabel = clickable.getAttribute('aria-label') || '';
    const text = (clickable.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const id = clickable.id ? `#${clickable.id}` : '';

    const label = dataTestId || ariaLabel || text || id || tag || 'click';
    return {
      target_label: label.slice(0, 90),
      target_tag: tag || null,
      target_role: role || null,
      target_testid: dataTestId || null,
      target_href: hrefRaw || null,
      target_path: targetPath,
    };
  }, []);

  React.useEffect(() => {
    startWebVitalsTracking();
    startJourneyGuardian();
  }, []);

  React.useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  React.useEffect(() => {
    const sessionId = getMetricsSessionId();
    const sessionMarker = `metrics_session_started_v2:${sessionId}`;
    try {
      if (!sessionStorage.getItem(sessionMarker)) {
        sessionStorage.setItem(sessionMarker, '1');
        metricsApi.sendEvents([{ type: 'session_start', source_path: location.pathname }]).catch(() => void 0);
      }
    } catch {
      void 0;
    }
  }, [location.pathname]);

  React.useEffect(() => {
    const pageType = detectPageType(location.pathname);
    const sessionId = getMetricsSessionId();
    if (!shouldEmitInWindow(`${sessionId}:page:${location.pathname}`, 1500)) return;
    const events: Array<{ type: string; source_path?: string; metadata?: Record<string, unknown> }> = [
      { type: 'page_view', source_path: location.pathname, metadata: { page_type: pageType } }
    ];
    if (pageType === 'catalog') events.push({ type: 'catalog_view', source_path: location.pathname });
    if (pageType === 'product') events.push({ type: 'product_view', source_path: location.pathname });
    if (pageType === 'checkout') events.push({ type: 'checkout_start', source_path: location.pathname });
    metricsApi.sendEvents(events).catch(() => void 0);
  }, [location.pathname, shouldEmitInWindow]);

  React.useEffect(() => {
    const onFirstClick = (evt: MouseEvent) => {
      const sessionId = getMetricsSessionId();
      const clickMarker = `metrics_first_click_done_v2:${sessionId}`;
      try {
        if (sessionStorage.getItem(clickMarker)) return;
        sessionStorage.setItem(clickMarker, '1');
        const clickMeta = buildClickMetadata(evt.target);
        metricsApi.sendEvents([{
          type: 'first_click',
          source_path: currentPathRef.current,
          metadata: {
            ...(clickMeta || {}),
            page_type: detectPageType(currentPathRef.current)
          }
        }]).catch(() => void 0);
      } catch {
        void 0;
      }
    };
    window.addEventListener('click', onFirstClick, true);
    return () => window.removeEventListener('click', onFirstClick, true);
  }, [buildClickMetadata]);

  React.useEffect(() => {
    const onUiClick = (evt: MouseEvent) => {
      const clickMeta = buildClickMetadata(evt.target);
      if (!clickMeta) return;

      const now = Date.now();
      if (now - lastUiClickTsRef.current < 250) return;
      lastUiClickTsRef.current = now;

      metricsApi.sendEvents([{
        type: 'ui_click',
        source_path: currentPathRef.current,
        metadata: {
          ...clickMeta,
          page_type: detectPageType(currentPathRef.current)
        }
      }]).catch(() => void 0);
    };

    window.addEventListener('click', onUiClick, true);
    return () => window.removeEventListener('click', onUiClick, true);
  }, [buildClickMetadata]);

  return null;
}

export default function AppRouter() {
  return (
    <>
      <MetricsRouteProbe />
      <Routes>
        <Route path="/crm/login" element={<CRMLoginPage />} />
        <Route element={<CRMProtectedRoute />}>
          <Route path="/crm/complete-profile" element={<CRMCompleteProfilePage />} />
        </Route>
        <Route element={<CRMProtectedRoute allowedRoles={['manager', 'admin']} />}>
          <Route path="/crm" element={<CRMLayout />}>
            <Route index element={<Navigate to="/crm/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="ai-rop" element={<AiRopPage />} />
          </Route>
        </Route>
        <Route path="/catalog/admin/*" element={<CatalogAdminPage />} />
        <Route path="/admin/fmv" element={<FMVCoveragePage />} />
        <Route path="/admin/metrics-core" element={<AdminMetricsCorePage />} />
        <Route path="/admin/growth-attribution" element={<AdminGrowthAttributionPage />} />
        <Route path="/admin/*" element={<AdminMobileDashboard />} />
        <Route path="/catalog/mini" element={<MiniCatalogPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/guest-order" element={<GuestOrderWizardPage />} />
        <Route path="/booking-checkout/:id" element={<BuyoutConditionsPage />} />
        <Route path="/booking-checkout/:id/booking" element={<BookingFinalizePage />} />
        <Route path="/order-tracking" element={<OrderTrackingPage />} />
        <Route path="/order-tracking/:token" element={<OrderTrackingPage />} />
        {/* Deprecated routes redirected */}
        <Route path="/track/:token" element={<OrderTrackingPage />} />
        <Route path="/account/orders" element={<OrderTrackingPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/sniper" element={<SniperPage />} />
        <Route path="/analytics" element={<MarketAnalyticsPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal/:slug" element={<JournalArticlePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/guarantees" element={<GuaranteesPage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="*" element={<TestBikeflipLanding2 />} />
      </Routes>
      <BuybackDialog />
      <CartNotification />
    </>
  );
}
