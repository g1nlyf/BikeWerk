import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './routes/AppRouter'
import { BrowserRouter } from 'react-router-dom'
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
import { Toaster } from 'sonner'

// Emergency SW cleanup for non-secure contexts or stuck caches
if (window.location.protocol === 'https:' && navigator.serviceWorker) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      // If we are on the main domain and see an old scope or just want to be safe
      // We can forcefully update
      registration.update();
    });
  });
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
                    <NavigationDrawer />
                    <AppRouter />
                  </BrowserRouter>
                  <LeadCaptureModal />
                  <ChatWidget />
                  <Toaster />
                </LeadSystemProvider>
              </CartProvider>
            </CartUIProvider>
          </CheckoutUIProvider>
        </AnalyticsProvider>
      </DrawerProvider>
    </AuthProvider>
  </StrictMode>,
)
