import { Router } from 'express'
// import examplesRouter from './modules/examples'
import crmRouter from './modules/crm'
import bookingRouter from './modules/booking'
import ordersRouter from './modules/orders'
import recommendationsRouter from './modules/recommendations'
// Pages routers
import homeRouter from './pages/home'
import catalogRouter from './pages/catalog'
import productRouter from './pages/product'
import cartRouter from './pages/cart'
import checkoutRouter from './pages/checkout'
import orderTrackingRouter from './pages/order-tracking'
import orderConfirmationRouter from './pages/order-confirmation'
import bikeSelectionRouter from './pages/bike-selection'
import calculatorRouter from './pages/calculator'
import loginRouter from './pages/login'
import favoritesRouter from './pages/favorites'
import aiChatRouter from './pages/ai-chat'
import adminRouter from './pages/admin'
// Test/service routers
import mobileTestRouter from './pages/test/mobile'
import performanceTestRouter from './pages/test/performance'
import testAuthRouter from './pages/test/auth'
import testFavoritesAuthRouter from './pages/test/favorites-auth'
import testProfileDropdownRouter from './pages/test/profile-dropdown'
import testButtonRouter from './pages/test/button'

const v1 = Router()

// Mount resource routers
// v1.use('/examples', examplesRouter)
v1.use('/crm', crmRouter)
v1.use('/booking', bookingRouter)
v1.use('/orders', ordersRouter)
v1.use('/recommendations', recommendationsRouter)

// Mount page routers (placeholders)
v1.use('/pages/home', homeRouter)
v1.use('/pages/catalog', catalogRouter)
v1.use('/pages/product', productRouter)
v1.use('/pages/cart', cartRouter)
v1.use('/pages/checkout', checkoutRouter)
v1.use('/pages/order-tracking', orderTrackingRouter)
v1.use('/pages/order-confirmation', orderConfirmationRouter)
v1.use('/pages/bike-selection', bikeSelectionRouter)
v1.use('/pages/calculator', calculatorRouter)
v1.use('/pages/login', loginRouter)
v1.use('/pages/favorites', favoritesRouter)
v1.use('/pages/ai-chat', aiChatRouter)
v1.use('/pages/admin', adminRouter)

// Mount test/service routers
v1.use('/pages/test/mobile', mobileTestRouter)
v1.use('/pages/test/performance', performanceTestRouter)
v1.use('/pages/test/auth', testAuthRouter)
v1.use('/pages/test/favorites-auth', testFavoritesAuthRouter)
v1.use('/pages/test/profile-dropdown', testProfileDropdownRouter)
v1.use('/pages/test/button', testButtonRouter)

export default v1
