import React from "react";
import { Routes, Route } from "react-router-dom";
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

export default function AppRouter() {
  return (
    <>
      <Routes>
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
