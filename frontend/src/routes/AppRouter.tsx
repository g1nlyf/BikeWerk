import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import BuybackDialog from "@/components/checkout/BuybackDialog";
import { CartNotification } from "@/components/cart/CartNotification";
import CRMProtectedRoute from "@/components/crm/ProtectedRoute";
import { CRMLayout, CRMLoginPage, CRMCompleteProfilePage, DashboardPage, OrdersListPage, OrderDetailPage, CustomersPage, CustomerDetailPage, LeadsPage, TasksPage } from "@/pages/crm";

export default function AppRouter() {
  return (
    <>
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
          </Route>
        </Route>
        <Route path="/catalog/admin/*" element={<CatalogAdminPage />} />
        <Route path="/admin/fmv" element={<FMVCoveragePage />} />
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
        <Route path="*" element={<TestBikeflipLanding2 />} />
      </Routes>
      <BuybackDialog />
      <CartNotification />
    </>
  );
}
