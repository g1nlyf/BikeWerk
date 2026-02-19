import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './routes/AppRouter'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { DrawerProvider } from '@/context/DrawerContext'
import { CartUIProvider } from '@/lib/cart-ui'
import { CheckoutUIProvider } from '@/lib/checkout-ui'
import { CartProvider } from '@/context/CartContext'
import { LeadSystemProvider } from '@/context/LeadSystemContext'
import { LeadCaptureModal } from '@/components/checkout/LeadCaptureModal'
import { AnalyticsProvider } from '@/components/AnalyticsProvider'
import ChatWidget from '@/components/ChatWidget'
import { NavigationDrawer } from '@/components/layout/NavigationDrawer'
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner'
import { Toaster } from 'sonner'

// ❌ KILLSWITCH REMOVED - was causing infinite page reloads
// The service worker update code below was triggering continuous reloads
// on catalog, home, and other pages. Completely removed.
function AppShell() {
  const location = useLocation()
  const isCrm = location.pathname.startsWith('/crm')
  const isCheckoutFlow =
    location.pathname.startsWith('/booking-checkout') ||
    location.pathname.startsWith('/guest-order') ||
    location.pathname.startsWith('/checkout')

  return (
    <>
      {!isCrm && <NavigationDrawer />}
      <AppRouter />
      {!isCrm && <LeadCaptureModal />}
      {!isCrm && !isCheckoutFlow && <ChatWidget />}
      {!isCrm && <CookieConsentBanner />}
      <Toaster />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DrawerProvider>
        <AnalyticsProvider>
          <CheckoutUIProvider>
            <CartUIProvider>
              <CartProvider>
                <LeadSystemProvider>
                  <BrowserRouter>
                    <AppShell />
                  </BrowserRouter>
                </LeadSystemProvider>
              </CartProvider>
            </CartUIProvider>
          </CheckoutUIProvider>
        </AnalyticsProvider>
      </DrawerProvider>
    </AuthProvider>
  </StrictMode>,
)
