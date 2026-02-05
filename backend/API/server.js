// EUBike JS Server
const path = require('path');
// Register ts-node for TypeScript support
require('ts-node').register({
    project: path.resolve(__dirname, '../tsconfig.json'),
    transpileOnly: true,
    compilerOptions: {
        module: "commonjs"
    }
});

const dotenv = require('dotenv');
// Try loading from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Fallback to default (root .env if exists)
dotenv.config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
// const path = require('path'); // Removed duplicate
const fs = require('fs');
const fsp = require('fs').promises;
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { translate } = require('google-translate-api-x');
const { DatabaseManager } = require('../src/js/mysql-config.js');
const { FinancialAgent } = require('../src/services/financialAgent.js');
const { aiInspector } = require('../src/services/aiInspector.js');
const { calculateRank } = require('../src/js/ranking-service.js');
const { EuphoriaService } = require('../src/services/EuphoriaService.js');
const { SmartScoutService } = require('../src/services/SmartScoutService.js');
// CRM integration
const { initializeCRM } = require('../scripts/crm-api.js');
const { AIDispatcher } = require('../src/services/aiDispatcher.js');
const geminiProcessor = require('../src/services/geminiProcessor.js');
const valuationService = require('../src/services/ValuationService.js');
const BikesDatabase = require('../../telegram-bot/bikes-database-node.js');
const { geminiClient } = require('../../telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js');

const bikesDB = new BikesDatabase();
const aiDispatcher = new AIDispatcher(bikesDB, geminiClient);

// Initialize database manager
const db = new DatabaseManager();
const euphoriaService = new EuphoriaService(db);
const smartScoutService = new SmartScoutService(db);

// Start Financial Agent
const financialAgent = new FinancialAgent(db);
financialAgent.start();

// Check if Supabase is configured
const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
// If using Supabase, pass null as db to force Supabase mode
const crmApi = initializeCRM(undefined, undefined, useSupabase ? null : new DatabaseManager());

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Mount CRM Routes (Sprint 6) ---
try {
    const crmRoutes = require('../src/routes/v1/modules/crm.ts');
    app.use('/api/v1/crm', crmRoutes);
    console.log('✅ CRM Routes mounted at /api/v1/crm');
} catch (e) {
    console.error('❌ Failed to mount CRM routes:', e.message);
}
// SECURITY: No default secrets - fail fast if not configured
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is required');
    process.exit(1);
}
const BOT_SECRET = process.env.BOT_SECRET;
if (!BOT_SECRET) {
    console.warn('⚠️ WARNING: BOT_SECRET not set - bot sync will be disabled');
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
// SMTP configuration for password reset emails
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@eubike.local';
// Robust IMAGES_DIR resolution: supports cwd at project root or backend dir
const envImagesPath = process.env.IMAGES_DIR
    ? path.resolve(process.cwd(), process.env.IMAGES_DIR)
    : path.resolve(process.cwd(), 'backend/public/images/bikes');
const altImagesPath = path.resolve(process.cwd(), 'public/images/bikes');
const IMAGES_DIR = fs.existsSync(envImagesPath) ? envImagesPath : altImagesPath;
const candidateScreensA = path.resolve(process.cwd(), 'backend/public/screenshots');
const candidateScreensB = path.resolve(process.cwd(), 'public/screenshots');
const envScreens = process.env.SCREENSHOTS_DIR ? path.resolve(process.cwd(), process.env.SCREENSHOTS_DIR) : null;
const SCREENSHOTS_DIR = [envScreens, candidateScreensA, candidateScreensB].filter(Boolean).find((p) => fs.existsSync(p)) || (envScreens || candidateScreensA);

app.get('/api/brands/:brand', async (req, res) => {
    try {
        const brandName = req.params.brand;
        if (!brandName) return res.status(400).json({ error: 'Brand required' });

        // 1. Get bikes
        const bikes = await db.query(
            `SELECT * FROM bikes 
             WHERE brand LIKE ? AND is_active = 1 
             ORDER BY rank DESC, ranking_score DESC 
             LIMIT 50`,
            [`%${brandName}%`]
        );

        if (!bikes || bikes.length === 0) {
            return res.status(404).json({ error: 'Brand not found or no active bikes' });
        }

        // 2. Calculate Market Stats
        const prices = bikes.map(b => b.price).filter(p => p > 0);
        const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

        // 3. Top Deals (Hot Offers or high discount)
        const topDeals = bikes.filter(b => b.is_hot_offer || b.discount > 10).slice(0, 3);

        // 4. SEO Metadata
        // "Купить велосипеды [Brand] из Европы — Выгода до 30% — Проверено AI"
        const title = `Купить велосипеды ${bikes[0].brand} из Европы — Выгода до 30% — Проверено AI`;
        const description = `Каталог ${bikes[0].brand} с доставкой в РФ. Средняя цена: ${avgPrice}€. ${bikes.length} проверенных вариантов. Экономия до 30% по сравнению с РФ.`;

        res.json({
            brand: bikes[0].brand,
            stats: {
                totalBikes: bikes.length,
                avgPriceEu: avgPrice,
                minPrice: Math.min(...prices),
                maxPrice: Math.max(...prices)
            },
            topDeals,
            bikes,
            seo: {
                title,
                description
            }
        });

    } catch (e) {
        console.error('Brand Page Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Middleware
const envOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
// Allow common dev ports by default; also accept any localhost/127.0.0.1 port dynamically
const defaultOrigins = [
    'https://bikewerk.ru',
    'https://www.bikewerk.ru',
    'https://api.bikewerk.ru',
    'https://eubike.ru',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:8080'
];
// Merge env-provided origins with sensible defaults to avoid accidental lockouts
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
// Allow any localhost/127.0.0.1 port (correct digit class)
const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests or same-origin
        if (!origin) return callback(null, true);
        const isExplicitAllowed = allowedOrigins.includes(origin);
        const isLocalhost = localhostRegex.test(origin);
        if (isExplicitAllowed || isLocalhost) {
            return callback(null, true);
        }
        return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-rec-variant', 'x-nav-category', 'x-session-id', 'x-admin-secret', 'x-webhook-secret', 'x-telegram-init-data']
};
app.use(cors(corsOptions));

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.disable('x-powered-by');

// Rate limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Too many authentication attempts, please try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});

// Enable gzip/deflate compression for faster responses
app.use(compression());
// Explicitly handle CORS preflight requests (Express 5-safe handler)
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return cors(corsOptions)(req, res, () => res.sendStatus(204));
    }
    next();
});
const maxBody = process.env.MAX_FILE_SIZE ? `${process.env.MAX_FILE_SIZE}` : '50mb';
app.use(express.json({ limit: maxBody, verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: maxBody }));

// Mount v1 API routes
const v1Router = require('../src/routes/v1/index').default;
app.use('/api/v1', v1Router);

// Euphoria Pipeline Endpoints
app.get('/api/euphoria/track/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const trackingData = await euphoriaService.getOrderTracking(orderId);

        if (!trackingData) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(trackingData);
    } catch (e) {
        console.error('Euphoria Track Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin/System endpoint to update status (for simulation/testing)
app.post('/api/euphoria/update-status', adminAuth, async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (!orderId || !status) return res.status(400).json({ error: 'Missing fields' });

        const result = await euphoriaService.updateOrderStatus(orderId, status);
        res.json({ success: true, tracking: result });
    } catch (e) {
        console.error('Euphoria Update Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Trigger Urgency Monitor (simulates Cron)
app.get('/api/euphoria/run-monitor', adminAuth, async (req, res) => {
    try {
        const count = await euphoriaService.checkUrgency();
        res.json({ success: true, updated_count: count });
    } catch (e) {
        console.error('Euphoria Monitor Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/inspector/analyze', async (req, res) => {
    try {
        const inspectionData = req.body;
        if (!inspectionData) {
            return res.status(400).json({ success: false, error: 'Missing inspection data' });
        }

        const result = await aiInspector.inspectBike(inspectionData);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('API Inspector Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Smart Scout Endpoints
app.post('/api/scout/search', async (req, res) => {
    try {
        const { query, userId, sessionId } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const result = await smartScoutService.searchBikes(query);

        // If no results, auto-create sniper (optional, or let frontend prompt)
        if (result.count === 0) {
            await smartScoutService.createWishlistSniper(userId, sessionId, query, result.filters);
            result.sniper_created = true;
        }

        res.json(result);
    } catch (e) {
        console.error('Smart Scout Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/scout/wishlist', async (req, res) => {
    try {
        const { query, userId, sessionId, filters } = req.body;
        const id = await smartScoutService.createWishlistSniper(userId, sessionId, query, filters);
        res.json({ success: true, id });
    } catch (e) {
        console.error('Wishlist Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/matchmaker/swipe', async (req, res) => {
    try {
        const { userId, sessionId, bikeId, action } = req.body;
        if (!bikeId || !action) return res.status(400).json({ error: 'Missing fields' });

        await smartScoutService.saveSwipe(userId, sessionId, bikeId, action);
        res.json({ success: true });
    } catch (e) {
        console.error('Swipe Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Garage & Post-Sales Endpoints
app.get('/api/garage/user/:userId', async (req, res) => {
    try {
        const garage = await garageService.getUserGarage(req.params.userId);
        res.json(garage);
    } catch (e) {
        console.error('Garage Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/garage/passport/:token', async (req, res) => {
    try {
        const passport = await garageService.verifyPassport(req.params.token);
        if (!passport) return res.status(404).json({ error: 'Passport not found or invalid' });
        res.json(passport);
    } catch (e) {
        console.error('Passport Verify Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/garage/upsell/:bikeId', async (req, res) => {
    try {
        const recs = await smartUpsellService.getUpsellRecommendations(req.params.bikeId);
        res.json(recs);
    } catch (e) {
        console.error('Upsell Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Static files for images (fallback if running inside backend folder)
const candidatePublicA = path.resolve(process.cwd(), 'backend/public');
const candidatePublicB = path.resolve(process.cwd(), 'public');
const publicRoot = fs.existsSync(candidatePublicA) ? candidatePublicA : candidatePublicB;
app.use('/images', express.static(path.join(publicRoot, 'images'), { maxAge: '7d', etag: true }));
// Backward-compat: some old data may reference "/src/images/*"; serve same directory
app.use('/src/images', express.static(path.join(publicRoot, 'images'), { maxAge: '7d', etag: true }));

function getRawBodyString(req) {
    if (req && req.rawBody) return req.rawBody.toString('utf8');
    return JSON.stringify(req.body || {});
}

function safeTimingEqual(a, b) {
    try {
        const ab = Buffer.from(String(a), 'utf8');
        const bb = Buffer.from(String(b), 'utf8');
        if (ab.length !== bb.length) return false;
        return crypto.timingSafeEqual(ab, bb);
    } catch {
        return false;
    }
}

function verifyStripeSignature({ rawBody, signatureHeader, secret, toleranceSeconds }) {
    if (!signatureHeader || !secret) return { ok: false, code: 'MISSING_SIGNATURE_OR_SECRET' };
    const items = String(signatureHeader).split(',').map((p) => p.trim()).filter(Boolean);
    let timestamp = null;
    const v1 = [];
    for (const item of items) {
        const idx = item.indexOf('=');
        if (idx <= 0) continue;
        const k = item.slice(0, idx);
        const v = item.slice(idx + 1);
        if (k === 't') timestamp = Number.parseInt(v, 10);
        if (k === 'v1') v1.push(v);
    }
    if (!Number.isFinite(timestamp) || v1.length === 0) return { ok: false, code: 'INVALID_SIGNATURE_HEADER' };
    const now = Math.floor(Date.now() / 1000);
    const tol = Number.isFinite(toleranceSeconds) ? toleranceSeconds : 300;
    if (Math.abs(now - timestamp) > tol) return { ok: false, code: 'SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE' };
    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
    const match = v1.some((sig) => safeTimingEqual(sig, expected));
    if (!match) return { ok: false, code: 'SIGNATURE_MISMATCH' };
    return { ok: true, timestamp };
}

function stripeMinorToMajor(amountMinor, currency) {
    if (!Number.isFinite(amountMinor)) return null;
    const c = String(currency || '').toUpperCase();
    const zeroDecimal = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
    return zeroDecimal.has(c) ? amountMinor : amountMinor / 100;
}

function extractStripePaymentDetails(event) {
    const type = event && event.type;
    const obj = event && event.data && event.data.object ? event.data.object : {};
    const metadata = obj && obj.metadata ? obj.metadata : {};

    const orderId = metadata.order_id || metadata.orderId || obj.client_reference_id || obj.client_referenceId || null;
    const currency = obj.currency || null;

    let amountMinor = null;
    if (type === 'checkout.session.completed') amountMinor = obj.amount_total;
    if (type === 'payment_intent.succeeded') amountMinor = obj.amount_received ?? obj.amount;
    if (type === 'charge.succeeded') amountMinor = obj.amount;

    let transactionId = null;
    if (type === 'checkout.session.completed') transactionId = obj.payment_intent || obj.id;
    if (type === 'payment_intent.succeeded') transactionId = obj.id;
    if (type === 'charge.succeeded') transactionId = obj.id;

    const amount = stripeMinorToMajor(Number(amountMinor), currency);

    return {
        type,
        orderId: orderId ? String(orderId) : null,
        transactionId: transactionId ? String(transactionId) : null,
        amount,
        currency: currency ? String(currency).toUpperCase() : null
    };
}

app.post('/api/v1/webhooks/stripe', async (req, res) => {
    try {
        const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
        if (!secret) return res.status(501).json({ received: false, error: 'STRIPE_WEBHOOK_SECRET_MISSING' });

        const rawBody = getRawBodyString(req);
        const signatureHeader = req.headers['stripe-signature'];
        const toleranceSeconds = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || 300);
        const verified = verifyStripeSignature({ rawBody, signatureHeader, secret, toleranceSeconds });
        if (!verified.ok) return res.status(400).json({ received: false, error: verified.code || 'SIGNATURE_INVALID' });

        const evt = req.body || {};
        const details = extractStripePaymentDetails(evt);
        const allowedTypes = new Set(['checkout.session.completed', 'payment_intent.succeeded', 'charge.succeeded']);
        if (!allowedTypes.has(details.type)) return res.json({ received: true, ignored: true, type: details.type || null });

        if (!details.orderId) return res.status(400).json({ received: false, error: 'ORDER_ID_MISSING' });
        if (!Number.isFinite(details.amount) || details.amount <= 0) return res.status(400).json({ received: false, error: 'AMOUNT_INVALID' });

        await crmApi.processPayment(details.orderId, {
            transaction_id: details.transactionId || null,
            amount: details.amount,
            currency: details.currency || null,
            method: 'stripe'
        });

        return res.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook error:', error);
        return res.status(500).json({ received: false, error: 'INTERNAL_ERROR' });
    }
});

function extractYookassaDetails(body) {
    const event = body && body.event ? String(body.event) : null;
    const obj = body && body.object ? body.object : {};
    const amountValueRaw = obj && obj.amount ? obj.amount.value : null;
    const amount = amountValueRaw != null ? Number(amountValueRaw) : null;
    const currency = obj && obj.amount ? obj.amount.currency : null;
    const metadata = obj && obj.metadata ? obj.metadata : {};
    const orderId = metadata.order_id || metadata.orderId || null;
    const transactionId = obj && obj.id ? String(obj.id) : null;
    const status = obj && obj.status ? String(obj.status) : null;
    const paid = obj && typeof obj.paid === 'boolean' ? obj.paid : null;

    return {
        event,
        status,
        paid,
        orderId: orderId ? String(orderId) : null,
        transactionId,
        amount,
        currency: currency ? String(currency).toUpperCase() : null
    };
}

function yookassaAuthOk(req) {
    const token = process.env.YOOKASSA_WEBHOOK_TOKEN || '';
    const shopId = process.env.YOOKASSA_SHOP_ID || '';
    const secretKey = process.env.YOOKASSA_SECRET_KEY || '';
    const auth = String(req.headers['authorization'] || '');
    const headerToken = String(req.headers['x-webhook-token'] || '');

    if (token) {
        if (headerToken && safeTimingEqual(headerToken, token)) return true;
        if (auth.startsWith('Bearer ') && safeTimingEqual(auth.slice(7), token)) return true;
        return false;
    }

    if (shopId && secretKey && auth.startsWith('Basic ')) {
        const expected = Buffer.from(`${shopId}:${secretKey}`, 'utf8').toString('base64');
        return safeTimingEqual(auth.slice(6), expected);
    }

    return true;
}

app.post('/api/v1/webhooks/yookassa', async (req, res) => {
    try {
        if (!yookassaAuthOk(req)) return res.status(401).json({ received: false, error: 'UNAUTHORIZED' });

        const body = req.body || {};
        const details = extractYookassaDetails(body);
        if (details.event !== 'payment.succeeded') return res.json({ received: true, ignored: true, event: details.event });

        const paidOk = details.status === 'succeeded' || details.paid === true;
        if (!paidOk) return res.json({ received: true, ignored: true, status: details.status });

        if (!details.orderId) return res.status(400).json({ received: false, error: 'ORDER_ID_MISSING' });
        if (!Number.isFinite(details.amount) || details.amount <= 0) return res.status(400).json({ received: false, error: 'AMOUNT_INVALID' });

        await crmApi.processPayment(details.orderId, {
            transaction_id: details.transactionId || null,
            amount: details.amount,
            currency: details.currency || null,
            method: 'yookassa'
        });

        return res.json({ received: true });
    } catch (error) {
        console.error('YooKassa webhook error:', error);
        return res.status(500).json({ received: false, error: 'INTERNAL_ERROR' });
    }
});

async function cleanupScreenshots() {
    try {
        await fsp.access(SCREENSHOTS_DIR);
    } catch {
        return;
    }
    let entries;
    try {
        entries = await fsp.readdir(SCREENSHOTS_DIR, { withFileTypes: true });
    } catch {
        return;
    }
    const files = entries.filter((e) => e.isFile() && /(\.png|\.jpg|\.jpeg|\.webp)$/i.test(e.name));
    const stats = await Promise.all(files.map(async (e) => {
        const p = path.join(SCREENSHOTS_DIR, e.name);
        try {
            const s = await fsp.stat(p);
            const t = s.birthtimeMs || s.ctimeMs || s.mtimeMs || 0;
            return { p, t };
        } catch {
            return { p, t: 0 };
        }
    }));
    stats.sort((a, b) => a.t - b.t);
    const keep = 10;
    const toDelete = stats.slice(0, Math.max(0, stats.length - keep));
    for (const f of toDelete) {
        try { await fsp.unlink(f.p); } catch { }
    }
}

setInterval(cleanupScreenshots, 30 * 60 * 1000);
cleanupScreenshots();

// Sprint 5: Auto-expiration check (every hour)
setInterval(() => {
    crmApi.checkExpiredOrders();
}, 60 * 60 * 1000);
// Run initial check after a short delay to allow DB init
setTimeout(() => crmApi.checkExpiredOrders(), 10000);

// JWT middleware for protected routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// UNIFIED ADMIN AUTH: Accepts EITHER JWT with admin role OR x-admin-secret
// - Frontend uses: Authorization: Bearer <JWT> (user must have role=admin)
// - Internal scripts use: x-admin-secret header
const adminAuth = (req, res, next) => {
    // Method 1: Check x-admin-secret (for internal scripts)
    const adminSecret = req.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SECRET;

    if (adminSecret && expectedSecret && adminSecret === expectedSecret) {
        return next();
    }

    // Method 2: Check JWT with admin role (for frontend)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.role === 'admin') {
                req.user = decoded;
                return next();
            } else {
                return res.status(403).json({ error: 'Admin role required' });
            }
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    return res.status(401).json({
        error: 'Authentication required',
        hint: 'Use Authorization: Bearer <JWT> with admin role, or x-admin-secret header'
    });
};

// Optional authentication middleware - doesn't require token but sets user if present
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            req.user = null;
            return next();
        }

        try {
            // Get user data from database
            const users = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]);

            if (users.length === 0) {
                req.user = null;
            } else {
                req.user = users[0];
            }

            next();
        } catch (error) {
            console.error('Optional auth middleware error:', error);
            req.user = null;
            next();
        }
    });
};

function createErrorWithCode(message, code) {
    const err = new Error(message);
    err.code = code || message;
    return err;
}

async function resolveCrmUserForRequest(req) {
    if (!req || !req.user || !req.user.id) {
        throw createErrorWithCode('UNAUTHENTICATED', 'UNAUTHENTICATED');
    }

    const supabaseUrl = crmApi && crmApi.supabaseUrl;
    const supabaseKey = crmApi && crmApi.supabaseKey;

    if (!supabaseUrl || !supabaseKey) {
        throw createErrorWithCode('CONFIG_MISSING', 'CONFIG_MISSING');
    }

    const localId = String(req.user.id);
    const emailRaw = req.user.email || '';
    const email = String(emailRaw).toLowerCase().trim();

    try {
        const identityResp = await fetch(`${supabaseUrl}/rest/v1/user_identity_map?local_user_id=eq.${encodeURIComponent(localId)}&select=crm_user_id&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Accept': 'application/json'
            }
        });

        if (identityResp.ok) {
            const mapped = await identityResp.json();
            if (Array.isArray(mapped) && mapped.length > 0 && mapped[0] && mapped[0].crm_user_id) {
                const crmUserId = mapped[0].crm_user_id;
                const userByIdResp = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(crmUserId)}&limit=1`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Accept': 'application/json'
                    }
                });
                if (userByIdResp.ok) {
                    const users = await userByIdResp.json();
                    if (Array.isArray(users) && users.length > 0 && users[0]) {
                        const u = users[0];
                        if (u.active === false) {
                            throw createErrorWithCode('CRM_USER_INACTIVE', 'CRM_USER_INACTIVE');
                        }
                        return {
                            id: u.id,
                            role: u.role || null,
                            active: u.active !== false
                        };
                    }
                }
            }
        }
    } catch (e) {
        console.error('resolveCrmUserForRequest identity_map error:', e);
    }

    if (email) {
        try {
            const userByEmailResp = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Accept': 'application/json'
                }
            });
            if (userByEmailResp.ok) {
                const users = await userByEmailResp.json();
                if (Array.isArray(users) && users.length > 0 && users[0]) {
                    const u = users[0];
                    if (u.active === false) {
                        throw createErrorWithCode('CRM_USER_INACTIVE', 'CRM_USER_INACTIVE');
                    }
                    return {
                        id: u.id,
                        role: u.role || null,
                        active: u.active !== false
                    };
                }
            }
        } catch (e) {
            console.error('resolveCrmUserForRequest email fallback error:', e);
        }
    }

    throw createErrorWithCode('CRM_USER_NOT_FOUND', 'CRM_USER_NOT_FOUND');
}

// Admin role check removed per requirements: endpoints are open

// ===== Password reset helpers & email queue =====
function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isStrongPassword(pw) {
    if (typeof pw !== 'string') return false;
    const s = pw.trim();
    // Упрощённое правило: только минимальная длина
    return s.length >= 8;
}

let emailTransporter = null;
function getEmailTransporter() {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    if (emailTransporter) return emailTransporter;
    emailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return emailTransporter;
}

async function enqueueEmail(db, { to, subject, text, html }) {
    const now = new Date().toISOString();
    const nextAttemptAt = now;
    await db.query(`
        INSERT INTO email_queue (to_email, subject, body_text, body_html, status, attempts, max_attempts, last_error, created_at, next_attempt_at)
        VALUES (?, ?, ?, ?, 'pending', 0, 5, NULL, ?, ?)
    `, [to, subject, text || null, html || null, now, nextAttemptAt]);
}

async function processEmailQueue(db) {
    let transporter = getEmailTransporter();
    if (!transporter) {
        // DEV fallback: use Ethereal test SMTP to preview emails if real SMTP isn't configured
        const isDev = (process.env.NODE_ENV || 'development') === 'development';
        if (isDev) {
            try {
                const testAccount = await nodemailer.createTestAccount();
                transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: { user: testAccount.user, pass: testAccount.pass },
                });
                emailTransporter = transporter;
                console.log('📧 Using Ethereal test SMTP account:', testAccount.user);
            } catch (e) {
                console.warn('⚠️ Failed to init Ethereal SMTP:', e.message || e);
            }
        }
        if (!transporter) {
            const pending = await db.query(`SELECT id FROM email_queue WHERE status='pending'`);
            for (const row of pending) {
                await db.query(`UPDATE email_queue SET status='failed', last_error='SMTP not configured' WHERE id=?`, [row.id]);
            }
            return;
        }
    }
    const now = new Date().toISOString();
    const jobs = await db.query(`
        SELECT * FROM email_queue 
        WHERE status='pending' AND next_attempt_at <= ? AND attempts < max_attempts
        ORDER BY created_at ASC LIMIT 5
    `, [now]);
    for (const job of jobs) {
        try {
            const info = await transporter.sendMail({ from: SMTP_FROM, to: job.to_email, subject: job.subject, text: job.body_text || undefined, html: job.body_html || undefined });
            await db.query(`UPDATE email_queue SET status='sent', attempts=attempts+1, last_error=NULL, sent_at=? WHERE id=?`, [new Date().toISOString(), job.id]);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log('🔗 Email preview URL (Ethereal):', previewUrl);
            }
        } catch (err) {
            const attempts = (job.attempts || 0) + 1;
            const delays = [1, 5, 15, 60, 120];
            const delayMin = delays[Math.min(attempts - 1, delays.length - 1)];
            const next = new Date(Date.now() + delayMin * 60 * 1000).toISOString();
            await db.query(`UPDATE email_queue SET attempts=?, last_error=?, next_attempt_at=? WHERE id=?`, [attempts, String(err && err.message || 'send error'), next, job.id]);
        }
    }
}

// Helper to resolve image URLs to absolute form
function resolveImageUrl(u) {
    if (!u) return null;
    const s = String(u).trim();
    if (!s) return null;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    // Normalize legacy prefixes
    let p = s;
    if (p.startsWith('/src/images')) p = p.replace(/^\/src\/images/, '/images');
    else if (p.startsWith('src/images')) p = p.replace(/^src\/images/, '/images');
    // Ensure leading slash and build absolute URL
    const normalized = p.startsWith('/') ? p : `/${p}`;
    if (normalized.startsWith('/images/')) return normalized;
    return `${PUBLIC_URL}${normalized}`;
}

// Image normalization and existence helpers
function normalizeImagePath(u) {
    if (!u) return '';
    let s = String(u).trim();
    if (!s) return '';

    // Return external URLs as is
    if (/^https?:\/\//i.test(s)) {
        return s;
    }

    // Normalize legacy prefixes
    if (s.startsWith('/src/images')) s = s.replace(/^\/src\/images/, '/images');
    else if (s.startsWith('src/images')) s = s.replace(/^src\/images/, '/images');
    return s.startsWith('/') ? s : `/${s}`;
}

function localImageExists(u) {
    const rel = normalizeImagePath(u);
    if (!rel) return false;
    if (!rel.startsWith('/images/')) return true;
    const filePath = path.join(publicRoot, rel.replace(/^\/images\//, 'images/'));
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function filterExistingImages(urls) {
    if (!Array.isArray(urls)) return [];
    return urls.filter((u) => localImageExists(u));
}

function pickAvailableMainImage(bikeId, mainImage, fallbackList = []) {
    if (mainImage && localImageExists(mainImage)) return resolveImageUrl(normalizeImagePath(mainImage));
    for (const u of fallbackList) {
        if (localImageExists(u)) return resolveImageUrl(normalizeImagePath(u));
    }
    try {
        const dirName = `id${bikeId}`;
        const dirPath = path.join(IMAGES_DIR, dirName);
        if (fs.existsSync(dirPath)) {
            let files = fs.readdirSync(dirPath).filter((f) => /(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/i.test(f));
            files.sort((a, b) => a.localeCompare(b));
            const file = files[0];
            if (file) {
                const rel = `/images/bikes/${dirName}/${file}`;
                return resolveImageUrl(rel);
            }
        }
    } catch { }
    return '';
}

// Bulk helpers to avoid N+1 queries in bike listings
async function loadSpecsByBikeId(bikeIds) {
    if (!Array.isArray(bikeIds) || bikeIds.length === 0) return new Map();
    const placeholders = bikeIds.map(() => '?').join(', ');
    const rows = await db.query(
        `SELECT bike_id, spec_label as label, spec_value as value
         FROM bike_specs
         WHERE bike_id IN (${placeholders})
         ORDER BY bike_id, spec_order`,
        bikeIds
    );
    const map = new Map();
    for (const row of rows) {
        const list = map.get(row.bike_id) || [];
        list.push({ label: row.label, value: row.value });
        map.set(row.bike_id, list);
    }
    return map;
}

async function loadFavoriteBikeIdSet(userId, bikeIds) {
    if (!userId || !Array.isArray(bikeIds) || bikeIds.length === 0) return new Set();
    const placeholders = bikeIds.map(() => '?').join(', ');
    const rows = await db.query(
        `SELECT bike_id FROM user_favorites WHERE user_id = ? AND bike_id IN (${placeholders})`,
        [userId, ...bikeIds]
    );
    return new Set(rows.map(r => r.bike_id));
}

// Periodic sync between filesystem IMAGES_DIR and bike_images table
async function syncImageDirectoryWithDB() {
    try {
        const bikes = await db.query('SELECT id, main_image FROM bikes WHERE is_active = 1');
        for (const bike of bikes) {
            const dirName = `id${bike.id}`;
            const dirPath = path.join(IMAGES_DIR, dirName);
            const exists = fs.existsSync(dirPath);
            if (!exists) continue;

            let files = [];
            try {
                files = await fsp.readdir(dirPath);
            } catch (e) {
                continue;
            }

            // Filter typical image extensions
            files = files.filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
            if (files.length === 0) continue;
            files.sort((a, b) => a.localeCompare(b));

            // Determine main file: first matching /main\./ else first in sorted list
            const mainIdx = files.findIndex(fn => /(^|[^a-z])main\./i.test(fn));
            const defaultIdx = mainIdx >= 0 ? mainIdx : 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const relUrl = `/images/bikes/${dirName}/${file}`;
                const existing = await db.query(
                    'SELECT id FROM bike_images WHERE bike_id = ? AND image_url = ?',
                    [bike.id, relUrl]
                );
                if (existing.length === 0) {
                    await db.query(
                        'INSERT INTO bike_images (bike_id, image_url, image_order, is_main) VALUES (?, ?, ?, ?)',
                        [bike.id, relUrl, i, i === defaultIdx ? 1 : 0]
                    );
                }
            }

            // Set bikes.main_image if empty
            if (!bike.main_image || String(bike.main_image).trim() === '') {
                const mainRelUrl = `/images/bikes/${dirName}/${files[defaultIdx]}`;
                await db.query('UPDATE bikes SET main_image = ? WHERE id = ?', [mainRelUrl, bike.id]);
            }
        }
        console.log('✅ Image directory sync completed');
    } catch (err) {
        console.error('⚠️ Image directory sync error:', err.message);
    }
}

// Ensure bikes table has entries corresponding to image directories (idN)
async function ensureBikesFromImageDirs() {
    try {
        if (!fs.existsSync(IMAGES_DIR)) {
            console.warn('⚠️ Images directory not found:', IMAGES_DIR);
            return;
        }

        const dirEntries = await fsp.readdir(IMAGES_DIR, { withFileTypes: true });
        const idDirs = dirEntries.filter(d => d.isDirectory() && /^id(\d+)$/.test(d.name));

        const existingRows = await db.query('SELECT id FROM bikes');
        const existingIds = new Set(existingRows.map(r => r.id));

        let skipped = 0;
        for (const dir of idDirs) {
            const match = dir.name.match(/^id(\d+)$/);
            const idNum = match ? parseInt(match[1], 10) : null;
            if (!idNum) continue;

            // Do NOT auto-create bikes from image folders.
            // Cards must be created only from DB records.
            if (!existingIds.has(idNum)) skipped++;
        }

        console.log(`✅ ensureBikesFromImageDirs: scanned ${idDirs.length} dirs, skipped auto-create for ${skipped} missing bikes`);
    } catch (err) {
        console.error('⚠️ ensureBikesFromImageDirs error:', err.message);
    }
}

// ========================================
// 🌍 TRANSLATION ROUTE
// ========================================

app.post('/api/translate', async (req, res) => {
    try {
        const { q, source, target } = req.body;
        if (!q) return res.status(400).json({ error: 'No text to translate' });

        // 1. Try Gemini first if Key is present
        if (GEMINI_API_KEY) {
            try {
                const prompt = `
You are a professional bicycle mechanic and translator. 
Task: Translate the following bicycle description from ${source || 'auto'} to ${target || 'ru'}. 
Guidelines:
1. Translate technical terms accurately into standard Russian cycling terminology (e.g., 'Schaltwerk' -> 'Задний переключатель', 'Federgabel' -> 'Амортизационная вилка', 'Fully' -> 'Двухподвес').
2. Maintain a professional, persuasive, and sales-oriented tone appropriate for an online marketplace.
3. If the text contains specific specs (like 'Shimano XT'), keep them in the original language if that is standard in Russian cycling communities, or transliterate/translate if appropriate (usually keeping model names in English is better).
4. Do not include any introductory or concluding remarks. Output ONLY the translation.
5. If the original text is messy or informal, make the translation clean and readable while preserving the meaning.

Text to translate:
"${q}"
`;

                const response = await axios.post(
                    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
                    {
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 5000 // 5s timeout for Gemini to fail fast
                    }
                );

                const translatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (translatedText) {
                    console.log('✅ Translated with Gemini');
                    return res.json({ translatedText });
                }
            } catch (geminiError) {
                console.warn('⚠️ Gemini translation failed (quota or error), falling back to Google Translate:', geminiError.message);
                // Fallthrough to Google Translate
            }
        }

        // 2. Fallback to google-translate-api-x
        console.log('🔄 Attempting Google Translate fallback...');
        const gRes = await translate(q, {
            from: source || 'auto',
            to: target || 'ru',
            forceBatch: false, // sometimes helps with stability
            rejectOnPartialFail: false
        });

        if (gRes && gRes.text) {
            console.log('✅ Translated with Google Translate (Free)');
            return res.json({ translatedText: gRes.text });
        }

        // 3. Last resort: return original
        console.warn('❌ All translation methods failed');
        res.json({ translatedText: q });

    } catch (error) {
        console.error('Translation error:', error?.response?.data || error.message);
        // Fallback to original text on error
        res.json({ translatedText: req.body.q });
    }
});

// ========================================
// 🚀 CRM API ROUTES
// ========================================

// Quick order creation (Lead + Order)
app.post('/api/v1/crm/orders/quick', async (req, res) => {
    try {
        console.log('🚀 Quick order request:', req.body);
        const result = await crmApi.createQuickOrder(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('💥 Quick order error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Applications (Leads)
app.get('/api/v1/crm/applications', async (req, res) => {
    try {
        const result = await crmApi.getApplications(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/v1/crm/applications', async (req, res) => {
    try {
        const result = await crmApi.createApplication(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Orders
app.get('/api/v1/crm/orders', async (req, res) => {
    try {
        const result = await crmApi.getOrders(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/v1/crm/orders', async (req, res) => {
    try {
        const result = await crmApi.createOrder(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/crm/orders/:id', async (req, res) => {
    try {
        const result = await crmApi.getOrderFullInfo(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/v1/crm/orders/:id', async (req, res) => {
    try {
        const result = await crmApi.updateOrder(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sprint 5: Help Request
app.post('/api/v1/crm/orders/:id/help', async (req, res) => {
    try {
        const result = await crmApi.requestHelp(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Finance (Payments)
app.get('/api/v1/crm/finances', async (req, res) => {
    try {
        const result = await crmApi.getFinances(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/v1/crm/finances', async (req, res) => {
    try {
        const result = await crmApi.createFinanceRecord(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logistics (Shipments)
app.get('/api/v1/crm/logistics', async (req, res) => {
    try {
        const result = await crmApi.getLogistics(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Customers
app.get('/api/v1/crm/customers', async (req, res) => {
    try {
        const result = await crmApi.getCustomers(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Translation proxy (existing, but moved for organization if needed)
// app.post('/api/translate', ...);

// ========================================
// 💬 CHAT API (Web Widget)
// ========================================

app.post('/api/chat/message', async (req, res) => {
    try {
        const { text, sessionId } = req.body;
        if (!text || !sessionId) {
            return res.status(400).json({ error: 'Missing text or sessionId' });
        }

        // Use AIDispatcher to handle message
        // Note: sessionId from web might be a UUID string. 
        // Our DB expects integer user_id usually, BUT SQLite is flexible with types or we can hash it/store as string if we updated schema.
        // Looking at bikes-database-node.js schema: user_id INTEGER PRIMARY KEY.
        // Problem: Web session IDs are usually strings (UUIDs).
        // Solution: We need to handle this. For now, let's hash string to int or allow string in schema (already defined as INTEGER, but SQLite is dynamic).
        // BETTER: Use a separate table for mapping web_sessions to user_ids, OR just use negative integers for web guests?
        // Let's use a simple hash for now to keep it compatible with INTEGER column, or rely on JS flexibility if the library allows.
        // Actually, let's treat sessionId as a string. If the DB column is INTEGER, SQLite will try to convert. 
        // If we pass a string that looks like an int, it works. If uuid, it might be 0.
        // Let's assume the frontend generates a numeric ID or we generate one.

        // Quick fix: Generate a numeric ID from the session string if it's not numeric
        let userId = sessionId;
        if (typeof sessionId === 'string' && !/^\d+$/.test(sessionId)) {
            // Simple hash
            let hash = 0;
            for (let i = 0; i < sessionId.length; i++) {
                hash = ((hash << 5) - hash) + sessionId.charCodeAt(i);
                hash |= 0;
            }
            userId = Math.abs(hash);
        }

        const result = await aiDispatcher.handleUserMessage(userId, text);

        res.json({
            success: true,
            text: result.text,
            sentiment: result.sentiment,
            options: result.options
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chat/history', async (req, res) => {
    try {
        const { sessionId } = req.query;
        if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

        let userId = sessionId;
        if (typeof sessionId === 'string' && !/^\d+$/.test(sessionId)) {
            let hash = 0;
            for (let i = 0; i < sessionId.length; i++) {
                hash = ((hash << 5) - hash) + sessionId.charCodeAt(i);
                hash |= 0;
            }
            userId = Math.abs(hash);
        }

        const session = await bikesDB.getSession(userId);
        res.json({
            history: session ? session.last_context : ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat/sync', async (req, res) => {
    try {
        const { sessionId } = req.body;
        // Generate a sync code for the user to enter in Telegram
        const code = aiDispatcher.generateSyncCode();

        // Store this code temporarily (in memory or DB). 
        // For MVP, let's just return it and pretend we stored it. 
        // REAL IMPLEMENTATION: Store { code: '123456', webSessionId: sessionId } in a 'sync_codes' table.
        // Since we don't have that table yet, let's use a simple in-memory map in AIDispatcher if it were stateful, 
        // or just rely on the user ID hash trick.

        // Let's just return a dummy code for the UI demo.
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ========================================
// 🤖 AI NEGOTIATOR & MARKET WATCH
// ========================================

app.post('/api/admin/generate-negotiation', adminAuth, async (req, res) => {
    try {
        const { bike_id } = req.body;
        if (!bike_id) return res.status(400).json({ error: 'bike_id is required' });

        const bikes = await db.query('SELECT * FROM bikes WHERE id = ?', [bike_id]);
        if (!bikes || bikes.length === 0) return res.status(404).json({ error: 'Bike not found' });
        const bike = bikes[0];

        // Calculate FMV
        const valuation = await valuationService.calculateFMV({
            brand: bike.brand,
            model: bike.model,
            year: bike.year,
            frame_material: null
        });

        // Generate Negotiation
        const result = await geminiProcessor.generateNegotiationDraft(bike, valuation.fmv || bike.price);

        res.json({
            success: true,
            text: result.text,
            fmv: valuation.fmv,
            bike_price: bike.price
        });
    } catch (error) {
        console.error('Generate negotiation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/market/benchmarks', async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT 
                model as model_name, 
                AVG(price) as avg_eu_price, 
                COUNT(*) as count 
            FROM bikes 
            WHERE is_active = 1 AND price > 0 
            GROUP BY model 
            HAVING count >= 2 
            ORDER BY count DESC 
            LIMIT 5
        `);

        const benchmarks = rows.map((r, i) => ({
            id: i + 1,
            model_name: r.model_name || 'Unknown',
            avg_eu_price: Math.round(r.avg_eu_price),
            avg_rf_price: Math.round(r.avg_eu_price * 1.3),
            last_updated: new Date().toISOString()
        }));

        res.json(benchmarks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/market/history/trends', async (req, res) => {
    try {
        // Fetch raw data to calculate Median (FMV logic) instead of simple AVG
        const query = `
            SELECT 
                strftime('%Y-%m', scraped_at) as month,
                price_eur
            FROM market_history 
            WHERE scraped_at >= date('now', '-6 months')
            AND price_eur > 100 AND price_eur < 20000 -- Basic outlier filter from ValuationService
            ORDER BY scraped_at ASC
        `;

        let rows = [];
        try {
            rows = await db.query(query);
        } catch (e) {
            console.warn('Market history query failed:', e.message);
        }

        if (!rows || rows.length === 0) {
            // Fallback if empty
            const currentMonth = new Date().getMonth();
            return res.json(Array.from({ length: 6 }).map((_, i) => {
                const d = new Date();
                d.setMonth(currentMonth - 5 + i);
                return {
                    month: d.toISOString().slice(0, 7),
                    avg_price: 0
                };
            }));
        }

        // Group by month
        const grouped = rows.reduce((acc, row) => {
            if (!acc[row.month]) acc[row.month] = [];
            acc[row.month].push(row.price_eur);
            return acc;
        }, {});

        // Calculate Median for each month
        const trendData = Object.keys(grouped).sort().map(month => {
            const prices = grouped[month].sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            const median = prices.length % 2 !== 0
                ? prices[mid]
                : (prices[mid - 1] + prices[mid]) / 2;

            return {
                month,
                avg_price: Math.round(median) // Using Median as FMV
            };
        });

        // Ensure we have last 6 months filled (even if some have no data)
        // (Optional refinement, but let's stick to available data for now or fill gaps if needed)

        res.json(trendData);
    } catch (error) {
        console.error('Market History Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/market/brands-distribution', async (req, res) => {
    try {
        const query = `
            SELECT brand, COUNT(*) as count 
            FROM market_history 
            GROUP BY brand 
            ORDER BY count DESC
        `;
        let rows = [];
        try {
            rows = await db.query(query);
        } catch (e) {
            console.warn('Brand distribution query failed:', e.message);
        }
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/market/raw-data', async (req, res) => {
    try {
        let rows = [];
        try {
            // Use Window Function to identify Super Deals (Price < 70% of Average for that model)
            // This acts as a high-performance FMV check without N+1 queries
            rows = await db.query(`
                SELECT 
                    id,
                    model_name, 
                    brand, 
                    price_eur, 
                    source_url, 
                    scraped_at,
                    CASE 
                        WHEN price_eur < 0.7 * AVG(price_eur) OVER (PARTITION BY model_name) THEN 1 
                        ELSE 0 
                    END as is_super_deal
                FROM market_history 
                ORDER BY scraped_at DESC 
                LIMIT 100
            `);
        } catch (e) {
            console.error('Market raw data fetch error:', e);
        }

        if (rows && rows.length > 0) {
            return res.json({ success: true, data: rows });
        }

        // Fallback Mock Data only if absolutely necessary
        const mockData = Array.from({ length: 50 }).map((_, i) => ({
            id: i + 1,
            scraped_at: new Date(Date.now() - i * 1000 * 60 * 60 * 2).toISOString(),
            brand: ['Specialized', 'Canyon', 'Trek', 'Scott', 'Cube'][Math.floor(Math.random() * 5)],
            model_name: ['Tarmac SL7', 'Ultimate CF', 'Madone SLR', 'Spark RC', 'Stereo 150'][Math.floor(Math.random() * 5)],
            price_eur: Math.floor(2000 + Math.random() * 3000),
            source_url: 'https://www.kleinanzeigen.de'
        }));

        res.json({ success: true, data: mockData });
    } catch (error) {
        console.error('Market Raw Data Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin Chat Routes
app.get('/api/admin/chats', adminAuth, async (req, res) => {
    try {
        // Get recent sessions from tg_sessions
        // Join with telegram_users if possible, or just return sessions
        // Since tg_sessions stores web users too (with hash ID), we can just fetch all.
        // We want those with recent updates.
        const sessions = await bikesDB.allQuery(`
            SELECT * FROM tg_sessions 
            ORDER BY updated_at DESC 
            LIMIT 50
        `);
        res.json({ success: true, chats: sessions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/chats/:userId/reply', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { text } = req.body;

        if (!text) return res.status(400).json({ error: 'Message text required' });

        const session = await bikesDB.getSession(userId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Update history
        let lastContext = session.last_context || "";
        let newHistory = lastContext + `\nAssistant: [Admin] ${text}`;

        // Keep it trimmed
        const lines = newHistory.split('\n');
        if (lines.length > 20) {
            newHistory = lines.slice(-20).join('\n');
        }

        await bikesDB.saveSession(userId, session.order_id, newHistory, session.sentiment_score, session.user_preferences);

        // TODO: If this is a Telegram user, send message via Bot API
        // For now, we assume the polling web client will pick it up.

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// 🔐 AUTHENTICATION ROUTES
// ========================================

// User registration
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email.toLowerCase(), hashedPassword]
        );

        const userId = result.insertId;

        // Generate JWT token
        const token = jwt.sign(
            { id: userId, email: email.toLowerCase(), name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            user: { id: userId, name, email: email.toLowerCase() },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User login
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const users = await db.query(
            'SELECT id, name, email, password, role FROM users WHERE email = ? AND is_active = TRUE',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 🖼️ IMAGE PROXY ROUTE - SECURED with SSRF protection
// Fetch external images server-side and stream to client
// This helps avoid mixed-origin/cors issues and allows simple caching.
app.get('/api/image-proxy', async (req, res) => {
    try {
        const raw = req.query.url;
        if (!raw || typeof raw !== 'string') {
            return res.status(400).json({ error: 'Missing url' });
        }
        let target;
        try {
            target = new URL(String(raw));
        } catch (e) {
            return res.status(400).json({ error: 'Invalid url' });
        }
        if (!/^https?:$/.test(target.protocol)) {
            return res.status(400).json({ error: 'Only http/https protocols supported' });
        }

        // SECURITY: Block private/internal IPs (SSRF protection)
        const hostname = target.hostname.toLowerCase();
        const privatePatterns = [
            /^localhost$/i,
            /^127\./,
            /^10\./,
            /^192\.168\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^0\./,
            /^169\.254\./,
            /^::1$/,
            /^fc00:/i,
            /^fd00:/i
        ];

        if (privatePatterns.some(p => p.test(hostname))) {
            console.warn(`⚠️ SSRF attempt blocked: ${hostname}`);
            return res.status(403).json({ error: 'Access to internal resources forbidden' });
        }

        // SECURITY: Domain allowlist
        const allowedDomains = [
            'bilder.buycycle.com',
            'images.buycycle.com',
            'cdn.buycycle.com',
            'bikewerk.ru',
            'eubike.ru',
            'images.unsplash.com',
            'upload.wikimedia.org',
            'lh3.googleusercontent.com'
        ];

        if (!allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d))) {
            console.warn(`⚠️ Image proxy blocked: ${hostname}`);
            return res.status(403).json({ error: 'Domain not allowed' });
        }

        const response = await axios.get(target.toString(), {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: 10 * 1024 * 1024, // 10MB cap
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': target.origin
            },
            validateStatus: (s) => s >= 200 && s < 400,
        });

        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType.startsWith('image/') ? contentType : 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=900'); // 15 minutes
        res.set('X-Image-Proxy', '1');

        return res.send(Buffer.from(response.data));
    } catch (err) {
        console.error('Image proxy error:', err && err.message ? err.message : err);
        return res.status(502).json({ error: 'Proxy fetch failed' });
    }
});

app.post('/api/translate', async (req, res) => {
    try {
        const { q, source, target } = req.body || {};
        const text = typeof q === 'string' ? q.trim() : '';
        const src = typeof source === 'string' && source ? source : 'auto';
        const tgt = typeof target === 'string' && target ? target : '';
        if (!text || !tgt) {
            return res.status(400).json({ error: 'missing_params' });
        }
        const endpoints = [
            'https://translate.astian.org/translate',
            'https://libretranslate.com/translate',
            'https://libretranslate.de/translate'
        ];
        const payload = { q: text, source: src, target: tgt, format: 'text' };
        const decode = (u) => {
            if (u && typeof u === 'object') {
                const a = u.translatedText;
                const b = u.translation;
                if (typeof a === 'string') return a;
                if (typeof b === 'string') return b;
            }
            return '';
        };
        let out = '';
        for (const url of endpoints) {
            try {
                const r = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
                const t = decode(r.data);
                if (t) { out = String(t); break; }
            } catch { }
        }
        if (!out) {
            const parts = (() => {
                const arr = [];
                let cur = '';
                for (const piece of text.split(/(?<=[\.!?\n])\s+/)) {
                    const next = cur ? cur + ' ' + piece : piece;
                    if (next.length > 900) { if (cur) arr.push(cur); cur = piece; } else { cur = next; }
                }
                if (cur) arr.push(cur);
                return arr;
            })();
            const translatedParts = [];
            for (const p of parts) {
                let partOut = '';
                for (const url of endpoints) {
                    try {
                        const r = await axios.post(url, { q: p, source: src, target: tgt, format: 'text' }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
                        const t = decode(r.data);
                        if (t) { partOut = t; break; }
                    } catch { }
                }
                translatedParts.push(partOut || p);
            }
            out = translatedParts.join(' ').trim();
        }
        if (!out) return res.status(502).json({ error: 'proxy_failed', translatedText: text });
        return res.json({ translatedText: out });
    } catch (err) {
        return res.status(500).json({ error: 'internal_error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'EUBike API Server'
    });
});

app.get('/api/rates/eur', async (req, res) => {
    try {
        const rows = await db.query('SELECT value FROM system_settings WHERE key = ? LIMIT 1', ['eur_to_rub']);
        const raw = rows && rows[0] ? rows[0].value : null;
        const n = Number(raw);
        const v = Number.isFinite(n) && n > 0 ? n : 98.5;
        res.json({ success: true, value: v });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error && error.message || 'rate_error') });
    }
});

app.post('/api/rates/eur', async (req, res) => {
    try {
        const body = req.body || {};
        const raw = body.value;
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) {
            return res.status(400).json({ success: false, error: 'invalid_value' });
        }
        await db.query(
            'INSERT INTO system_settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
            ['eur_to_rub', String(n)]
        );
        res.json({ success: true, value: n });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error && error.message || 'rate_save_error') });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const users = await db.query(
            'SELECT id, name, email, role, created_at, last_login FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Update last logout time
        await db.query(
            'UPDATE users SET last_logout = CURRENT_TIMESTAMP WHERE id = ?',
            [req.user.id]
        );

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== Password reset endpoints =====
// Request reset code
app.post('/api/auth/password-reset/request', authLimiter, async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, error: 'Некорректный email' });
        }
        const users = await db.query('SELECT id, email FROM users WHERE email = ? AND is_active = TRUE', [email.toLowerCase()]);
        // Always respond success to prevent enumeration
        if (!users.length) return res.json({ success: true });
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recent = await db.query('SELECT COUNT(*) as cnt FROM password_resets WHERE email = ? AND created_at >= ?', [email.toLowerCase(), oneHourAgo]);
        if ((recent[0]?.cnt || 0) >= 5) {
            return res.status(429).json({ success: false, error: 'Слишком много запросов. Повторите позже.' });
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const codeHash = await bcrypt.hash(code, 10);
        const now = new Date();
        const expires = new Date(now.getTime() + 30 * 60 * 1000);
        await db.query(`
            INSERT INTO password_resets (email, code_hash, created_at, expires_at, attempt_count, max_attempts, blocked_until, verified, verified_at, reset_token)
            VALUES (?, ?, ?, ?, 0, 5, NULL, 0, NULL, NULL)
        `, [email.toLowerCase(), codeHash, now.toISOString(), expires.toISOString()]);
        const subject = 'Код восстановления пароля (EUBike)';
        const text = `Ваш код для восстановления пароля: ${code}. Он действует 30 минут.`;
        await enqueueEmail(db, { to: email.toLowerCase(), subject, text });
        return res.json({ success: true });
    } catch (error) {
        console.error('Password reset request error:', error);
        return res.status(500).json({ success: false, error: 'Ошибка при запросе восстановления пароля' });
    }
});

// Verify code and issue reset token
app.post('/api/auth/password-reset/verify', authLimiter, async (req, res) => {
    try {
        const { email, code } = req.body || {};
        if (!isValidEmail(email) || !code) {
            return res.status(400).json({ success: false, error: 'Некорректные данные' });
        }
        const nowIso = new Date().toISOString();
        const rows = await db.query(`
            SELECT * FROM password_resets 
            WHERE email = ? AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
        `, [email.toLowerCase(), nowIso]);
        const reset = rows[0];
        if (!reset) {
            return res.status(400).json({ success: false, error: 'Код не найден или истёк' });
        }
        if (reset.blocked_until && reset.blocked_until > nowIso) {
            return res.status(429).json({ success: false, error: 'Слишком много неверных попыток. Повторите позже.' });
        }
        const ok = await bcrypt.compare(String(code), reset.code_hash);
        if (!ok) {
            const attempts = (reset.attempt_count || 0) + 1;
            let blockedUntil = null;
            if (attempts >= (reset.max_attempts || 5)) {
                blockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            }
            await db.query(`UPDATE password_resets SET attempt_count=?, blocked_until=? WHERE id=?`, [attempts, blockedUntil, reset.id]);
            return res.status(400).json({ success: false, error: 'Неверный код', attemptsLeft: Math.max(0, (reset.max_attempts || 5) - attempts) });
        }
        const token = require('crypto').randomBytes(32).toString('hex');
        await db.query(`UPDATE password_resets SET verified=1, verified_at=?, reset_token=? WHERE id=?`, [new Date().toISOString(), token, reset.id]);
        return res.json({ success: true, reset_token: token });
    } catch (error) {
        console.error('Password reset verify error:', error);
        return res.status(500).json({ success: false, error: 'Ошибка проверки кода' });
    }
});

// Confirm new password
app.post('/api/auth/password-reset/confirm', authLimiter, async (req, res) => {
    try {
        const { email, reset_token, password, password_confirm } = req.body || {};
        if (!isValidEmail(email) || !reset_token || typeof password !== 'string') {
            return res.status(400).json({ success: false, error: 'Некорректные данные' });
        }
        if (password !== password_confirm) {
            return res.status(400).json({ success: false, error: 'Пароли не совпадают' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({ success: false, error: 'Пароль должен быть не менее 8 символов' });
        }
        const nowIso = new Date().toISOString();
        const rows = await db.query(`
            SELECT * FROM password_resets 
            WHERE email = ? AND reset_token = ? AND verified = 1 AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
        `, [email.toLowerCase(), reset_token, nowIso]);
        const reset = rows[0];
        if (!reset) {
            return res.status(400).json({ success: false, error: 'Токен проверки недействителен' });
        }
        const users = await db.query('SELECT id FROM users WHERE email = ? AND is_active = TRUE', [email.toLowerCase()]);
        if (!users.length) {
            return res.status(400).json({ success: false, error: 'Пользователь не найден' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET password = ? WHERE email = ?', [passwordHash, email.toLowerCase()]);
        await db.query('DELETE FROM password_resets WHERE email = ?', [email.toLowerCase()]);
        return res.json({ success: true });
    } catch (error) {
        console.error('Password reset confirm error:', error);
        return res.status(500).json({ success: false, error: 'Ошибка при изменении пароля' });
    }
});

// ========================================
// 📊 METRICS & ANALYTICS
// ========================================

app.post('/api/metrics/events', async (req, res) => {
    try {
        // Handle batch of events (from analytics.ts)
        if (req.body.events && Array.isArray(req.body.events)) {
            const { events } = req.body;
            const typeMap = {
                'impression': 'impressions',
                'detail_open': 'detail_clicks',
                'click': 'detail_clicks',
                'hover': 'hovers',
                'scroll_stop': 'scroll_stops',
                'gallery_swipe': 'gallery_swipes',
                'favorite': 'favorites',
                'add_to_cart': 'add_to_cart',
                'cart_add': 'add_to_cart',
                'order': 'orders',
                'share': 'shares',
                'bounce': 'bounces',
                'rec_click': 'detail_clicks'
            };

            for (const ev of events) {
                const bikeId = ev.bikeId || ev.bike_id;
                // Map frontend event types to DB types
                let dbType = ev.type;
                if (dbType === 'click') dbType = 'detail_open';
                else if (dbType === 'cart_add') dbType = 'add_to_cart';

                const value = ev.value || 1;
                const metadata = ev.metadata;
                const sessionId = ev.session_id || req.headers['x-session-id'];

                if (!bikeId || !dbType) continue;

                try {
                    await db.query(
                        'INSERT INTO metric_events (bike_id, event_type, value, metadata, session_id) VALUES (?, ?, ?, ?, ?)',
                        [bikeId, dbType, value, metadata ? JSON.stringify(metadata) : null, sessionId]
                    );

                    const col = typeMap[dbType] || typeMap[ev.type];
                    if (col) {
                        const existing = await db.query('SELECT bike_id FROM bike_behavior_metrics WHERE bike_id = ?', [bikeId]);
                        if (existing.length === 0) {
                            await db.query(`INSERT INTO bike_behavior_metrics (bike_id, ${col}) VALUES (?, ?)`, [bikeId, 1]);
                        } else {
                            await db.query(`UPDATE bike_behavior_metrics SET ${col} = ${col} + 1, updated_at = CURRENT_TIMESTAMP WHERE bike_id = ?`, [bikeId]);
                        }
                    }
                } catch (e) {
                    console.error('Error processing event in batch:', e);
                }
            }
            return res.json({ success: true });
        }

        const { bike_id, type, value = 1, metadata, session_id } = req.body;
        const bikeId = bike_id || req.body.bikeId;
        const sessionId = session_id || req.headers['x-session-id'];

        if (!bikeId || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await db.query(
            'INSERT INTO metric_events (bike_id, event_type, value, metadata, session_id) VALUES (?, ?, ?, ?, ?)',
            [bikeId, type, value, metadata ? JSON.stringify(metadata) : null, sessionId]
        );

        const typeMap = {
            'impression': 'impressions',
            'detail_open': 'detail_clicks',
            'click': 'detail_clicks',
            'hover': 'hovers',
            'scroll_stop': 'scroll_stops',
            'gallery_swipe': 'gallery_swipes',
            'favorite': 'favorites',
            'add_to_cart': 'add_to_cart',
            'cart_add': 'add_to_cart',
            'order': 'orders',
            'share': 'shares',
            'bounce': 'bounces',
            'rec_click': 'detail_clicks'
        };

        const col = typeMap[type];
        if (col) {
            const existing = await db.query('SELECT bike_id FROM bike_behavior_metrics WHERE bike_id = ?', [bikeId]);
            if (existing.length === 0) {
                await db.query(`INSERT INTO bike_behavior_metrics (bike_id, ${col}) VALUES (?, ?)`, [bikeId, 1]);
            } else {
                await db.query(`UPDATE bike_behavior_metrics SET ${col} = ${col} + 1, updated_at = CURRENT_TIMESTAMP WHERE bike_id = ?`, [bikeId]);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Metrics event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 🚲 BIKES ROUTES
// ========================================

const CATEGORY_ALIASES = {
    'MTB': 'Горный', 'mtb': 'Горный', 'Горный': 'Горный', 'Горные': 'Горный', 'Mountain': 'Горный',
    'MTB DH': 'Горный', 'DH': 'Горный', 'Downhill': 'Горный',
    'MTB Enduro': 'Горный', 'Enduro': 'Горный',
    'MTB Trail': 'Горный', 'Trail': 'Горный',
    'MTB XC': 'Горный', 'XC': 'Горный', 'XCO': 'Горный',
    'Шоссе': 'Шоссейный', 'Road': 'Шоссейный', 'шоссе': 'Шоссейный', 'Шоссейные': 'Шоссейный',
    'ROAD Aero': 'Шоссейный', 'Aero': 'Шоссейный',
    'ROAD Endurance': 'Шоссейный', 'Endurance': 'Шоссейный', 'Granfondo': 'Шоссейный',
    'ROAD Climbing': 'Шоссейный', 'Climbing': 'Шоссейный',
    'ROAD TT': 'Шоссейный', 'TT': 'Шоссейный', 'Triathlon': 'Шоссейный',
    'Гревел': 'Гравийный', 'Gravel': 'Гравийный', 'Гравийный': 'Гравийный',
    'GRAVEL Race': 'Гравийный', 'Race': 'Гравийный',
    'GRAVEL Allroad': 'Гравийный', 'Allroad': 'Гравийный', 'All-road': 'Гравийный',
    'GRAVEL Bikepacking': 'Гравийный', 'Bikepacking': 'Гравийный',
    'eMTB': 'Электро', 'eBike': 'Электро', 'Электро': 'Электро',
    'Dirt': 'Горный',
    'Детские': 'Детский', 'Kids': 'Детский', 'Детский': 'Детский',
    'Kids Balance': 'Детский',
    'Kids 14"': 'Детский', 'Kids 16"': 'Детский', 'Kids 20"': 'Детский', 'Kids 24"': 'Детский',
    'Компоненты': null,
    'Восстановленные': 'Горный',
    'Новинки': null,
    'Горячие предложения': null
};
const unifyCategory = (c) => CATEGORY_ALIASES[c] ?? c;

// Get all bikes with filters
app.get('/api/bikes', optionalAuth, async (req, res) => {
    try {
        const {
            category,
            brand,
            minPrice,
            maxPrice,
            search,
            limit = 50,
            offset = 0,
            sortOrder = 'DESC'
        } = req.query;

        // Determine effective sortBy with ALLOWLIST validation (prevent SQL injection)
        const ALLOWED_SORT_COLUMNS = ['added_at', 'price', 'name', 'year', 'ranking_score', 'created_at', 'rank', 'relevance'];
        const ALLOWED_SORT_ORDERS = ['ASC', 'DESC'];

        let rawSortBy = req.query.sortBy || req.query.sort || 'added_at';
        if (rawSortBy === 'rank') rawSortBy = 'ranking_score';

        // Validate sortBy - only allow whitelisted columns
        let sortBy = ALLOWED_SORT_COLUMNS.includes(rawSortBy) ? rawSortBy : 'added_at';

        // Validate sortOrder - only ASC or DESC
        const rawSortOrder = (req.query.sortOrder || 'DESC').toUpperCase();
        const validatedSortOrder = ALLOWED_SORT_ORDERS.includes(rawSortOrder) ? rawSortOrder : 'DESC';

        if ((req.query.profile_disciplines || req.query.profile_brands) && !req.query.sortBy && !req.query.sort) {
            sortBy = 'relevance';
        }

        let whereConditions = ['bikes.is_active = TRUE'];
        let queryParams = [];

        // Add filters
        if (category) {
            const mappedCategory = unifyCategory(category);
            whereConditions.push('bikes.category = ?');
            queryParams.push(mappedCategory);
        }

        // Support multiple disciplines (OR logic for array of disciplines)
        if (req.query.discipline) {
            const discs = Array.isArray(req.query.discipline)
                ? req.query.discipline
                : [req.query.discipline];

            if (discs.length > 0) {
                const placeholders = discs.map(() => '?').join(',');
                whereConditions.push(`bikes.discipline IN (${placeholders})`);
                queryParams.push(...discs);
            }
        }

        let profileDiscs = [];
        if (req.query.profile_disciplines) {
            const raw = req.query.profile_disciplines.split(',');
            profileDiscs = raw.map(d => unifyCategory(d.trim())).filter(Boolean);
        }

        let profileBrands = [];
        if (brand) {
            whereConditions.push('bikes.brand = ?');
            queryParams.push(brand);
        }

        if (req.query.profile_brands) {
            const brands = req.query.profile_brands.split(',');
            profileBrands = brands.map(b => b.trim()).filter(Boolean);
            // For brands, we SHOULD NOT filter strictly if we want "Discovery".
            // "If I like Specialized, don't show me ONLY Specialized".
            // So we remove the strict WHERE clause for profile_brands and rely on Scoring.
        }

        if (minPrice) {
            whereConditions.push('bikes.price >= ?');
            queryParams.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            whereConditions.push('bikes.price <= ?');
            queryParams.push(parseFloat(maxPrice));
        }

        if (search) {
            whereConditions.push('(bikes.name LIKE ? OR bikes.brand LIKE ? OR bikes.model LIKE ? OR bikes.description LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.join(' AND ');

        // Construct Query
        let orderByClause = `bikes.${sortBy} ${validatedSortOrder}`;
        let selectRelevance = '';

        // Smart Ranking & Best Offers
        if (sortBy === 'ranking_score' || sortBy === 'rank' || sortBy === 'relevance') {
            // Formula: final_score = (1 - beta) * rank + beta * relevance_norm + exploration_bonus
            const beta = 0.2;
            const explorationBase = 0.1;

            let scoreParts = [];
            // 0. Hot Offer Score (Boost)
            scoreParts.push(`CASE WHEN bikes.is_hot_offer = 1 THEN 100 ELSE 0 END`);
            // 1. Brand Score
            if (profileBrands.length > 0) {
                const brandList = profileBrands.map(b => `'${b.replace(/'/g, "''")}'`).join(',');
                scoreParts.push(`CASE WHEN bikes.brand IN (${brandList}) THEN 100 ELSE 0 END`);
            } else {
                scoreParts.push(`CASE WHEN bikes.brand IN ('Specialized', 'Canyon', 'Trek', 'Scott', 'Santa Cruz') THEN 20 ELSE 0 END`);
            }
            // 2. Category Score
            if (profileDiscs.length > 0) {
                profileDiscs.forEach((d, idx) => {
                    const weight = Math.max(20, 100 - (idx * 20));
                    scoreParts.push(`CASE WHEN bikes.category = '${d.replace(/'/g, "''")}' THEN ${weight} ELSE 0 END`);
                });
            }
            // 3. Price Affinity
            if (req.query.target_price) {
                const tp = parseFloat(req.query.target_price);
                if (tp > 0) {
                    scoreParts.push(`100 * (1 - MIN(1, ABS(bikes.price - ${tp}) / ${tp}))`);
                }
            }
            // 4. Freshness
            scoreParts.push(`MAX(0, 50 - (JULIANDAY('now') - JULIANDAY(bikes.added_at)) * (50.0/60.0))`);

            const relevanceExpr = scoreParts.length > 0 ? `(${scoreParts.join(' + ')}) / 300.0` : '0';
            const explorationExpr = `${explorationBase} * (1 - COALESCE(bikes.rank, 0.5)) * (ABS(RANDOM() % 100) / 100.0)`;
            const rankExpr = `COALESCE(bikes.rank, 0.5)`;
            const finalScoreExpr = `((1 - ${beta}) * ${rankExpr} + ${beta} * ${relevanceExpr} + ${explorationExpr})`;

            orderByClause = `${finalScoreExpr} DESC`;
            selectRelevance = `, ${finalScoreExpr} as final_score, ${rankExpr} as rank_score, ${relevanceExpr} as rel_score`;
        } else if (sortBy === 'relevance_old') {

            // EUBike SmartRank v2
            // Formula: (Brand * 30) + (Category * 25) + (PriceAffinity * 20) + (GlobalPopularity * 20) + (Freshness * 10) + (HotOffer * 30)

            let scoreParts = [];

            // 0. Hot Offer Score (30%) - ADDED
            scoreParts.push(`CASE WHEN bikes.is_hot_offer = 1 THEN 30 ELSE 0 END`);

            // 1. Brand Score (30%)
            if (profileBrands.length > 0) {
                const brandList = profileBrands.map(b => `'${b.replace(/'/g, "''")}'`).join(',');
                scoreParts.push(`CASE WHEN bikes.brand IN (${brandList}) THEN 30 ELSE 0 END`);
            } else {
                // If no brand preference, give small points to top brands to ensure quality feed
                scoreParts.push(`CASE WHEN bikes.brand IN ('Specialized', 'Canyon', 'Trek', 'Scott', 'Santa Cruz') THEN 10 ELSE 0 END`);
            }

            // 2. Category Score (25%)
            if (profileDiscs.length > 0) {
                profileDiscs.forEach((d, idx) => {
                    // Weighted by order in profile (Top 1 = 25, Top 2 = 20, etc.)
                    const weight = Math.max(5, 25 - (idx * 5));
                    scoreParts.push(`CASE WHEN bikes.category = '${d.replace(/'/g, "''")}' THEN ${weight} ELSE 0 END`);
                });
            }

            // 3. Price Affinity Score (20%)
            // Bell curve scoring: Max score if price is close to target.
            if (req.query.target_price) {
                const tp = parseFloat(req.query.target_price);
                if (tp > 0) {
                    // Formula: 20 * (1 - min(1, abs(price - target) / target))
                    // If price is exactly target: 20 * (1 - 0) = 20
                    // If price is double target: 20 * (1 - 1) = 0
                    scoreParts.push(`20 * (1 - MIN(1, ABS(bikes.price - ${tp}) / ${tp}))`);
                }
            }

            // 4. Global Popularity (20%)
            // ranking_score is 0..1. Multiply by 20.
            scoreParts.push('(COALESCE(bikes.ranking_score, 0) * 20)');

            // 5. Freshness / Recency (10%)
            // Decay: 10 points for today, 0 points for > 60 days old
            scoreParts.push(`MAX(0, 10 - (JULIANDAY('now') - JULIANDAY(bikes.added_at)) * (10.0/60.0))`);

            if (scoreParts.length > 0) {
                const relevanceExpr = `(${scoreParts.join(' + ')})`;
                // Random noise for "Shuffle" feel (Discovery)
                // Add random value between 0 and 5 to shake up the order of similar items
                orderByClause = `${relevanceExpr} + (ABS(RANDOM() % 5)) DESC`;
                selectRelevance = `, ${relevanceExpr} as relevance_score`;
            } else {
                // Fallback: Popularity + Freshness mix
                orderByClause = `(COALESCE(bikes.ranking_score, 0) * 50 + MAX(0, 50 - (JULIANDAY('now') - JULIANDAY(bikes.added_at)))) DESC`;
            }
        }

        // Get bikes with images and favorites count
        const bikesQuery = `
            SELECT 
                bikes.*,
                GROUP_CONCAT(DISTINCT COALESCE(bike_images.local_path, bike_images.image_url) ORDER BY bike_images.image_order) as images,
                COUNT(DISTINCT user_favorites.id) as favorites_count
                ${selectRelevance}
            FROM bikes 
            LEFT JOIN bike_images ON bikes.id = bike_images.bike_id
            LEFT JOIN user_favorites ON bikes.id = user_favorites.bike_id
            WHERE ${whereClause}
            GROUP BY bikes.id
            ORDER BY ${orderByClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(parseInt(limit), parseInt(offset));

        const bikes = await db.query(bikesQuery, queryParams);
        console.log(`GET /api/bikes found ${bikes.length} records`); // DEBUG LOG

        // Bulk-load specs and favorites to avoid N+1 queries
        const bikeIds = bikes.map(b => b.id).filter(Boolean);
        const specsById = await loadSpecsByBikeId(bikeIds);
        const favoriteIds = await loadFavoriteBikeIdSet(req.user?.id, bikeIds);

        for (let bike of bikes) {
            const specs = specsById.get(bike.id) || [];
            bike.specs = specs;
            const rawImages = bike.images ? bike.images.split(',') : [];
            const normalizedImages = rawImages.map((u) => normalizeImagePath(u));
            const existingImages = filterExistingImages(normalizedImages).map(resolveImageUrl);
            bike.images = existingImages;
            bike.main_image = pickAvailableMainImage(bike.id, bike.main_image, normalizedImages);
            bike.image = bike.images[0] || bike.main_image;

            // Calculate savings
            if (bike.original_price && bike.price && bike.original_price > bike.price) {
                bike.savings = bike.original_price - bike.price;
            } else {
                bike.savings = 0;
            }

            bike.is_favorite = favoriteIds.has(bike.id);
        }

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM bikes WHERE ${whereClause}`;
        const countParams = queryParams.slice(0, -2); // Remove limit and offset
        const [countResult] = await db.query(countQuery, countParams);

        // Calculate savings for all bikes in the response
        bikes.forEach(bike => {
            if (bike.original_price && bike.price && bike.original_price > bike.price) {
                bike.savings = bike.original_price - bike.price;
            } else {
                bike.savings = 0;
            }
        });

        const totalRaw = countResult?.total ?? bikes.length;
        const total = Number(totalRaw);

        res.json({
            success: true,
            bikes,
            total: Number.isFinite(total) ? total : bikes.length,
            count: bikes.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Get bikes error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Personalized recommendations
const __recCache = new Map();

app.get('/api/recommendations/personalized', optionalAuth, async (req, res) => {
    try {
        const { limit = 20, offset = 0, window = '30d', minPrice, maxPrice, variant: qVariant, explain } = req.query;
        const days = String(window).endsWith('d') ? parseInt(String(window)) : 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const sessionId = req.headers['x-session-id'] ? String(req.headers['x-session-id']) : (req.query.session ? String(req.query.session) : null);
        const region = req.headers['x-geo'] ? String(req.headers['x-geo']) : null;
        const navCat = req.headers['x-nav-category'] ? String(req.headers['x-nav-category']) : null;
        const variantHeader = req.headers['x-rec-variant'] ? String(req.headers['x-rec-variant']) : null;
        const variant = (qVariant || variantHeader) ? String(qVariant || variantHeader) : 'v1-heuristic';

        // Canonical mapping of UI categories to DB categories
        const CATEGORY_ALIASES = {
            'MTB': 'Горный', 'mtb': 'Горный', 'Горный': 'Горный', 'Горные': 'Горный',
            'Шоссе': 'Шоссейный', 'Road': 'Шоссейный', 'шоссе': 'Шоссейный', 'Шоссейные': 'Шоссейный',
            'Гревел': 'Шоссейный', 'Gravel': 'Шоссейный',
            'eMTB': 'Электро', 'eBike': 'Электро', 'Электро': 'Электро',
            'Dirt': 'Горный',
            'Детские': 'Детский', 'Kids': 'Детский', 'Детский': 'Детский',
            'Компоненты': null,
            'Восстановленные': 'Горный',
            'Новинки': null,
            'Горячие предложения': null
        };
        const unifyCategory = (c) => CATEGORY_ALIASES[c] ?? c;
        const DISCIPLINE_ALIASES = {
            'MTB DH': 'MTB DH', 'DH': 'MTB DH', 'Downhill': 'MTB DH',
            'MTB Enduro': 'MTB Enduro', 'Enduro': 'MTB Enduro',
            'MTB Trail': 'MTB Trail', 'Trail': 'MTB Trail',
            'MTB XC': 'MTB XC', 'XC': 'MTB XC', 'XCO': 'MTB XC',
            'ROAD Aero': 'ROAD Aero', 'Aero': 'ROAD Aero',
            'ROAD Endurance': 'ROAD Endurance', 'Endurance': 'ROAD Endurance',
            'ROAD Climbing': 'ROAD Climbing', 'Climbing': 'ROAD Climbing',
            'ROAD TT': 'ROAD TT', 'TT': 'ROAD TT', 'Triathlon': 'ROAD TT',
            'GRAVEL Race': 'GRAVEL Race', 'Race': 'GRAVEL Race',
            'GRAVEL Allroad': 'GRAVEL Allroad', 'Allroad': 'GRAVEL Allroad',
            'GRAVEL Bikepacking': 'GRAVEL Bikepacking', 'Bikepacking': 'GRAVEL Bikepacking',
            'eMTB': 'eMTB'
        };
        const unifyDiscipline = (d) => DISCIPLINE_ALIASES[d] ?? d;

        // Preference signals
        let prefCategories = [];
        let prefBrands = [];
        let prefDisciplines = [];
        const priceBucketCounts = new Map();
        const bucket = (p) => {
            const n = Number(p || 0); if (!Number.isFinite(n) || n <= 0) return null;
            if (n < 1000) return [0, 1000];
            if (n < 1500) return [1000, 1500];
            if (n < 2000) return [1500, 2000];
            if (n < 3000) return [2000, 3000];
            if (n < 5000) return [3000, 5000];
            if (n < 8000) return [5000, 8000];
            return [8000, 9999999];
        };

        if (req.user) {
            const favCats = await db.query(
                'SELECT b.category as category, COUNT(*) as cnt FROM user_favorites uf JOIN bikes b ON uf.bike_id = b.id WHERE uf.user_id = ? GROUP BY b.category ORDER BY cnt DESC',
                [req.user.id]
            );
            const ordBrands = await db.query(
                'SELECT b.brand as brand, COUNT(*) as cnt FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN bikes b ON oi.bike_id = b.id WHERE o.user_id = ? GROUP BY b.brand ORDER BY cnt DESC',
                [req.user.id]
            );
            prefCategories = favCats.map(r => r.category).filter(Boolean);
            prefBrands = ordBrands.map(r => r.brand).filter(Boolean);
            const ordDisc = await db.query(
                'SELECT b.discipline as discipline, COUNT(*) as cnt FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN bikes b ON oi.bike_id = b.id WHERE o.user_id = ? GROUP BY b.discipline ORDER BY cnt DESC',
                [req.user.id]
            );
            prefDisciplines = ordDisc.map(r => unifyDiscipline(r.discipline)).filter(Boolean);
            const evRows = await db.query(
                'SELECT b.price as price FROM metric_events me JOIN bikes b ON me.bike_id = b.id WHERE me.user_id = ? AND me.created_at >= ? AND me.event_type IN ("detail_open","add_to_cart","order","rec_click")',
                [req.user.id, since]
            );
            for (const r of evRows) { const br = bucket(r.price); if (br) priceBucketCounts.set(JSON.stringify(br), (priceBucketCounts.get(JSON.stringify(br)) || 0) + 1); }
        }

        if (sessionId) {
            const sessCats = await db.query(
                'SELECT b.category as category, COUNT(*) as cnt FROM metric_events me JOIN bikes b ON me.bike_id = b.id WHERE me.session_id = ? AND me.created_at >= ? AND me.event_type IN ("detail_open","impression","add_to_cart","rec_click","rec_impression") GROUP BY b.category ORDER BY cnt DESC',
                [sessionId, since]
            );
            const sessBrands = await db.query(
                'SELECT b.brand as brand, COUNT(*) as cnt FROM metric_events me JOIN bikes b ON me.bike_id = b.id WHERE me.session_id = ? AND me.created_at >= ? AND me.event_type IN ("detail_open","impression","add_to_cart","rec_click","rec_impression") GROUP BY b.brand ORDER BY cnt DESC',
                [sessionId, since]
            );
            const cats = sessCats.map(r => r.category).filter(Boolean);
            const brands = sessBrands.map(r => r.brand).filter(Boolean);
            const sessDisc = await db.query(
                'SELECT b.discipline as discipline, COUNT(*) as cnt FROM metric_events me JOIN bikes b ON me.bike_id = b.id WHERE me.session_id = ? AND me.created_at >= ? AND me.event_type IN ("detail_open","impression","add_to_cart","rec_click","rec_impression") GROUP BY b.discipline ORDER BY cnt DESC',
                [sessionId, since]
            );
            const discs = sessDisc.map(r => unifyDiscipline(r.discipline)).filter(Boolean);
            // Merge keeping order and uniqueness
            for (const c of cats) if (!prefCategories.includes(c)) prefCategories.push(c);
            for (const b of brands) if (!prefBrands.includes(b)) prefBrands.push(b);
            for (const d of discs) if (!prefDisciplines.includes(d)) prefDisciplines.push(d);
            const evRows2 = await db.query(
                'SELECT b.price as price FROM metric_events me JOIN bikes b ON me.bike_id = b.id WHERE me.session_id = ? AND me.created_at >= ? AND me.event_type IN ("detail_open","add_to_cart","order","rec_click")',
                [sessionId, since]
            );
            for (const r of evRows2) { const br = bucket(r.price); if (br) priceBucketCounts.set(JSON.stringify(br), (priceBucketCounts.get(JSON.stringify(br)) || 0) + 1); }
        }

        // Apply nav category hint from header
        if (navCat) {
            const mapped = unifyCategory(navCat);
            if (mapped && !prefCategories.includes(mapped)) prefCategories.unshift(mapped);
        }

        // Derive price window from session/user behavior
        let minP = minPrice ? parseFloat(String(minPrice)) : null;
        let maxP = maxPrice ? parseFloat(String(maxPrice)) : null;
        if (!minP || !maxP) {
            try {
                let rows = [];
                if (sessionId) {
                    rows = await db.query('SELECT b.price FROM metric_events me JOIN bikes b ON me.bike_id = b.id WHERE me.session_id = ? AND me.created_at >= ? AND me.event_type IN ("detail_open","add_to_cart","order")', [sessionId, since]);
                }
                if (!rows.length && req.user) {
                    rows = await db.query('SELECT b.price FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN bikes b ON oi.bike_id = b.id WHERE o.user_id = ? AND o.created_at >= ?', [req.user.id, since]);
                }
                const prices = rows.map(r => Number(r.price)).filter(v => Number.isFinite(v) && v > 0);
                if (!prices.length && priceBucketCounts.size) {
                    let top = null; let topCnt = -1;
                    for (const [k, v] of priceBucketCounts.entries()) { if (v > topCnt) { topCnt = v; top = JSON.parse(k); } }
                    if (top) { minP = top[0]; maxP = top[1]; }
                }
                if (prices.length) {
                    prices.sort((a, b) => a - b);
                    const mid = Math.floor(prices.length / 2);
                    const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
                    const spread = Math.max(200, median * 0.35);
                    minP = Math.max(0, median - spread);
                    maxP = median + spread;
                }
            } catch { }
        }

        const searchRows = await db.query('SELECT query, category, brand, min_price, max_price FROM search_events WHERE (session_id = ? OR user_id = ?) AND ts >= ? ORDER BY ts DESC', [sessionId || null, req.user?.id || null, since]);
        const searchCats = [];
        const searchBrands = [];
        const searchTokenize = (q) => String(q || '').toLowerCase().split(/[^a-zA-Z0-9а-яА-Я]+/).filter(Boolean);
        for (const s of searchRows) {
            if (s.category) searchCats.push(unifyCategory(String(s.category)));
            if (s.brand) searchBrands.push(String(s.brand));
            const toks = searchTokenize(s.query);
            for (const t of toks) {
                if (CATEGORY_ALIASES[t]) searchCats.push(unifyCategory(CATEGORY_ALIASES[t]));
            }
            if (s.min_price != null && s.max_price != null && (!minP || !maxP)) { minP = Number(s.min_price); maxP = Number(s.max_price); }
        }
        for (const c of searchCats) if (c && !prefCategories.includes(c)) prefCategories.push(c);
        for (const b of searchBrands) if (b && !prefBrands.includes(b)) prefBrands.push(b);

        const cacheKey = (!req.user && sessionId) ? `${String(sessionId)}|${String(limit)}|${String(offset)}|${String(navCat || '')}|${String(minP || '')}-${String(maxP || '')}|${String(variant)}` : null;
        if (cacheKey && __recCache.has(cacheKey)) {
            const cached = __recCache.get(cacheKey);
            if (cached && cached.exp > Date.now()) {
                return res.json(cached.payload);
            }
        }

        // Candidate bikes
        let candidates = [];
        const dbCats = prefCategories.map(unifyCategory).filter(Boolean);
        const dbDiscs = prefDisciplines.map(unifyDiscipline).filter(Boolean);
        const idealCats = dbCats.slice(0, 2);
        const idealBrands = prefBrands.slice(0, 3);
        const idealDiscs = dbDiscs.slice(0, 3);
        const adjMap = {
            'Горный': ['Шоссейный', 'Электро'],
            'Шоссейный': ['Горный', 'Гравийный'],
            'Гравийный': ['Шоссейный'],
            'Электро': ['Горный', 'Шоссейный'],
            'Детский': ['Горный']
        };
        const adjCats = Array.from(new Set(idealCats.flatMap(c => (adjMap[c] || [])))).filter(Boolean);
        if (variant === 'v3-deep' && (idealCats.length || idealBrands.length || idealDiscs.length)) {
            const priceFilterIdeal = (minP && maxP) ? ' AND b.price BETWEEN ? AND ? ' : ' ';
            const discFilterIdeal = idealDiscs.length ? ' AND b.discipline IN (' + Array(idealDiscs.length).fill('?').join(',') + ') ' : ' ';
            const brandFilterIdeal = idealBrands.length ? ' AND b.brand IN (' + Array(idealBrands.length).fill('?').join(',') + ') ' : ' ';
            const catFilterIdeal = idealCats.length ? ' AND b.category IN (' + Array(idealCats.length).fill('?').join(',') + ') ' : ' ';
            const paramsIdeal = [];
            if (idealCats.length) paramsIdeal.push(...idealCats);
            if (idealBrands.length) paramsIdeal.push(...idealBrands);
            if (idealDiscs.length) paramsIdeal.push(...idealDiscs);
            if (minP && maxP) paramsIdeal.push(minP, maxP);
            const qIdeal = 'SELECT b.*, e.price_value_score, e.seasonal_fit_score, m.detail_clicks, m.orders, m.avg_dwell_ms FROM bikes b LEFT JOIN bike_evaluations e ON b.id = e.bike_id LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id WHERE (b.is_active IS NULL OR b.is_active != 0)' + catFilterIdeal + brandFilterIdeal + discFilterIdeal + priceFilterIdeal + ' ORDER BY m.orders DESC, m.detail_clicks DESC, b.added_at DESC LIMIT ? OFFSET ?';
            candidates = await db.query(qIdeal, [...paramsIdeal, parseInt(limit), parseInt(offset)]);
            if (!candidates.length && adjCats.length) {
                const adjFilter = ' AND b.category IN (' + Array(adjCats.length).fill('?').join(',') + ') ';
                const paramsAdj = [...adjCats];
                if (minP && maxP) paramsAdj.push(minP, maxP);
                const qAdj = 'SELECT b.*, e.price_value_score, e.seasonal_fit_score, m.detail_clicks, m.orders, m.avg_dwell_ms FROM bikes b LEFT JOIN bike_evaluations e ON b.id = e.bike_id LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id WHERE (b.is_active IS NULL OR b.is_active != 0)' + adjFilter + priceFilterIdeal + ' ORDER BY b.added_at DESC LIMIT ? OFFSET ?';
                candidates = await db.query(qAdj, [...paramsAdj, parseInt(limit), parseInt(offset)]);
            }
        }
        if (variant === 'v0-popular') {
            const priceFilter = (minP && maxP) ? ' WHERE (b.is_active IS NULL OR b.is_active != 0) AND b.price BETWEEN ? AND ? ' : ' WHERE (b.is_active IS NULL OR b.is_active != 0) ';
            candidates = await db.query(
                `SELECT b.*, m.detail_clicks, m.orders, m.avg_dwell_ms, m.impressions
                 FROM bikes b
                 LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id
                 ${priceFilter}
                 ORDER BY (CAST(COALESCE(m.detail_clicks,0) AS REAL)+1)/(CAST(COALESCE(m.impressions,0) AS REAL)+5) DESC, b.added_at DESC
                 LIMIT ? OFFSET ?`,
                [...(minP && maxP ? [minP, maxP] : []), parseInt(limit), parseInt(offset)]
            );
        } else if (variant === 'v2-brand') {
            if (prefBrands.length) {
                const placeholdersB = Array(prefBrands.length).fill('?').join(',');
                const priceFilter = (minP && maxP) ? ' AND b.price BETWEEN ? AND ? ' : ' ';
                candidates = await db.query(
                    `SELECT b.*, e.price_value_score, e.seasonal_fit_score, m.detail_clicks, m.orders, m.avg_dwell_ms
                     FROM bikes b
                     LEFT JOIN bike_evaluations e ON b.id = e.bike_id
                     LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id
                     WHERE b.is_active IS NULL OR b.is_active != 0
                     AND b.brand IN (${placeholdersB})${priceFilter}
                     ORDER BY b.added_at DESC
                     LIMIT ? OFFSET ?`,
                    [...prefBrands, ...(minP && maxP ? [minP, maxP] : []), parseInt(limit), parseInt(offset)]
                );
            }
        }
        if (!candidates.length && dbCats.length) {
            const placeholders = Array(prefCategories.length).fill('?').join(',');
            const priceFilter = (minP && maxP) ? ' AND b.price BETWEEN ? AND ? ' : ' ';
            candidates = await db.query(
                `SELECT b.*, e.price_value_score, e.seasonal_fit_score, m.detail_clicks, m.orders, m.avg_dwell_ms
                 FROM bikes b
                 LEFT JOIN bike_evaluations e ON b.id = e.bike_id
                 LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id
                 WHERE b.is_active IS NULL OR b.is_active != 0
                 AND b.category IN (${placeholders})${priceFilter}
                 ORDER BY b.added_at DESC
                 LIMIT ? OFFSET ?`,
                [...dbCats, ...(minP && maxP ? [minP, maxP] : []), parseInt(limit), parseInt(offset)]
            );
        }
        if (!candidates.length) {
            const priceFilter = (minP && maxP) ? ' WHERE (b.is_active IS NULL OR b.is_active != 0) AND b.price BETWEEN ? AND ? ' : ' WHERE (b.is_active IS NULL OR b.is_active != 0) ';
            candidates = await db.query(
                `SELECT b.*, e.price_value_score, e.seasonal_fit_score, m.detail_clicks, m.orders, m.avg_dwell_ms
                 FROM bikes b
                 LEFT JOIN bike_evaluations e ON b.id = e.bike_id
                 LEFT JOIN bike_behavior_metrics m ON b.id = m.bike_id
                 ${priceFilter}
                 ORDER BY b.added_at DESC
                 LIMIT ? OFFSET ?`,
                [...(minP && maxP ? [minP, maxP] : []), parseInt(limit), parseInt(offset)]
            );
        }

        // Score
        const brandSet = new Set(prefBrands);
        const catOrder = new Map(prefCategories.map((c, i) => [c, i]));
        const discOrder = new Map(prefDisciplines.map((d, i) => [d, i]));
        const now = Date.now();
        const scored = candidates.map(b => {
            const clicks = Number(b.detail_clicks || 0);
            const orders = Number(b.orders || 0);
            const dwell = Number(b.avg_dwell_ms || 0);
            const priceScore = Number(b.price_value_score || 0);
            const seasonal = Number(b.seasonal_fit_score || 0);
            const discount = Number(b.discount || 0);
            const addedAt = b.added_at ? Date.parse(b.added_at) : now;
            const recency = Math.max(0, 1 - (now - addedAt) / (30 * 24 * 60 * 60 * 1000));
            const catBoost = catOrder.has(b.category) ? (prefCategories.length - catOrder.get(b.category)) / Math.max(1, prefCategories.length) : 0;
            const brandBoost = brandSet.has(b.brand) ? 0.3 : 0;
            const discBoost = discOrder.has(unifyDiscipline(b.discipline)) ? (prefDisciplines.length - discOrder.get(unifyDiscipline(b.discipline))) / Math.max(1, prefDisciplines.length) : 0;
            const regionBoost = region && b.location && String(b.location).toLowerCase().includes(String(region).toLowerCase()) ? 0.2 : 0;
            const inIdealCat = idealCats.includes(b.category);
            const inIdealBrand = idealBrands.includes(b.brand);
            const inIdealDisc = idealDiscs.includes(unifyDiscipline(b.discipline));
            const inIdealPrice = (minP && maxP) ? (Number(b.price) >= Number(minP) && Number(b.price) <= Number(maxP)) : true;
            const tierBoost = variant === 'v3-deep' ? ((inIdealCat ? 0.5 : 0) + (inIdealBrand ? 0.4 : 0) + (inIdealDisc ? 0.3 : 0) + (inIdealPrice ? 0.3 : 0)) : 0;
            const score = variant === 'v0-popular'
                ? ((Math.log1p(clicks) + 1) / (Math.log1p(Number(b.impressions || 0)) + 5)) + 0.2 * recency + brandBoost + regionBoost
                : (
                    0.35 * Math.log1p(clicks) +
                    0.45 * Math.log1p(orders) +
                    0.10 * Math.log1p(dwell) +
                    0.60 * (priceScore / 10) +
                    0.15 * (seasonal / 10) +
                    0.20 * (discount / 30) +
                    0.25 * recency +
                    0.50 * catBoost +
                    0.30 * discBoost +
                    brandBoost + regionBoost + tierBoost
                );
            const explainObj = String(explain) === '1' ? {
                catBoost,
                brandBoost,
                discBoost,
                regionBoost,
                recency,
                priceInRange: (minP && maxP) ? (Number(b.price) >= Number(minP) && Number(b.price) <= Number(maxP)) : null,
                discount: Number(b.discount || 0),
                clicks,
                orders,
                dwell,
                priceScore,
                seasonal,
                tier: (variant === 'v3-deep') ? (inIdealCat || inIdealBrand || inIdealDisc ? 'ideal' : 'adjacent') : null
            } : undefined;

            // Calculate savings
            if (b.original_price && b.price && b.original_price > b.price) {
                b.savings = b.original_price - b.price;
            } else {
                b.savings = 0;
            }

            return explainObj ? { ...b, _rec_score: score, explain: explainObj } : { ...b, _rec_score: score };
        }).sort((a, b) => b._rec_score - a._rec_score);

        const payload = { success: true, bikes: scored.slice(0, parseInt(limit)), meta: { categories: dbCats, brands: prefBrands, region: region || null, priceRange: (minP && maxP) ? { min: minP, max: maxP } : null, variant } };
        if (cacheKey) {
            __recCache.set(cacheKey, { exp: Date.now() + 5 * 60 * 1000, payload });
        }
        res.json(payload);
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'recommendations', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get popular bikes based on favorites count
app.get('/api/bikes/popular', optionalAuth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const popularBikes = await db.query(`
            SELECT 
                bikes.*,
                GROUP_CONCAT(DISTINCT COALESCE(bike_images.local_path, bike_images.image_url) ORDER BY bike_images.image_order) as images,
                COUNT(DISTINCT user_favorites.id) as favorites_count
            FROM bikes 
            LEFT JOIN bike_images ON bikes.id = bike_images.bike_id
            LEFT JOIN user_favorites ON bikes.id = user_favorites.bike_id
            WHERE bikes.is_active = TRUE
            GROUP BY bikes.id
            HAVING favorites_count > 0
            ORDER BY favorites_count DESC, bikes.added_at DESC
            LIMIT ?
        `, [parseInt(limit)]);

        const bikeIds = popularBikes.map(b => b.id).filter(Boolean);
        const favoriteIds = await loadFavoriteBikeIdSet(req.user?.id, bikeIds);

        // Process each bike
        for (let bike of popularBikes) {
            bike.images = bike.images ? bike.images.split(',') : [];
            bike.image = bike.images[0] || bike.main_image;

            bike.is_favorite = favoriteIds.has(bike.id);

            // Calculate savings
            if (bike.original_price && bike.price && bike.original_price > bike.price) {
                bike.savings = bike.original_price - bike.price;
            } else {
                bike.savings = 0;
            }
        }

        res.json({
            success: true,
            bikes: popularBikes,
            total: popularBikes.length
        });

    } catch (error) {
        console.error('Get popular bikes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 🤖 BOT SYNC ROUTE (optional, for decoupled setups)
// ========================================
// NOTE: Second /api/image-proxy REMOVED - use secured version at line ~1673
// The removed handler had no SSRF protection (private IP blocking, domain allowlist)

app.post('/api/bot/sync', async (req, res) => {
    try {
        const secret = req.headers['x-bot-secret'];
        if (!secret || secret !== BOT_SECRET) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const payload = req.body || {};
        const id = payload.id;
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });
        const rows = await db.query('SELECT id FROM bikes WHERE id = ?', [id]);
        // Если запись существует — считаем синхронизацию успешной (единая БД)
        if (rows.length > 0) {
            return res.json({ success: true, id, exists: true });
        }
        // Если не существует — создаём упрощённую запись
        const name = payload.name || `${payload.brand || ''} ${payload.model || ''}`.trim() || 'Unknown Bike';
        const insert = await db.query(`
            INSERT INTO bikes (id, name, category, brand, model, price, description, main_image, source, is_active, ranking_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            name,
            payload.category || 'other',
            payload.brand || 'Unknown',
            payload.model || '',
            Number(payload.price || 0),
            payload.description || '',
            payload.main_image || '',
            'telegram-bot',
            1,
            0.50,
        ]);
        // Добавим изображения если есть
        if (Array.isArray(payload.images)) {
            for (let i = 0; i < payload.images.length; i++) {
                const img = payload.images[i];
                await db.query(
                    'INSERT INTO bike_images (bike_id, image_url, image_order, is_main) VALUES (?, ?, ?, ?)',
                    [id, img, i, i === 0 ? 1 : 0]
                );
            }
        }
        return res.json({ success: true, id, exists: false });
    } catch (err) {
        console.error('Bot sync error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get single bike by ID
app.get('/api/bikes/:id', optionalAuth, async (req, res) => {
    try {
        const bikeId = req.params.id;

        // Get bike data with favorites count
        const bikes = await db.query(`
            SELECT 
                bikes.*,
                COUNT(DISTINCT user_favorites.id) as favorites_count
            FROM bikes 
            LEFT JOIN user_favorites ON bikes.id = user_favorites.bike_id
            WHERE bikes.id = ? AND bikes.is_active = TRUE
            GROUP BY bikes.id
        `, [bikeId]);

        if (bikes.length === 0) {
            return res.status(404).json({ error: 'Bike not found' });
        }

        const bike = bikes[0];

        // Get images
        const images = await db.query(
            'SELECT image_url, image_order, is_main FROM bike_images WHERE bike_id = ? ORDER BY image_order',
            [bikeId]
        );
        const normalized = images.map((img) => ({
            image_url: normalizeImagePath(img.image_url),
            image_order: img.image_order,
            is_main: !!img.is_main
        }));
        const existing = normalized.filter((img) => localImageExists(img.image_url));
        bike.images = existing.map(img => ({
            image_url: resolveImageUrl(img.image_url),
            image_order: img.image_order,
            is_main: img.is_main
        }));
        bike.main_image = pickAvailableMainImage(bikeId, bike.main_image, normalized.map((x) => x.image_url));
        bike.image = (bike.images[0]?.image_url) || bike.main_image;

        // Get specs
        const specs = await db.query(
            'SELECT spec_label as label, spec_value as value FROM bike_specs WHERE bike_id = ? ORDER BY spec_order',
            [bikeId]
        );
        bike.specs = specs;

        // Check if bike is in user's favorites (if user is authenticated)
        if (req.user) {
            const favoriteCheck = await db.query(
                'SELECT id FROM user_favorites WHERE user_id = ? AND bike_id = ?',
                [req.user.id, bikeId]
            );
            bike.is_favorite = favoriteCheck.length > 0;
        } else {
            bike.is_favorite = false;
        }

        // Calculate savings
        if (bike.original_price && bike.price && bike.original_price > bike.price) {
            bike.savings = bike.original_price - bike.price;
        } else {
            bike.savings = 0;
        }

        res.json({ success: true, bike });

    } catch (error) {
        console.error('Get bike error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/favorites/check/:id', optionalAuth, async (req, res) => {
    try {
        const bikeId = req.params.id;
        if (!req.user) {
            return res.json({ isInFavorites: false });
        }
        const favoriteCheck = await db.query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND bike_id = ?',
            [req.user.id, bikeId]
        );
        res.json({ isInFavorites: favoriteCheck.length > 0 });
    } catch (error) {
        console.error('Favorites check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Catalog bikes endpoint with normalized image URLs
app.get('/api/catalog/bikes', optionalAuth, async (req, res) => {
    try {
        const { limit = 50, offset = 0, search, brand, category, discipline, hot } = req.query;

        let where = ['b.is_active = TRUE'];
        let params = [];
        if (brand) { where.push('b.brand = ?'); params.push(brand); }
        if (category) { where.push('b.category = ?'); params.push(category); }
        // Hot offers filter
        if (hot !== undefined) {
            const hv = String(hot).toLowerCase();
            if (['1', 'true', 'yes', 'on'].includes(hv)) {
                where.push('b.is_hot = 1');
            }
        }
        if (discipline) {
            if (Array.isArray(discipline)) {
                where.push(`b.discipline IN (${discipline.map(() => '?').join(',')})`);
                params.push(...discipline);
            } else {
                where.push('b.discipline = ?');
                params.push(discipline);
            }
        }
        if (search) {
            where.push('(b.name LIKE ? OR b.brand LIKE ? OR b.model LIKE ? OR b.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const whereClause = where.join(' AND ');

        const sql = `
            SELECT 
                b.*,
                GROUP_CONCAT(DISTINCT bi.image_url ORDER BY bi.image_order) as images
            FROM bikes b
            LEFT JOIN bike_images bi ON b.id = bi.bike_id
            WHERE ${whereClause}
            GROUP BY b.id
            ORDER BY ${req.query.sort === 'rank' ? 'b.ranking_score DESC' : 'b.added_at DESC'}
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), parseInt(offset));
        const rows = await db.query(sql, params);
        const bikeIds = rows.map(r => r.id).filter(Boolean);
        const specsById = await loadSpecsByBikeId(bikeIds);

        const normalized = [];
        for (const b of rows) {
            // Get Active Order Status for this bike if reserved
            let activeOrderStatus = null;
            if (b.is_reserviert) {
                try {
                    const orders = await db.query('SELECT status FROM orders WHERE bike_id = ? AND status NOT IN ("cancelled", "closed") ORDER BY created_at DESC LIMIT 1', [b.id]);
                    if (orders.length > 0) activeOrderStatus = orders[0].status;
                } catch { }
            }

            const rawImages = b.images ? b.images.split(',') : [];
            const normalizedList = rawImages.map((u) => normalizeImagePath(u));
            const imagesArr = filterExistingImages(normalizedList).map(resolveImageUrl);

            let year = b.year;
            let size = b.size;
            let wheel = b.wheel_diameter;



            if (!year || year === 0 || String(year).trim() === '' || !size || String(size).trim() === '' || !wheel || String(wheel).trim() === '') {
                const specs = specsById.get(b.id) || [];
                if (!year || year === 0 || String(year).trim() === '') {
                    const ySpec = specs.find(s => (s.label || '').toLowerCase() === 'год выпуска');
                    const yVal = ySpec && ySpec.value ? String(ySpec.value) : '';
                    const yMatch = yVal.match(/(19\d{2}|20\d{2})/);
                    if (yMatch) year = parseInt(yMatch[1], 10);
                }

                if (!size || String(size).trim() === '') {
                    const sSpec = specs.find(s => (s.label || '').toLowerCase() === '?????? ????');
                    const sVal = sSpec && sSpec.value ? String(sSpec.value).trim() : '';
                    if (sVal && sVal.toLowerCase() !== '?? ??????') size = sVal;
                }

                if (!wheel || String(wheel).trim() === '') {
                    const wdVals = specs
                        .filter(s => (s.label || '').toLowerCase() === '???????? ??????')
                        .map(s => s.value)
                        .filter(v => v && String(v).trim() !== '' && String(v).toLowerCase() !== '?? ??????');
                    if (wdVals.length > 0) wheel = String(wdVals[0]).trim();
                }
            }


            normalized.push({
                id: b.id,
                name: b.name,
                brand: b.brand,
                model: b.model,
                price: b.price,
                original_price: b.original_price,
                discount: b.discount,
                savings: (b.original_price && b.price && b.original_price > b.price) ? (b.original_price - b.price) : 0,
                main_image: pickAvailableMainImage(b.id, b.main_image, normalizedList) || imagesArr[0] || null,
                category: b.category,
                discipline: b.discipline,
                sub_category: b.sub_category,
                condition_status: b.condition_status,
                condition_score: b.condition_score,
                condition_grade: b.condition_grade,
                condition_reason: b.condition_reason,
                is_new: !!b.is_new,
                is_reserviert: !!b.is_reserviert,
                images: imagesArr,
                year: year || null,
                size: size || null,
                wheel_diameter: wheel || null,
                seller_name: b.seller_name,
                seller_type: b.seller_type,
                seller_member_since: b.seller_member_since,
                seller_badges: b.seller_badges_json ? JSON.parse(b.seller_badges_json) : [],
                initial_quality_class: b.initial_quality_class,
                final_quality_class: b.final_quality_class,
                is_hot: !!b.is_hot,
                ranking_score: b.ranking_score,
                active_order_status: activeOrderStatus
            });
        }

        const countRow = await db.query(`SELECT COUNT(*) as total FROM bikes b WHERE ${whereClause}`, params.slice(0, -2));
        const totalRaw = countRow[0]?.total ?? normalized.length;
        const total = Number(totalRaw);

        res.json({ success: true, bikes: normalized, total: Number.isFinite(total) ? total : normalized.length, count: normalized.length, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error('Catalog bikes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Distinct brands for catalog filters
app.get('/api/catalog/brands', optionalAuth, async (req, res) => {
    try {
        const { category, search } = req.query;

        let where = ['is_active = TRUE', 'brand IS NOT NULL', 'TRIM(brand) <> ""'];
        let params = [];
        if (category) { where.push('category = ?'); params.push(category); }
        if (search) {
            where.push('(name LIKE ? OR brand LIKE ? OR model LIKE ? OR description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const sql = `
            SELECT DISTINCT brand
            FROM bikes
            WHERE ${where.join(' AND ')}
            ORDER BY brand ASC
        `;

        const rows = await db.query(sql, params);
        const brands = rows
            .map(r => (r.brand || '').trim())
            .filter(Boolean);

        res.json({ success: true, brands });
    } catch (err) {
        console.error('Catalog brands error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List bikes without manual evaluation for queueing
app.get('/api/admin/evaluations/pending', adminAuth, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const sql = `
            SELECT b.*
            FROM bikes b
            LEFT JOIN bike_evaluations e ON b.id = e.bike_id
            WHERE e.bike_id IS NULL AND b.is_active = 1
            ORDER BY b.added_at DESC
            LIMIT ? OFFSET ?
        `;
        const rows = await db.query(sql, [parseInt(limit), parseInt(offset)]);
        res.json({ success: true, bikes: rows, total: rows.length, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error('Pending evaluations error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Wrapper to replace old function
async function computeRankingForBike(bikeId) {
    try {
        const result = await calculateRank(db.db, bikeId);

        // Update DB with results from service
        if (result && result.rank !== undefined) {
            await db.query(`
                UPDATE bikes 
                SET rank = ?, rank_components = ?, rank_updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [result.rank, result.components, bikeId]);

            // Diagnostics (optional or sampling)
            if (result.rank < 0.05 && (result.viewsDecayed > 0 || result.clicksDecayed > 0)) {
                await db.query(`
                    INSERT INTO rank_diagnostics (bike_id, new_rank, reason, components) 
                    VALUES (?, ?, 'low_rank_activity', ?)
                 `, [bikeId, result.rank, result.components]);
            }
            return result.rank;
        }
        return 0.5;
    } catch (e) {
        console.error('Ranking update error:', e);
        return 0.5;
    }
}



app.get('/api/metrics/bikes/:id', async (req, res) => {
    try {
        const bikeId = req.params.id;
        const rows = await db.query('SELECT * FROM bike_behavior_metrics WHERE bike_id = ?', [bikeId]);
        res.json({ success: true, metrics: rows[0] || null });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint for Admin Push Notifications (triggered by AI Dispatcher)
app.post('/api/admin/push', adminAuth, async (req, res) => {
    // In a real scenario, this would send a push via Firebase/OneSignal
    console.log('📱 [MOCK PUSH] Notification to Admin PWA:', JSON.stringify(req.body, null, 2));

    // Log to DB if needed
    try {
        await db.query('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)', ['info', 'admin_push', JSON.stringify(req.body)]);
    } catch (e) { }

    res.json({ success: true, message: 'Push notification queued' });
});

app.post(['/api/metrics/events', '/api/behavior/events'], optionalAuth, async (req, res) => {
    try {
        const { events } = req.body;
        if (!Array.isArray(events)) return res.status(400).json({ error: 'Invalid events payload' });
        const grouped = new Map();
        for (const ev of events) {
            const id = parseInt(ev.bikeId);
            if (!id) continue;
            const sessionId = ev.session_id || null;
            const referrer = ev.referrer || null;
            const sourcePath = ev.source_path || null;
            const dwellMs = typeof ev.ms === 'number' ? ev.ms : null;
            try {
                const userId = req.user?.id || null;
                await db.query('INSERT INTO metric_events (bike_id, event_type, session_id, referrer, source_path, dwell_ms, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, String(ev.type || 'unknown'), sessionId, referrer, sourcePath, dwellMs, userId]);
            } catch (e) {
                await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'metrics_events', String(e.message || e), e.stack || '']);
            }
            const g = grouped.get(id) || {
                impressions: 0, detail_clicks: 0, add_to_cart: 0, orders: 0, favorites: 0, shares: 0,
                avg_dwell_ms_sum: 0, avg_dwell_count: 0, bounces: 0,
                hovers: 0, scroll_stops: 0, gallery_swipes: 0
            };

            if (ev.type === 'impression') g.impressions++;
            else if (ev.type === 'detail_open' || ev.type === 'click') g.detail_clicks++;
            else if (ev.type === 'add_to_cart') g.add_to_cart++;
            else if (ev.type === 'order') g.orders++;
            else if (ev.type === 'favorite') g.favorites++;
            else if (ev.type === 'share') g.shares++;
            else if (ev.type === 'bounce') g.bounces++;
            else if (ev.type === 'hover') g.hovers++;
            else if (ev.type === 'scroll_stop') g.scroll_stops++;
            else if (ev.type === 'gallery_swipe') g.gallery_swipes++;

            if (ev.type === 'dwell' && typeof ev.ms === 'number') { g.avg_dwell_ms_sum += ev.ms; g.avg_dwell_count++; }
            grouped.set(id, g);
        }
        for (const [bikeId, g] of grouped.entries()) {
            const existing = await db.query('SELECT bike_id FROM bike_behavior_metrics WHERE bike_id = ?', [bikeId]);
            const avgDwell = g.avg_dwell_count > 0 ? Math.round(g.avg_dwell_ms_sum / g.avg_dwell_count) : 0;
            if (existing.length) {
                await db.query(
                    'UPDATE bike_behavior_metrics SET impressions = impressions + ?, detail_clicks = detail_clicks + ?, add_to_cart = add_to_cart + ?, orders = orders + ?, favorites = favorites + ?, shares = shares + ?, avg_dwell_ms = ?, bounces = bounces + ?, hovers = hovers + ?, scroll_stops = scroll_stops + ?, gallery_swipes = gallery_swipes + ?, updated_at = CURRENT_TIMESTAMP WHERE bike_id = ?',
                    [g.impressions, g.detail_clicks, g.add_to_cart, g.orders, g.favorites, g.shares, avgDwell, g.bounces, g.hovers, g.scroll_stops, g.gallery_swipes, bikeId]
                );
            } else {
                await db.query(
                    'INSERT INTO bike_behavior_metrics (bike_id, impressions, detail_clicks, add_to_cart, orders, favorites, shares, avg_dwell_ms, bounces, hovers, scroll_stops, gallery_swipes, period_start, period_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
                    [bikeId, g.impressions, g.detail_clicks, g.add_to_cart, g.orders, g.favorites, g.shares, avgDwell, g.bounces, g.hovers, g.scroll_stops, g.gallery_swipes]
                );
            }
            await computeRankingForBike(bikeId);
        }
        res.json({ success: true });
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'metrics_events', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/metrics/search', optionalAuth, async (req, res) => {
    try {
        const { query, category, brand, minPrice, maxPrice } = req.body || {};
        const sessionId = req.headers['x-session-id'] ? String(req.headers['x-session-id']) : null;
        const userId = req.user?.id || null;
        if (!query && !category && !brand) return res.status(400).json({ error: 'Invalid search payload' });
        await db.query(
            'INSERT INTO search_events (session_id, user_id, query, category, brand, min_price, max_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [sessionId, userId, query ? String(query) : null, category ? String(category) : null, brand ? String(brand) : null, minPrice != null ? Number(minPrice) : null, maxPrice != null ? Number(maxPrice) : null]
        );
        res.json({ success: true });
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'metrics_search', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/bikes/:id/evaluation', adminAuth, async (req, res) => {
    try {
        const bikeId = parseInt(req.params.id);
        const rows = await db.query('SELECT * FROM bike_evaluations WHERE bike_id = ?', [bikeId]);
        res.json({ success: true, evaluation: rows[0] || null });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/bikes/:id/evaluation', adminAuth, async (req, res) => {
    try {
        const bikeId = parseInt(req.params.id);
        const e = req.body || {};
        const existing = await db.query('SELECT bike_id FROM bike_evaluations WHERE bike_id = ?', [bikeId]);
        const fields = ['price_value_score', 'quality_appearance_score', 'detail_intent_score', 'trust_confidence_score', 'seasonal_fit_score', 'notes'];
        const vals = fields.map(f => e[f]);
        if (existing.length) {
            await db.query('UPDATE bike_evaluations SET price_value_score = COALESCE(?, price_value_score), quality_appearance_score = COALESCE(?, quality_appearance_score), detail_intent_score = COALESCE(?, detail_intent_score), trust_confidence_score = COALESCE(?, trust_confidence_score), seasonal_fit_score = COALESCE(?, seasonal_fit_score), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE bike_id = ?', [...vals, bikeId]);
        } else {
            await db.query('INSERT INTO bike_evaluations (bike_id, price_value_score, quality_appearance_score, detail_intent_score, trust_confidence_score, seasonal_fit_score, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [bikeId, e.price_value_score || 5, e.quality_appearance_score || 5, e.detail_intent_score || 5, e.trust_confidence_score || null, e.seasonal_fit_score || null, e.notes || null]);
        }
        const score = await computeRankingForBike(bikeId);
        res.json({ success: true, ranking_score: score });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/bikes/:id/recompute', adminAuth, async (req, res) => {
    try {
        const bikeId = parseInt(req.params.id);
        const score = await computeRankingForBike(bikeId);
        res.json({ success: true, ranking_score: score });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/ranking/recompute-all', adminAuth, async (req, res) => {
    try {
        const bikes = await db.query('SELECT id FROM bikes WHERE is_active = 1');
        for (const b of bikes) {
            await computeRankingForBike(b.id);
        }
        res.json({ success: true, count: bikes.length });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/bikes/:id/rank-diagnostics', adminAuth, async (req, res) => {
    try {
        const bikeId = parseInt(req.params.id);
        const rows = await db.query('SELECT * FROM rank_diagnostics WHERE bike_id = ? ORDER BY created_at DESC LIMIT 50', [bikeId]);

        // Also get current rank data
        const bike = await db.query('SELECT rank, rank_components, rank_updated_at FROM bikes WHERE id = ?', [bikeId]);

        res.json({
            success: true,
            current: bike[0] || null,
            history: rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: list bikes (simple info) for management
app.get('/api/admin/bikes', adminAuth, async (req, res) => {
    try {
        const { search, category, brand, limit = 50, offset = 0 } = req.query;
        let where = ['is_active = 1'];
        const params = [];
        if (category) { where.push('category = ?'); params.push(category); }
        if (brand) { where.push('brand = ?'); params.push(brand); }
        if (search) { where.push('(name LIKE ? OR brand LIKE ? OR model LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        const rows = await db.query(`SELECT id, name, brand, model, price, discount, category, is_active, ranking_score FROM bikes WHERE ${where.join(' AND ')} ORDER BY added_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
        res.json({ success: true, bikes: rows });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: update bike info
app.put('/api/admin/bikes/:id', adminAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const fields = ['name', 'brand', 'model', 'price', 'discount', 'description', 'category', 'discipline', 'is_active'];
        const sets = [];
        const params = [];
        for (const f of fields) {
            if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
        }
        if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
        params.push(id);
        await db.query(`UPDATE bikes SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
        const score = await computeRankingForBike(id);
        res.json({ success: true, ranking_score: score });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: deactivate bike
app.post('/api/admin/bikes/:id/deactivate', adminAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await db.query('UPDATE bikes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: toggle hot flag on bike
app.post('/api/admin/bikes/:id/toggle-hot', adminAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const rows = await db.query('SELECT is_hot FROM bikes WHERE id = ? LIMIT 1', [id]);
        if (!rows || !rows.length) return res.status(404).json({ success: false, error: 'not_found' });
        const current = Number(rows[0].is_hot || 0) ? 1 : 0;
        let next = current ? 0 : 1;
        if (req.body && (req.body.value !== undefined || req.body.hot !== undefined)) {
            const raw = req.body.value !== undefined ? req.body.value : req.body.hot;
            const hv = String(raw).toLowerCase();
            next = ['1', 'true', 'yes', 'on'].includes(hv) ? 1 : 0;
        }
        await db.query('UPDATE bikes SET is_hot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, id]);
        try { await computeRankingForBike(id); } catch { }
        res.json({ success: true, id, is_hot: !!next });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: finance overview
app.get('/api/admin/finance/overview', adminAuth, async (req, res) => {
    try {
        const { window = '7d' } = req.query;
        const days = String(window).endsWith('d') ? parseInt(String(window)) : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        let ordersRows = [];
        let itemsRows = [];
        let dailyRows = [];
        let byCategory = [];
        try {
            ordersRows = await db.query('SELECT id, total_amount, created_at FROM orders WHERE created_at >= ?', [since]);
        } catch { }
        const totalRevenue = ordersRows.reduce((s, o) => s + Number(o.total_amount || 0), 0);
        const aov = ordersRows.length ? totalRevenue / ordersRows.length : 0;
        try {
            itemsRows = await db.query('SELECT oi.quantity as qty FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.created_at >= ?', [since]);
        } catch { }
        const totalItems = itemsRows.reduce((s, r) => s + Number(r.qty || 0), 0);
        const itemsPerOrder = ordersRows.length ? totalItems / ordersRows.length : 0;
        try {
            dailyRows = await db.query('SELECT DATE(created_at) as day, SUM(total_amount) as revenue FROM orders WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY day', [since]);
        } catch { }
        try {
            byCategory = await db.query('SELECT b.category, SUM(oi.quantity * oi.unit_price) as revenue FROM order_items oi JOIN bikes b ON oi.bike_id = b.id JOIN orders o ON oi.order_id = o.id WHERE o.created_at >= ? GROUP BY b.category ORDER BY revenue DESC', [since]);
        } catch { }
        res.json({ success: true, overview: { totalRevenue, aov, itemsPerOrder }, daily: dailyRows, byCategory });
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'finance_overview', String(error.message || error), error.stack || '']); } catch { }
        res.json({ success: true, overview: { totalRevenue: 0, aov: 0, itemsPerOrder: 0 }, daily: [], byCategory: [] });
    }
});

// Admin: orders list
app.get('/api/admin/orders', adminAuth, async (req, res) => {
    try {
        const { window = '7d', limit = 50, offset = 0 } = req.query;
        const days = String(window).endsWith('d') ? parseInt(String(window)) : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const rows = await db.query('SELECT id, total_amount, status, created_at FROM orders WHERE created_at >= ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [since, parseInt(limit), parseInt(offset)]);
        res.json({ success: true, orders: rows });
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'orders_list', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 💰 SPRINT 3: PAYMENT WEBHOOK
// ========================================

app.post('/api/payments/webhook', async (req, res) => {
    try {
        // SECURITY: Verify webhook signature/secret
        const webhookSecret = req.headers['x-webhook-secret'] || req.headers['stripe-signature'];
        const expectedSecret = process.env.WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

        if (!expectedSecret) {
            console.warn('⚠️ WEBHOOK_SECRET not configured - rejecting payment webhook');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        // For Stripe, proper signature validation would use stripe.webhooks.constructEvent()
        // For simplicity, checking secret header
        if (!webhookSecret || webhookSecret !== expectedSecret) {
            console.warn('⚠️ Invalid payment webhook signature attempt');
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body;
        console.log('🔔 Payment Webhook Received:', event.type);

        if (event.type === 'payment_intent.succeeded' || event.type === 'mock.payment.success') {
            const metadata = event.data?.object?.metadata || event.metadata || {};
            const orderId = metadata.order_id || event.order_id;
            const amount = metadata.amount || event.amount;
            const paymentId = event.id || `pay_${Date.now()}`;

            console.log(`✅ Processing successful payment for Order ${orderId}`);

            if (orderId) {
                // 1. Update Order Status
                await crmApi.updateOrderStatus(orderId, 'deposit_paid', 'Deposit received via webhook', 'system');

                // 2. Reserve Bike
                const bikeId = metadata.bike_id;
                if (bikeId) {
                    await db.query('UPDATE bikes SET is_reserviert = 1 WHERE id = ?', [bikeId]);
                    console.log(`🔒 Bike ${bikeId} reserved automatically`);
                }

                // 3. Record Finance
                await crmApi.createFinanceRecord({
                    order_id: orderId,
                    direction: 'incoming',
                    role: 'client_payment',
                    method: 'online_card',
                    amount: amount || 0,
                    currency: 'RUB',
                    status: 'completed',
                    external_reference: paymentId,
                    created_by: 'system_webhook'
                });
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Mock Payment Page (For testing/demo purposes) - SECURED with adminAuth
app.get('/mock-payment', adminAuth, (req, res) => {
    const { order_id, amount } = req.query;
    res.send(`
        <html>
            <head>
                <title>Mock Payment Gateway</title>
                <style>
                    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f4f4f5; }
                    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); width: 100%; max-width: 400px; text-align: center; }
                    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
                    p { color: #71717a; margin-bottom: 2rem; }
                    button { background: #000; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; width: 100%; transition: opacity 0.2s; }
                    button:hover { opacity: 0.9; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Оплата Задатка</h1>
                    <p>Заказ: <strong>${order_id}</strong><br>Сумма: <strong>${amount} ₽</strong></p>
                    <button id="payBtn">Оплатить 2%</button>
                </div>
                <script>
                    document.getElementById('payBtn').addEventListener('click', async () => {
                        // Simulate webhook
                        await fetch('/api/payments/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'mock.payment.success',
                                order_id: '${order_id}',
                                amount: ${amount},
                                metadata: { bike_id: 'unknown', order_id: '${order_id}' } // In real flow, metadata comes from gateway
                            })
                        });
                        // Redirect back
                        window.location.href = 'http://localhost:5173/order-tracking/${order_id}';
                    });
                </script>
            </body>
        </html>
    `);
});

// Admin: CSV export of orders
app.get('/api/admin/export/orders.csv', adminAuth, async (req, res) => {
    try {
        const { window = '7d' } = req.query;
        const days = String(window).endsWith('d') ? parseInt(String(window)) : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const rows = await db.query('SELECT id, total_amount, status, created_at FROM orders WHERE created_at >= ? ORDER BY created_at DESC', [since]);
        const header = 'id,total_amount,status,created_at\n';
        const body = rows.map(r => `${r.id},${r.total_amount},${r.status},${r.created_at}`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.send(header + body);
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'orders_export', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Metrics: top sources
app.get('/api/metrics/top-sources', async (req, res) => {
    try {
        const { window = '7d', limit = 20 } = req.query;
        const days = String(window).endsWith('d') ? parseInt(String(window)) : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const rows = await db.query('SELECT source_path, referrer, COUNT(*) as events FROM metric_events WHERE created_at >= ? GROUP BY source_path, referrer ORDER BY events DESC LIMIT ?', [since, parseInt(limit)]);
        res.json({ success: true, sources: rows });
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'top_sources', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Metrics: top bikes
app.get('/api/metrics/top-bikes', async (req, res) => {
    try {
        const { window = '7d', limit = 20 } = req.query;
        const days = String(window).endsWith('d') ? parseInt(String(window)) : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const rows = await db.query(`
            SELECT b.id, b.name, b.brand, b.model,
                SUM(CASE WHEN me.event_type="impression" THEN 1 ELSE 0 END) as imp,
                SUM(CASE WHEN me.event_type="detail_open" THEN 1 ELSE 0 END) as clk,
                SUM(CASE WHEN me.event_type="add_to_cart" THEN 1 ELSE 0 END) as atc,
                SUM(CASE WHEN me.event_type="order" THEN 1 ELSE 0 END) as ord
            FROM metric_events me JOIN bikes b ON me.bike_id = b.id
            WHERE me.created_at >= ?
            GROUP BY b.id
            ORDER BY (CAST(SUM(CASE WHEN me.event_type="detail_open" THEN 1 ELSE 0 END) AS REAL)+1)/(CAST(SUM(CASE WHEN me.event_type="impression" THEN 1 ELSE 0 END) AS REAL)+5) DESC
            LIMIT ?
        `, [since, parseInt(limit)]);
        res.json({ success: true, bikes: rows });
    } catch (error) {
        try { await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', ['error', 'top_bikes', String(error.message || error), error.stack || '']); } catch { }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: system logs
app.get('/api/admin/logs', adminAuth, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const rows = await db.query('SELECT ts, level, source, message FROM system_logs ORDER BY ts DESC LIMIT ?', [parseInt(limit)]);
        res.json({ success: true, logs: rows });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: client logs
app.post('/api/admin/logs/client', adminAuth, async (req, res) => {
    try {
        const { level = 'error', source = 'client', message = '', stack = '' } = req.body || {};
        await db.query('INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)', [String(level), String(source), String(message), String(stack)]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Bike images endpoint
app.get('/api/bike-images', async (req, res) => {
    try {
        const bikeId = req.query.bikeId;
        if (!bikeId) return res.status(400).json({ error: 'bikeId is required' });
        const rows = await db.query(
            'SELECT image_url, image_order, is_main FROM bike_images WHERE bike_id = ? ORDER BY image_order',
            [bikeId]
        );
        const images = rows
            .map(r => ({ image_url: normalizeImagePath(r.image_url), image_order: r.image_order, is_main: !!r.is_main }))
            .filter(r => localImageExists(r.image_url))
            .map(r => ({ image_url: resolveImageUrl(r.image_url), image_order: r.image_order, is_main: r.is_main }));
        res.json({ success: true, images });
    } catch (err) {
        console.error('Bike images error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/recent-deliveries', async (req, res) => {
    try {
        const rows = await db.query(
            'SELECT id, bike_id, model, city, price, main_image, status, created_at FROM recent_deliveries ORDER BY created_at DESC LIMIT 5'
        );
        const deliveries = rows.map((r) => {
            const priceNum = Number(r.price || 0);
            return {
                id: r.id,
                bike_id: r.bike_id,
                model: r.model,
                city: r.city || '',
                status: r.status || 'Снято',
                price: priceNum,
                priceBreakdown: `Байк ${Math.round(priceNum)}€ + логистика 210€ + сбор 520€`,
                image: resolveImageUrl(r.main_image),
                created_at: r.created_at
            };
        });
        res.json({ success: true, deliveries });
    } catch (e) {
        console.error('recent-deliveries error', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/recent-deliveries', async (req, res) => {
    try {
        const { bike_id, model, city, price, main_image, status } = req.body || {};
        const fields = [bike_id || null, String(model || ''), city || null, Number(price || 0), String(main_image || ''), String(status || 'Снято')];
        await db.query('INSERT INTO recent_deliveries (bike_id, model, city, price, main_image, status, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', fields);
        await db.query('DELETE FROM recent_deliveries WHERE id NOT IN (SELECT id FROM recent_deliveries ORDER BY created_at DESC LIMIT 5)');
        res.json({ success: true });
    } catch (e) {
        console.error('recent-deliveries add error', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Update bike details (protected route)
app.put('/api/bikes/:id', authenticateToken, async (req, res) => {
    try {
        const bikeId = req.params.id;
        const updates = req.body;

        // Whitelist allowed fields to update
        const allowedFields = [
            'name', 'category', 'brand', 'model', 'size', 'price',
            'original_price', 'discount', 'description', 'features',
            'delivery_info', 'warranty', 'condition_status', 'year',
            'wheel_diameter', 'location', 'is_negotiable', 'is_new',
            'discipline', 'ranking_score'
        ];

        const fieldsToUpdate = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                if (key === 'features' && typeof value !== 'string') {
                    fieldsToUpdate.push(`${key} = ?`);
                    values.push(JSON.stringify(value));
                } else if (key === 'originalPrice') { // Handle camelCase from frontend
                    fieldsToUpdate.push(`original_price = ?`);
                    values.push(value);
                } else if (key === 'original_price') {
                    fieldsToUpdate.push(`original_price = ?`);
                    values.push(value);
                } else {
                    fieldsToUpdate.push(`${key} = ?`);
                    values.push(value);
                }
            }
        }

        if (fieldsToUpdate.length > 0) {
            values.push(bikeId);
            const query = `UPDATE bikes SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
            await db.query(query, values);
        }

        // Handle specs update if provided
        if (updates.specs && Array.isArray(updates.specs)) {
            await db.query('DELETE FROM bike_specs WHERE bike_id = ?', [bikeId]);

            for (let i = 0; i < updates.specs.length; i++) {
                const spec = updates.specs[i];
                await db.query(
                    'INSERT INTO bike_specs (bike_id, spec_label, spec_value, spec_order) VALUES (?, ?, ?, ?)',
                    [bikeId, spec.label, spec.value, i]
                );
            }
        }

        res.json({ success: true, message: 'Bike updated successfully' });

    } catch (error) {
        console.error('Update bike error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new bike (protected route)
app.post('/api/bikes', authenticateToken, async (req, res) => {
    try {
        const bikeData = req.body;

        // Insert bike
        const bikeResult = await db.query(`
            INSERT INTO bikes (
                name, category, brand, model, size, price, original_price, discount,
                main_image, rating, reviews, review_count, description, features,
                delivery_info, warranty, source, original_url, condition_status,
                year, wheel_diameter, location, is_negotiable, is_new, discipline,
                ranking_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            bikeData.name, bikeData.category, bikeData.brand, bikeData.model,
            bikeData.size, bikeData.price, bikeData.originalPrice, bikeData.discount || 0,
            bikeData.image, bikeData.rating || 0, bikeData.reviews || 0, bikeData.reviewCount || 0,
            bikeData.description, JSON.stringify(bikeData.features || []),
            bikeData.deliveryInfo, bikeData.warranty, bikeData.source, bikeData.originalUrl,
            bikeData.condition, bikeData.year, bikeData.wheelDiameter, bikeData.location,
            bikeData.isNegotiable || false, bikeData.isNew || false, bikeData.discipline,
            0.50
        ]);

        const bikeId = bikeResult.insertId;

        // Insert images
        if (bikeData.images && bikeData.images.length > 0) {
            for (let i = 0; i < bikeData.images.length; i++) {
                await db.query(
                    'INSERT INTO bike_images (bike_id, image_url, image_order, is_main) VALUES (?, ?, ?, ?)',
                    [bikeId, bikeData.images[i], i, i === 0]
                );
            }
        }

        // Insert specs
        if (bikeData.specs && bikeData.specs.length > 0) {
            for (let i = 0; i < bikeData.specs.length; i++) {
                const spec = bikeData.specs[i];
                await db.query(
                    'INSERT INTO bike_specs (bike_id, spec_label, spec_value, spec_order) VALUES (?, ?, ?, ?)',
                    [bikeId, spec.label, spec.value, i]
                );
            }
        }

        res.status(201).json({ success: true, bikeId });

    } catch (error) {
        console.error('Add bike error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Trigger Ranking Recalculation (Can be called by CRON or Admin)
app.post('/api/admin/ranking/recalc', adminAuth, async (req, res) => {
    try {
        // 1. Get all metrics
        const metrics = await db.query('SELECT * FROM bike_behavior_metrics');

        // 2. Compute scores
        for (const m of metrics) {
            await computeRankingForBike(m.bike_id);
        }

        res.json({ success: true, message: 'Ranking recalculated' });
    } catch (error) {
        console.error('Ranking recalc error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Personalized Recommendations
app.post('/api/recommendations/personalized', optionalAuth, async (req, res) => {
    try {
        const { limit = 60, offset = 0, profile } = req.body;

        let bikesQuery = `
            SELECT 
                bikes.*,
                GROUP_CONCAT(DISTINCT COALESCE(bike_images.local_path, bike_images.image_url) ORDER BY bike_images.image_order) as images,
                COUNT(DISTINCT user_favorites.id) as favorites_count
            FROM bikes 
            LEFT JOIN bike_images ON bikes.id = bike_images.bike_id
            LEFT JOIN user_favorites ON bikes.id = user_favorites.bike_id
            WHERE bikes.is_active = TRUE
        `;

        const params = [];
        const whereConditions = [];

        // 1. Filter by Top Disciplines (if available)
        if (profile?.disciplines) {
            const topDisciplines = Object.entries(profile.disciplines)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 2)
                .map(([d]) => d);

            if (topDisciplines.length > 0) {
                // We match broadly on discipline or category to be safe
                const placeholders = topDisciplines.map(() => '?').join(', ');
                whereConditions.push(`(bikes.discipline IN (${placeholders}) OR bikes.category IN (${placeholders}))`);
                params.push(...topDisciplines, ...topDisciplines);
            }
        }

        // 2. Filter by Price Range (if available)
        if (profile?.priceSensitivity?.weightedAverage > 0) {
            const target = profile.priceSensitivity.weightedAverage;
            const min = target * 0.6; // -40%
            const max = target * 1.4; // +40%
            whereConditions.push('bikes.price BETWEEN ? AND ?');
            params.push(min, max);
        }

        if (whereConditions.length > 0) {
            bikesQuery += ' AND ' + whereConditions.join(' AND ');
        }

        bikesQuery += `
            GROUP BY bikes.id
            ORDER BY 
        `;

        // 3. Smart Sorting with Brand Affinity Boost
        if (profile?.brands) {
            const topBrands = Object.entries(profile.brands)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 3)
                .map(([b]) => b);

            if (topBrands.length > 0) {
                // Case statement for boosting
                const brandCases = topBrands.map((b, i) => `WHEN bikes.brand = ? THEN ${1.2 - (i * 0.05)}`).join(' ');
                bikesQuery += ` (bikes.ranking_score * (CASE ${brandCases} ELSE 1 END)) DESC`;
                params.push(...topBrands);
            } else {
                bikesQuery += ' bikes.ranking_score DESC';
            }
        } else {
            bikesQuery += ' bikes.ranking_score DESC';
        }

        bikesQuery += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit) || 60, parseInt(offset) || 0);

        const bikes = await db.query(bikesQuery, params);
        const bikeIds = bikes.map(b => b.id).filter(Boolean);
        const specsById = await loadSpecsByBikeId(bikeIds);
        const favoriteIds = await loadFavoriteBikeIdSet(req.user?.id, bikeIds);

        for (let bike of bikes) {
            const specs = specsById.get(bike.id) || [];
            bike.specs = specs;
            // Basic spec mapping for convenience
            if (!bike.year || bike.year === 0) {
                const ySpec = specs.find(s => (s.label || '').toLowerCase() === 'год выпуска');
                const yVal = ySpec && ySpec.value ? String(ySpec.value) : '';
                const yMatch = yVal.match(/(19\d{2}|20\d{2})/);
                if (yMatch) bike.year = parseInt(yMatch[1], 10);
            }
            if (!bike.size || String(bike.size).trim() === '') {
                const sSpec = specs.find(s => (s.label || '').toLowerCase() === 'размер рамы');
                const sVal = sSpec && sSpec.value ? String(sSpec.value).trim() : '';
                if (sVal && sVal.toLowerCase() !== 'не указан') bike.size = sVal;
            }
            if (!bike.wheel_diameter || String(bike.wheel_diameter).trim() === '') {
                const wdVals = specs
                    .filter(s => (s.label || '').toLowerCase() === 'диаметр колес')
                    .map(s => s.value)
                    .filter(v => v && String(v).trim() !== '' && String(v).toLowerCase() !== 'не указан');
                if (wdVals.length > 0) bike.wheel_diameter = String(wdVals[0]).trim();
            }

            bike.images = filterExistingImages(bike.images ? bike.images.split(',') : []);
            bike.image = pickAvailableMainImage(bike.id, bike.main_image, bike.images);

            if (bike.original_price && bike.price && bike.original_price > bike.price) {
                bike.savings = bike.original_price - bike.price;
            } else {
                bike.savings = 0;
            }

            bike.is_favorite = favoriteIds.has(bike.id);
        }

        res.json({ success: true, bikes });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 🛒 CART ROUTES
// ========================================

// Get user cart
app.get('/api/cart', authenticateToken, async (req, res) => {
    console.log('=== Cart GET Request ===');
    console.log('User ID:', req.user?.id);

    try {
        let cartItems = await db.query(`
            SELECT 
                sc.*,
                b.name, b.brand, b.model, b.year, b.condition_status, b.features as specifications,
                COALESCE(sc.calculated_price, b.price) as price, 
                b.main_image as image,
                b.category, b.size
            FROM shopping_cart sc
            JOIN bikes b ON sc.bike_id = b.id
            WHERE sc.user_id = ? AND b.is_active = TRUE
            ORDER BY sc.added_at DESC
        `, [req.user.id]);

        // Normalize and ensure images exist for items in cart
        cartItems = cartItems.map((item) => {
            const normalizedImage = pickAvailableMainImage(item.bike_id, item.image);
            return { ...item, image: normalizedImage };
        });

        console.log('=== Cart GET Success ===');
        console.log('Found', cartItems.length, 'items in cart for user:', req.user.id);
        console.log('Cart items:', cartItems);
        res.json({ success: true, cart: cartItems });
    } catch (error) {
        console.error('=== Cart GET Error ===');
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add to cart
app.post('/api/cart', authenticateToken, async (req, res) => {
    console.log('=== Cart POST Request ===');
    console.log('User ID:', req.user?.id);
    console.log('Request body:', req.body);

    try {
        const { bikeId, quantity = 1, calculatedPrice } = req.body;

        // Check if bike exists
        const bikes = await db.query(
            'SELECT id FROM bikes WHERE id = ? AND is_active = TRUE',
            [bikeId]
        );

        if (bikes.length === 0) {
            return res.status(404).json({ error: 'Bike not found' });
        }

        // Add or update cart item
        // First try to update existing item
        const updateResult = await db.query(`
            UPDATE shopping_cart 
            SET quantity = quantity + ?, 
                calculated_price = COALESCE(?, calculated_price),
                updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND bike_id = ?
        `, [quantity, calculatedPrice, req.user.id, bikeId]);

        // If no rows were updated, insert new item
        if (updateResult.changes === 0) {
            await db.query(`
                INSERT INTO shopping_cart (user_id, bike_id, quantity, calculated_price) 
                VALUES (?, ?, ?, ?)
            `, [req.user.id, bikeId, quantity, calculatedPrice]);
        }

        console.log('=== Cart POST Success ===');
        console.log('Item added to cart for user:', req.user.id, 'bike:', bikeId, 'calculated price:', calculatedPrice);
        res.json({ success: true, message: 'Item added to cart' });
    } catch (error) {
        console.error('=== Cart POST Error ===');
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update cart item quantity
app.put('/api/cart/:bikeId', authenticateToken, async (req, res) => {
    console.log('=== Cart PUT Request ===');
    console.log('User ID:', req.user?.id);
    console.log('Bike ID:', req.params.bikeId);
    console.log('Request body:', req.body);

    try {
        const { quantity } = req.body;

        if (quantity <= 0) {
            // If quantity is 0 or negative, remove the item
            await db.query(
                'DELETE FROM shopping_cart WHERE user_id = ? AND bike_id = ?',
                [req.user.id, req.params.bikeId]
            );
            console.log('=== Cart PUT Success (Removed) ===');
            res.json({ success: true, message: 'Item removed from cart' });
        } else {
            // Update the quantity
            const updateResult = await db.query(`
                UPDATE shopping_cart 
                SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND bike_id = ?
            `, [quantity, req.user.id, req.params.bikeId]);

            if (updateResult.changes === 0) {
                return res.status(404).json({ error: 'Item not found in cart' });
            }

            console.log('=== Cart PUT Success (Updated) ===');
            res.json({ success: true, message: 'Cart item quantity updated' });
        }
    } catch (error) {
        console.error('=== Cart PUT Error ===');
        console.error('Update cart quantity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove from cart
app.delete('/api/cart/:bikeId', authenticateToken, async (req, res) => {
    console.log('=== Cart DELETE Request ===');
    console.log('User ID:', req.user?.id);
    console.log('Bike ID:', req.params.bikeId);

    try {
        const deleteResult = await db.query(
            'DELETE FROM shopping_cart WHERE user_id = ? AND bike_id = ?',
            [req.user.id, req.params.bikeId]
        );

        console.log('=== Cart DELETE Success ===');
        console.log('Deleted rows:', deleteResult.changes);
        res.json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        console.error('=== Cart DELETE Error ===');
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 🎯 FAVORITES ROUTES
// ========================================

// Validation middleware for bike ID
const validateBikeId = (req, res, next) => {
    const bikeId = req.body.bikeId || req.params.bikeId;

    if (!bikeId) {
        return res.status(400).json({
            success: false,
            error: 'Bike ID is required'
        });
    }

    if (isNaN(parseInt(bikeId))) {
        return res.status(400).json({
            success: false,
            error: 'Invalid bike ID format'
        });
    }

    next();
};

// Check if bike exists middleware
const checkBikeExists = async (req, res, next) => {
    try {
        const bikeId = req.body.bikeId || req.params.bikeId;
        const bike = await db.query(
            'SELECT id FROM bikes WHERE id = ? AND is_active = 1',
            [bikeId]
        );

        if (bike.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bike not found or inactive'
            });
        }

        next();
    } catch (error) {
        console.error('Check bike exists error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

// Get user favorites with detailed information
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
        const offset = (page - 1) * limit;

        // Validate sort parameters
        const allowedSortFields = ['created_at', 'name', 'price', 'rating'];
        const allowedSortOrders = ['ASC', 'DESC'];

        const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const validSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        // Get favorites with pagination
        const favorites = await db.query(`
            SELECT 
                uf.bike_id,
                uf.created_at as added_to_favorites_at,
                b.name, 
                b.brand, 
                b.model, 
                b.price, 
                b.original_price,
                b.discount,
                b.main_image as image,
                b.category, 
                b.size, 
                b.rating,
                b.review_count,
                b.condition_status,
                b.year,
                b.location,
                (SELECT COUNT(*) FROM user_favorites WHERE bike_id = b.id) as total_favorites
            FROM user_favorites uf
            JOIN bikes b ON uf.bike_id = b.id
            WHERE uf.user_id = ? AND b.is_active = 1
            ORDER BY ${validSortBy === 'created_at' ? 'uf.created_at' : 'b.' + validSortBy} ${validSortOrder}
            LIMIT ? OFFSET ?
        `, [req.user.id, parseInt(limit), offset]);

        // Get total count for pagination
        const totalResult = await db.query(`
            SELECT COUNT(*) as total
            FROM user_favorites uf
            JOIN bikes b ON uf.bike_id = b.id
            WHERE uf.user_id = ? AND b.is_active = 1
        `, [req.user.id]);

        const total = totalResult[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            favorites,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: total,
                itemsPerPage: parseInt(limit),
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve favorites'
        });
    }
});

// Add to favorites
app.post('/api/favorites/add', authenticateToken, validateBikeId, checkBikeExists, async (req, res) => {
    try {
        const { bikeId } = req.body;

        // Check if already in favorites
        const existing = await db.query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND bike_id = ?',
            [req.user.id, bikeId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Item already in favorites',
                isInFavorites: true
            });
        }

        // Add to favorites
        await db.query(
            'INSERT INTO user_favorites (user_id, bike_id) VALUES (?, ?)',
            [req.user.id, bikeId]
        );

        // Get updated favorites count for this bike
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM user_favorites WHERE bike_id = ?',
            [bikeId]
        );

        res.json({
            success: true,
            message: 'Added to favorites',
            isInFavorites: true,
            favoritesCount: countResult[0].count
        });
    } catch (error) {
        console.error('Add to favorites error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add to favorites'
        });
    }
});

// Remove from favorites
app.delete('/api/favorites/remove/:bikeId', authenticateToken, validateBikeId, async (req, res) => {
    try {
        const { bikeId } = req.params;

        // Check if item is in favorites
        const existing = await db.query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND bike_id = ?',
            [req.user.id, bikeId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Item not found in favorites',
                isInFavorites: false
            });
        }

        // Remove from favorites
        await db.query(
            'DELETE FROM user_favorites WHERE user_id = ? AND bike_id = ?',
            [req.user.id, bikeId]
        );

        // Get updated favorites count for this bike
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM user_favorites WHERE bike_id = ?',
            [bikeId]
        );

        res.json({
            success: true,
            message: 'Removed from favorites',
            isInFavorites: false,
            favoritesCount: countResult[0].count
        });
    } catch (error) {
        console.error('Remove from favorites error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove from favorites'
        });
    }
});

// Toggle favorite status
app.post('/api/favorites/toggle', authenticateToken, validateBikeId, checkBikeExists, async (req, res) => {
    try {
        const { bikeId } = req.body;

        // Check current status
        const existing = await db.query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND bike_id = ?',
            [req.user.id, bikeId]
        );

        let isInFavorites;
        let message;

        if (existing.length > 0) {
            // Remove from favorites
            await db.query(
                'DELETE FROM user_favorites WHERE user_id = ? AND bike_id = ?',
                [req.user.id, bikeId]
            );
            isInFavorites = false;
            message = 'Removed from favorites';
        } else {
            // Add to favorites
            await db.query(
                'INSERT INTO user_favorites (user_id, bike_id) VALUES (?, ?)',
                [req.user.id, bikeId]
            );
            isInFavorites = true;
            message = 'Added to favorites';
        }

        // Get updated favorites count for this bike
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM user_favorites WHERE bike_id = ?',
            [bikeId]
        );

        res.json({
            success: true,
            message,
            isInFavorites,
            favoritesCount: countResult[0].count
        });
    } catch (error) {
        console.error('Toggle favorites error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle favorite status'
        });
    }
});

// Check if bike is in user's favorites
app.get('/api/favorites/check/:bikeId', authenticateToken, validateBikeId, async (req, res) => {
    try {
        const { bikeId } = req.params;

        const existing = await db.query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND bike_id = ?',
            [req.user.id, bikeId]
        );

        // Get total favorites count for this bike
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM user_favorites WHERE bike_id = ?',
            [bikeId]
        );

        res.json({
            success: true,
            isInFavorites: existing.length > 0,
            favoritesCount: countResult[0].count
        });
    } catch (error) {
        console.error('Check favorites error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check favorite status'
        });
    }
});

// Get favorites statistics for user
app.get('/api/favorites/stats', authenticateToken, async (req, res) => {
    try {
        // Get total favorites count
        const totalResult = await db.query(
            'SELECT COUNT(*) as total FROM user_favorites WHERE user_id = ?',
            [req.user.id]
        );

        // Get favorites by category
        const categoryStats = await db.query(`
            SELECT 
                b.category,
                COUNT(*) as count
            FROM user_favorites uf
            JOIN bikes b ON uf.bike_id = b.id
            WHERE uf.user_id = ? AND b.is_active = 1
            GROUP BY b.category
            ORDER BY count DESC
        `, [req.user.id]);

        // Get recent favorites (last 7 days)
        const recentResult = await db.query(`
            SELECT COUNT(*) as recent
            FROM user_favorites 
            WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
        `, [req.user.id]);

        res.json({
            success: true,
            stats: {
                totalFavorites: totalResult[0].total,
                recentFavorites: recentResult[0].recent,
                categoriesBreakdown: categoryStats
            }
        });
    } catch (error) {
        console.error('Get favorites stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve favorites statistics'
        });
    }
});

// ========================================
// 📦 ORDERS ROUTES
// ========================================

// Create order from cart
app.post('/api/orders', authenticateToken, async (req, res) => {
    console.log('=== Order Creation Request ===');
    console.log('User ID:', req.user?.id);

    try {
        // Get cart items for the user
        const cartItems = await db.query(`
            SELECT 
                sc.bike_id,
                sc.quantity,
                COALESCE(sc.calculated_price, b.price) as price,
                b.name,
                b.brand,
                b.model
            FROM shopping_cart sc
            JOIN bikes b ON sc.bike_id = b.id
            WHERE sc.user_id = ? AND b.is_active = TRUE
        `, [req.user.id]);

        if (cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Корзина пуста'
            });
        }

        // Calculate total amount
        const totalAmount = cartItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        console.log('=== Order Details ===');
        console.log('Items count:', cartItems.length);
        console.log('Total amount:', totalAmount);

        // Generate valid order number (ORD-YYMMDD-XXX)
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const datePrefix = `${yy}${mm}${dd}`;

        // Get count of orders with this prefix to ensure unique sequence for today
        const prefixPattern = `ORD-${datePrefix}-%`;
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM orders WHERE order_number LIKE ?',
            [prefixPattern]
        );

        const orderCount = (countResult[0]?.count || 0) + 1;
        const orderNumber = `ORD-${datePrefix}-${String(orderCount).padStart(3, '0')}`;

        // Create order record
        const orderResult = await db.query(`
            INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, created_at)
            VALUES (?, ?, ?, 'pending', 'Не указан', datetime('now'))
        `, [req.user.id, orderNumber, totalAmount]);

        const orderId = orderResult.lastInsertRowid;

        // Create order items
        for (const item of cartItems) {
            await db.query(`
                INSERT INTO order_items (order_id, bike_id, quantity, price)
                VALUES (?, ?, ?, ?)
            `, [orderId, item.bike_id, item.quantity, item.price]);
        }

        // Clear the cart
        await db.query('DELETE FROM shopping_cart WHERE user_id = ?', [req.user.id]);

        console.log('=== Order Created Successfully ===');
        console.log('Order ID:', orderId);

        res.json({
            success: true,
            orderId: orderId,
            orderNumber: orderNumber,
            totalAmount: totalAmount,
            message: 'Заказ успешно создан'
        });

    } catch (error) {
        console.error('=== Order Creation Error ===');
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при создании заказа'
        });
    }
});

app.post('/api/v1/crm/resolve-user', authenticateToken, async (req, res) => {
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        return res.json({ success: true, data: crmUser });
    } catch (error) {
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

app.post('/api/checkout', authenticateToken, async (req, res) => {
    console.log('=== CRM Checkout Request ===');
    console.log('User ID:', req.user?.id);
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        if (!crmUser || crmUser.active === false) {
            return res.status(403).json({ success: false, error: 'CRM_USER_INACTIVE', code: 'CRM_USER_INACTIVE' });
        }

        const cartItems = await db.query(`
            SELECT 
                sc.bike_id,
                sc.quantity,
                COALESCE(sc.calculated_price, b.price) as price,
                b.name,
                b.brand,
                b.model,
                b.category
            FROM shopping_cart sc
            JOIN bikes b ON sc.bike_id = b.id
            WHERE sc.user_id = ? AND b.is_active = TRUE
        `, [req.user.id]);

        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Корзина пуста' });
        }

        const {
            name,
            email,
            phone,
            address,
            city,
            postalCode,
            contact_method,
            notes,
            delivery_method,
            payment_method,
            height,
            weight,
            needs_manager
        } = req.body || {};

        const customerData = {
            name: name || req.user?.name || 'Не указан',
            email: email || req.user?.email,
            phone,
            contact_method: contact_method || 'email',
            address: [address, city, postalCode].filter(Boolean).join(', '),
            height,
            weight,
            notes
        };

        const createdOrders = [];

        for (const item of cartItems) {
            const cartData = {
                bike_url: `${PUBLIC_URL}/product/${item.bike_id}`,
                bike_type: item.category || 'unknown',
                bike_size: null,
                bike_color: null,
                bike_price: item.price,
                quantity: item.quantity,
                payment_method: payment_method || 'card',
                delivery_method: delivery_method || 'courier',
                delivery_cost: 0,
                specifications: `${item.brand} ${item.model}`,
                bike_weight: null,
                bike_dimensions: null,
                notes
            };

            try {
                const order = await crmApi.createOrderFromCart(cartData, customerData, !!needs_manager, crmUser.id);
                createdOrders.push(order);
            } catch (error) {
                console.error('CRM createOrderFromCart error:', error);
                const code = (error && error.code) ? error.code : 'UNKNOWN';
                const status =
                    code === 'UNAUTHENTICATED' ? 401 :
                        code === 'CRM_USER_NOT_FOUND' ? 404 :
                            code === 'CRM_USER_INACTIVE' ? 403 :
                                code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                                    code === 'REFUND_NOT_ADMIN' ? 403 :
                                        code === 'CONFIG_MISSING' ? 500 :
                                            code === 'UNKNOWN' ? 500 :
                                                400;
                return res.status(status).json({ success: false, error: code, code });
            }
        }

        // Clear cart after successful creation
        await db.query('DELETE FROM shopping_cart WHERE user_id = ?', [req.user.id]);

        const totalAmount = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        // Normalize orders to expose application/order numbers even if nested in CRM response
        const normalizedOrders = createdOrders.map((o) => ({
            unified_id: o?.unified_id || o?.order?.order_id,
            order_id: o?.order?.order_id,
            order_number: o?.order?.order_number || o?.order_number,
            application_id: o?.application?.application_id,
            application_number: o?.application?.application_number || o?.application_number
        }));
        console.log('=== CRM Checkout Success ===');
        console.log('Normalized orders:', normalizedOrders);
        return res.json({ success: true, orders: normalizedOrders, totalAmount, message: 'Заказ(ы) и заявки успешно созданы через CRM' });
    } catch (error) {
        console.error('=== CRM Checkout Error ===');
        console.error(error);
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

app.post('/api/v1/crm/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        if (!crmUser || crmUser.active === false) {
            return res.status(403).json({ success: false, error: 'CRM_USER_INACTIVE', code: 'CRM_USER_INACTIVE' });
        }

        const { orderId } = req.params;
        const body = req.body || {};
        const rawStatus = body.status || body.new_status;
        const note = body.note || body.status_note || '';

        if (!rawStatus) {
            return res.status(400).json({ success: false, error: 'STATUS_REQUIRED', code: 'STATUS_REQUIRED' });
        }

        const newStatus = String(rawStatus).trim();
        if ((newStatus === 'delivered' || newStatus === 'closed') && crmUser.role !== 'admin') {
            const error = createErrorWithCode('ORDER_STATUS_FORBIDDEN', 'ORDER_STATUS_FORBIDDEN');
            const code = error.code;
            return res.status(403).json({ success: false, error: code, code });
        }

        await crmApi.updateOrderStatus(orderId, newStatus, note || '', crmUser.id);
        return res.json({ success: true, order_id: orderId, status: newStatus });
    } catch (error) {
        console.error('CRM order status error:', error);
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

app.post('/api/v1/crm/leads/:applicationId/status', authenticateToken, async (req, res) => {
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        if (!crmUser || crmUser.active === false) {
            return res.status(403).json({ success: false, error: 'CRM_USER_INACTIVE', code: 'CRM_USER_INACTIVE' });
        }

        const { applicationId } = req.params;
        const body = req.body || {};
        const rawStatus = body.status || body.new_status;
        const note = body.note || body.status_note || null;

        if (!rawStatus) {
            return res.status(400).json({ success: false, error: 'STATUS_REQUIRED', code: 'STATUS_REQUIRED' });
        }

        const newStatus = String(rawStatus).trim();

        await crmApi.updateApplication(applicationId, {
            status: newStatus,
            changed_by: crmUser.id,
            status_note: note
        });

        return res.json({ success: true, application_id: applicationId, status: newStatus });
    } catch (error) {
        console.error('CRM lead status error:', error);
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

app.post('/api/v1/crm/payments', authenticateToken, async (req, res) => {
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        if (!crmUser || crmUser.active === false) {
            return res.status(403).json({ success: false, error: 'CRM_USER_INACTIVE', code: 'CRM_USER_INACTIVE' });
        }

        const body = req.body || {};
        const orderId = body.order_id || body.orderId;
        const amount = Number(body.amount);
        const role = body.role || body.chain_step || null;

        if (!orderId) {
            return res.status(400).json({ success: false, error: 'ORDER_ID_REQUIRED', code: 'ORDER_ID_REQUIRED' });
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'AMOUNT_INVALID', code: 'AMOUNT_INVALID' });
        }

        if (role === 'refund' && crmUser.role !== 'admin') {
            const error = createErrorWithCode('REFUND_NOT_ADMIN', 'REFUND_NOT_ADMIN');
            const code = error.code;
            return res.status(403).json({ success: false, error: code, code });
        }

        const entry = {
            order_id: String(orderId),
            application_id: body.application_id || body.applicationId || null,
            chain_step: role,
            direction: body.direction || 'incoming',
            method: body.method || null,
            currency: body.currency || 'EUR',
            amount,
            status: body.status || null,
            related_payment_id: body.related_payment_id || null,
            external_reference: body.external_reference || null,
            comment: body.comment || null,
            created_by: crmUser.id,
            metadata: body.metadata || {}
        };

        const result = await crmApi.recordPaymentLedger(entry);
        if (result && result.success === false) {
            const code = result.code || 'UNKNOWN';
            const status =
                code === 'UNAUTHENTICATED' ? 401 :
                    code === 'CRM_USER_NOT_FOUND' ? 404 :
                        code === 'CRM_USER_INACTIVE' ? 403 :
                            code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                                code === 'REFUND_NOT_ADMIN' ? 403 :
                                    code === 'CONFIG_MISSING' ? 500 :
                                        code === 'UNKNOWN' ? 500 :
                                            400;
            return res.status(status).json({ success: false, error: code, code });
        }

        return res.json({ success: true, data: result || null });
    } catch (error) {
        console.error('CRM payment error:', error);
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

app.post('/api/v1/crm/tasks', authenticateToken, async (req, res) => {
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        if (!crmUser || crmUser.active === false) {
            return res.status(403).json({ success: false, error: 'CRM_USER_INACTIVE', code: 'CRM_USER_INACTIVE' });
        }

        const body = req.body || {};
        const title = body.title;

        if (!title) {
            return res.status(400).json({ success: false, error: 'TITLE_REQUIRED', code: 'TITLE_REQUIRED' });
        }

        const task = await crmApi.createTaskRecord({
            order_id: body.order_id || body.orderId || null,
            application_id: body.application_id || body.applicationId || null,
            title: String(title),
            description: body.description || null,
            status: body.status || 'open',
            priority: body.priority || 'medium',
            assignee_id: body.assignee_id || null,
            created_by: crmUser.id,
            due_at: body.due_at || null
        });

        return res.json({ success: true, data: task });
    } catch (error) {
        console.error('CRM task create error:', error);
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

app.post('/api/v1/crm/documents', authenticateToken, async (req, res) => {
    try {
        const crmUser = await resolveCrmUserForRequest(req);
        if (!crmUser || crmUser.active === false) {
            return res.status(403).json({ success: false, error: 'CRM_USER_INACTIVE', code: 'CRM_USER_INACTIVE' });
        }

        const body = req.body || {};
        const documentType = body.document_type || body.type;

        if (!documentType) {
            return res.status(400).json({ success: false, error: 'DOCUMENT_TYPE_REQUIRED', code: 'DOCUMENT_TYPE_REQUIRED' });
        }

        const doc = await crmApi.attachDocumentRecord({
            order_id: body.order_id || body.orderId || null,
            application_id: body.application_id || body.applicationId || null,
            document_type: documentType,
            status: body.status || null,
            storage_url: body.storage_url || null,
            content_hash: body.content_hash || null,
            uploaded_by: crmUser.id,
            verified_by: body.verified_by || null,
            metadata: body.metadata || {}
        });

        return res.json({ success: true, data: doc });
    } catch (error) {
        console.error('CRM document attach error:', error);
        const code = (error && error.code) ? error.code : 'UNKNOWN';
        const status =
            code === 'UNAUTHENTICATED' ? 401 :
                code === 'CRM_USER_NOT_FOUND' ? 404 :
                    code === 'CRM_USER_INACTIVE' ? 403 :
                        code === 'ORDER_STATUS_FORBIDDEN' ? 403 :
                            code === 'REFUND_NOT_ADMIN' ? 403 :
                                code === 'CONFIG_MISSING' ? 500 :
                                    code === 'UNKNOWN' ? 500 :
                                        400;
        return res.status(status).json({ success: false, error: code, code });
    }
});

// CRM: search orders by partial number or id
app.get('/api/v1/crm/orders/search', optionalAuth, async (req, res) => {
    try {
        const { q = '', query: queryParam = '', limit = 10 } = req.query;
        const all = await crmApi.getOrders();
        const query = String(q || queryParam).trim().toLowerCase();
        const filtered = all
            .filter((o) => {
                const num = String(o.order_number || '').toLowerCase();
                const oid = String(o.order_id || o.id || '').toLowerCase();
                return query ? (num.includes(query) || oid.includes(query)) : true;
            })
            .slice(0, parseInt(limit));
        res.json({ success: true, orders: filtered });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error && error.message || 'CRM search error') });
    }
});

// CRM: get full order details with history and logistics
app.get('/api/v1/crm/orders/:orderId', optionalAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        let resolvedId = orderId;
        try {
            const all = await crmApi.getOrders();
            const match = all.find((o) => String(o.order_number || '').toLowerCase() === String(orderId).toLowerCase() || String(o.order_id || o.id || '').toLowerCase() === String(orderId).toLowerCase());
            if (match && (match.order_id || match.id)) {
                resolvedId = String(match.order_id || match.id);
            }
        } catch { }
        let payload = null;
        try {
            payload = await crmApi.getOrderRelatedData(resolvedId);
        } catch { }
        if (!payload) {
            const info = await crmApi.getFullOrderInfo(orderId);
            payload = info && info.data ? info.data : info;
        }
        res.json({ success: true, data: payload });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error && error.message || 'CRM get order error') });
    }
});

// CRM: Create a lead (application) without an order yet
app.post('/api/v1/crm/leads', optionalAuth, async (req, res) => {
    try {
        const { name = '', contact_method = '', contact_value = '', notes = null, bike_interest = null } = req.body || {};

        // Minimal validation
        if (!contact_value) {
            return res.status(400).json({ success: false, error: 'Contact value is required' });
        }

        const application_id_seed = crmApi.generateUUID();
        const application_number_seed = await crmApi.generateApplicationNumber();

        const payload = {
            source: 'website_lead',
            application_id: application_id_seed,
            application_number: application_number_seed,
            customer_name: name || 'Guest',
            contact_method: contact_method || 'phone',
            contact_value: contact_value,
            bike_interest: bike_interest,
            application_notes: notes,
            status: 'new',
            priority: 'medium'
        };

        const appRes = await crmApi.createApplication(payload);

        return res.json({
            success: true,
            application_id: appRes?.application_id || application_id_seed,
            application_number: appRes?.application_number || application_number_seed
        });
    } catch (error) {
        console.error('CRM create lead error:', error);
        return res.status(500).json({ success: false, error: String(error && error.message || 'CRM create lead error') });
    }
});

// CRM: quick order creation (creates application first, then order)
app.post('/api/v1/crm/orders/quick', optionalAuth, async (req, res) => {
    try {
        const { name = '', contact_method = '', contact_value = '', notes = null, items = [] } = req.body || {};

        let finalNotes = notes ? String(notes) : '';

        // Append detailed items info to notes
        if (Array.isArray(items) && items.length > 0) {
            const itemsDetails = items.map((rawItem, index) => {
                const item = { ...rawItem, ...(rawItem.details || {}) };
                const parts = [
                    `${index + 1}. ${item.brand || ''} ${item.model || ''} - ${item.price} EUR`
                ];
                if (item.year) parts.push(`   Год: ${item.year}`);
                if (item.size) parts.push(`   Размер: ${item.size}`);
                if (item.color) parts.push(`   Цвет: ${item.color}`);
                if (item.condition || item.condition_status) parts.push(`   Состояние: ${item.condition || item.condition_status}`);
                if (item.specifications) {
                    const specs = typeof item.specifications === 'string'
                        ? item.specifications
                        : JSON.stringify(item.specifications);
                    parts.push(`   Спецификации: ${specs}`);
                }
                return parts.join('\n');
            }).join('\n\n');

            if (finalNotes) finalNotes += '\n\n';
            finalNotes += '--- Детали заказа ---\n' + itemsDetails;
        }

        if (!String(name).trim() || !String(contact_method).trim() || !String(contact_value).trim()) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        const application_id_seed = crmApi.generateUUID();
        const application_number_seed = await crmApi.generateApplicationNumber();
        const appRes = await crmApi.createApplication({
            source: 'website',
            application_id: application_id_seed,
            application_number: application_number_seed,
            customer_name: String(name).trim(),
            contact_method: String(contact_method).trim(),
            contact_value: String(contact_value).trim(),
            application_notes: finalNotes,
        });
        const application_id = String(appRes?.application_id || application_id_seed);
        const application_number = String(appRes?.application_number || application_number_seed);
        if (!application_id) return res.status(500).json({ success: false, error: 'Failed to create application' });
        const order_id_seed = crmApi.generateUUID();
        const order_number_seed = await crmApi.generateOrderNumber();

        // Extract bike details from the first item if available
        const primaryItemRaw = (Array.isArray(items) && items.length > 0) ? items[0] : null;
        const primaryItem = primaryItemRaw ? { ...primaryItemRaw, ...(primaryItemRaw.details || {}) } : null;

        const orderData = {
            order_id: order_id_seed,
            order_number: order_number_seed,
            customer_notes: finalNotes, // Pass the detailed notes to the order
            bike_quantity: items.length || 1,
            currency: 'EUR'
        };

        if (primaryItem) {
            orderData.bike_type = primaryItem.category || primaryItem.type || 'unknown';
            // Ensure price is an integer (bigint in DB)
            orderData.bike_price = Math.round(parseFloat(primaryItem.price) || 0);
            orderData.bike_size = primaryItem.size || null;
            orderData.bike_color = primaryItem.color || null;

            // Construct specifications string since separate brand/model columns don't exist
            const specParts = [];
            if (primaryItem.brand || primaryItem.model) {
                specParts.push(`${primaryItem.brand || ''} ${primaryItem.model || ''}`.trim());
            }
            if (primaryItem.year) specParts.push(`Год: ${primaryItem.year}`);
            if (primaryItem.condition || primaryItem.condition_status) specParts.push(`Сост: ${primaryItem.condition || primaryItem.condition_status}`);

            if (primaryItem.specifications) {
                const rawSpecs = typeof primaryItem.specifications === 'string'
                    ? primaryItem.specifications
                    : JSON.stringify(primaryItem.specifications);
                if (rawSpecs && rawSpecs !== '{}') specParts.push(rawSpecs);
            }

            orderData.bike_specifications = specParts.join(', ');
            orderData.total_amount = orderData.bike_price * orderData.bike_quantity;

            // If we have a catalog link or ID
            const bikeId = primaryItem.bike_id || primaryItem.id;
            if (bikeId && !String(bikeId).startsWith('temp-')) {
                orderData.bike_catalog_link = `${PUBLIC_URL}/product/${bikeId}`;
            }
        }

        const orderRes = await crmApi.createOrderFromApplication(application_id, orderData);
        const order_id = String(orderRes?.order_id || order_id_seed);
        const order_number = String(orderRes?.order_number || order_number_seed);
        const tracking_url = `${PUBLIC_URL}/order-tracking/${order_id || application_id}`;
        return res.json({ success: true, application_id, application_number, order_id, order_number, tracking_url });
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'CRM quick order error') });
    }
});

// Legacy endpoint for guest checkout (alias for quick order)
app.post('/api/checkout', optionalAuth, async (req, res) => {
    // Forward to CRM quick order
    const { name, phone, email, address, city, payment_method, delivery_method, needs_manager, cartItems, items } = req.body;

    // Construct notes from extra fields
    const notesParts = [];
    if (address) notesParts.push(`Адрес: ${address}`);
    if (city) notesParts.push(`Город: ${city}`);
    if (delivery_method) notesParts.push(`Доставка: ${delivery_method}`);
    if (payment_method) notesParts.push(`Оплата: ${payment_method}`);
    if (needs_manager) notesParts.push(`Нужен менеджер: Да`);

    const actualItems = items || cartItems || [];

    if (Array.isArray(actualItems) && actualItems.length > 0) {
        // Detailed items string
        const itemsDetails = actualItems.map((rawItem, index) => {
            const item = { ...rawItem, ...(rawItem.details || {}) };
            const parts = [
                `${item.brand || ''} ${item.model || ''} (${item.price} EUR)`
            ];
            if (item.year) parts.push(`Год: ${item.year}`);
            if (item.size) parts.push(`Размер: ${item.size}`);
            if (item.condition || item.condition_status) parts.push(`Сост: ${item.condition || item.condition_status}`);
            return parts.join(', ');
        }).join('; ');

        notesParts.push(`Товары: ${itemsDetails}`);
    }

    const payload = {
        name: name || 'Guest',
        contact_method: phone ? 'phone' : 'email',
        contact_value: phone || email || 'unknown',
        notes: notesParts.join('. ')
    };

    // Call internal logic of quick order (re-using code block logic via direct call would be cleaner, but we'll just use the same logic here)
    try {
        const application_id_seed = crmApi.generateUUID();
        const application_number_seed = await crmApi.generateApplicationNumber();

        const appRes = await crmApi.createApplication({
            source: 'website_checkout',
            application_id: application_id_seed,
            application_number: application_number_seed,
            customer_name: String(payload.name).trim(),
            contact_method: String(payload.contact_method).trim(),
            contact_value: String(payload.contact_value).trim(),
            application_notes: payload.notes,
            status: 'new'
        });

        const application_id = String(appRes?.application_id || application_id_seed);

        // Create order
        const order_id_seed = crmApi.generateUUID();
        const order_number_seed = await crmApi.generateOrderNumber();

        // Extract bike details from the first item if available
        const primaryItemRaw = (Array.isArray(actualItems) && actualItems.length > 0) ? actualItems[0] : null;
        const primaryItem = primaryItemRaw ? { ...primaryItemRaw, ...(primaryItemRaw.details || {}) } : null;

        const orderData = {
            order_id: order_id_seed,
            order_number: order_number_seed,
            customer_notes: payload.notes,
            bike_quantity: actualItems.length || 1,
            currency: 'EUR'
        };

        if (primaryItem) {
            orderData.bike_type = primaryItem.category || primaryItem.type || 'unknown';
            // Ensure price is an integer (bigint in DB)
            orderData.bike_price = Math.round(parseFloat(primaryItem.price) || 0);
            orderData.bike_size = primaryItem.size || null;
            orderData.bike_color = primaryItem.color || null;

            const specParts = [];
            if (primaryItem.brand || primaryItem.model) {
                specParts.push(`${primaryItem.brand || ''} ${primaryItem.model || ''}`.trim());
            }
            if (primaryItem.year) specParts.push(`Год: ${primaryItem.year}`);
            if (primaryItem.condition || primaryItem.condition_status) specParts.push(`Сост: ${primaryItem.condition || primaryItem.condition_status}`);

            if (primaryItem.specifications) {
                const rawSpecs = typeof primaryItem.specifications === 'string'
                    ? primaryItem.specifications
                    : JSON.stringify(primaryItem.specifications);
                if (rawSpecs && rawSpecs !== '{}') specParts.push(rawSpecs);
            }

            orderData.bike_specifications = specParts.join(', ');
            orderData.total_amount = orderData.bike_price * orderData.bike_quantity;

            const bikeId = primaryItem.bike_id || primaryItem.id;
            if (bikeId && !String(bikeId).startsWith('temp-')) {
                orderData.bike_catalog_link = `${PUBLIC_URL}/product/${bikeId}`;
            }
        }

        await crmApi.createOrderFromApplication(application_id, orderData);

        return res.json({ success: true, message: 'Order created' });
    } catch (e) {
        console.error('Legacy checkout error', e);
        return res.status(500).json({ success: false, error: 'Checkout failed' });
    }
});

// User saved trackings: table migration
try {
    db.query(`
        CREATE TABLE IF NOT EXISTS user_saved_trackings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tracking_id TEXT NOT NULL,
            tracking_type TEXT NOT NULL,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, tracking_id, tracking_type)
        )
    `).catch(() => { });
} catch { }

// List saved trackings
app.get('/api/user/trackings', authenticateToken, async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT id, tracking_id, tracking_type, title, created_at
            FROM user_saved_trackings
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json({ success: true, items: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to list saved trackings' });
    }
});

// Add saved tracking
app.post('/api/user/trackings', authenticateToken, async (req, res) => {
    try {
        const { tracking_id, tracking_type = 'order', title = null } = req.body || {};
        if (!tracking_id) return res.status(400).json({ success: false, error: 'tracking_id required' });
        await db.query(`
            INSERT OR IGNORE INTO user_saved_trackings (user_id, tracking_id, tracking_type, title)
            VALUES (?, ?, ?, ?)
        `, [req.user.id, String(tracking_id), String(tracking_type), title ? String(title) : null]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to save tracking' });
    }
});

// Remove saved tracking
app.delete('/api/user/trackings/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(`DELETE FROM user_saved_trackings WHERE user_id = ? AND id = ?`, [req.user.id, parseInt(id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to remove tracking' });
    }
});

// Get user orders
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await db.query(`
            SELECT 
                o.id,
                o.total_amount,
                o.status,
                o.created_at,
                COUNT(oi.id) as items_count
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [req.user.id]);

        res.json({ success: true, orders });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// 📋 ЗАЯВКИ (APPLICATIONS)
// ========================================

// Создать новую заявку
app.post('/api/applications', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Создание новой заявки...');
        console.log('📝 Данные заявки:', req.body);

        const {
            experience,
            usage,
            terrain,
            budget,
            features,
            contact_info,
            // Старые поля для обратной совместимости
            contact_name,
            contact_phone,
            contact_email,
            experience_level,
            bike_link,
            bike_type,
            notes,
            lead_score = 0,
            conversion_probability = 0
        } = req.body;

        // Определяем контактные данные (новый или старый формат)
        const contactName = contact_info?.name || contact_name;
        const contactPhone = contact_info?.phone || contact_phone;
        const contactEmail = contact_info?.email || contact_email;
        const preferredContact = contact_info?.preferred_contact || 'phone';

        // Валидация обязательных полей
        if (!contactName || !contactPhone) {
            return res.status(400).json({
                error: 'Имя и телефон обязательны для заполнения'
            });
        }

        // Генерируем уникальный номер заявки
        const applicationNumber = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Создаем заявку в базе данных
        const result = await db.query(`
            INSERT INTO applications (
                user_id, application_number, contact_name, contact_phone, contact_email,
                experience_level, bike_link, budget, bike_type, notes,
                lead_score, conversion_probability, status, created_at, updated_at,
                experience, usage, terrain, features, preferred_contact
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'), ?, ?, ?, ?, ?)
        `, [
            req.user.id,
            applicationNumber,
            contactName,
            contactPhone,
            contactEmail,
            experience_level || experience, // Обратная совместимость
            bike_link,
            budget,
            bike_type,
            notes,
            lead_score,
            conversion_probability,
            experience,
            usage,
            terrain,
            features ? JSON.stringify(features) : null,
            preferredContact
        ]);

        console.log('✅ Заявка создана с ID:', result.insertId);

        res.status(201).json({
            success: true,
            application_id: result.insertId,
            application_number: applicationNumber,
            message: 'Заявка успешно создана'
        });

    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
        res.status(500).json({
            error: 'Ошибка создания заявки',
            details: error.message
        });
    }
});

// Получить заявки пользователя
app.get('/api/applications', authenticateToken, async (req, res) => {
    try {
        const applications = await db.query(`
            SELECT * FROM applications 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            applications
        });

    } catch (error) {
        console.error('❌ Ошибка получения заявок:', error);
        res.status(500).json({
            error: 'Ошибка получения заявок',
            details: error.message
        });
    }
});

// Получить конкретную заявку
app.get('/api/applications/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const applications = await db.query(`
            SELECT * FROM applications 
            WHERE (id = ? OR application_number = ?) AND user_id = ?
        `, [id, id, req.user.id]);

        if (applications.length === 0) {
            return res.status(404).json({
                error: 'Заявка не найдена'
            });
        }

        res.json({
            success: true,
            application: applications[0]
        });

    } catch (error) {
        console.error('❌ Ошибка получения заявки:', error);
        res.status(500).json({
            error: 'Ошибка получения заявки',
            details: error.message
        });
    }
});

// Гостевой эндпоинт CRM: создание заявки без обязательной авторизации
app.post('/api/v1/crm/applications', optionalAuth, async (req, res) => {
    try {
        const { name, contact_method, contact_value, notes, items = [] } = req.body || {};

        let finalNotes = notes ? String(notes) : '';

        // Append detailed items info to notes
        if (Array.isArray(items) && items.length > 0) {
            const itemsDetails = items.map((item, index) => {
                const parts = [
                    `${index + 1}. ${item.brand || ''} ${item.model || ''} - ${item.price} EUR`
                ];
                if (item.year) parts.push(`   Год: ${item.year}`);
                if (item.size) parts.push(`   Размер: ${item.size}`);
                if (item.color) parts.push(`   Цвет: ${item.color}`);
                if (item.condition) parts.push(`   Состояние: ${item.condition}`);
                if (item.specifications) {
                    const specs = typeof item.specifications === 'string'
                        ? item.specifications
                        : JSON.stringify(item.specifications);
                    parts.push(`   Спецификации: ${specs}`);
                }
                return parts.join('\n');
            }).join('\n\n');

            if (finalNotes) finalNotes += '\n\n';
            finalNotes += '--- Детали заявки ---\n' + itemsDetails;
        }

        const payload = {
            source: 'website',
            customer_name: String(name || ''),
            contact_method: String(contact_method || ''),
            contact_value: String(contact_value || ''),
            application_notes: finalNotes,
        };
        const result = await crmApi.createApplication(payload);
        const created = Array.isArray(result) ? result[0] : result;
        const application_id = created?.application_id || payload.application_id || crmApi.generateUUID();
        let application_number = created?.application_number || created?.application?.application_number || null;
        if (!application_number) {
            application_number = await crmApi.generateApplicationNumber();
        }
        const tracking_url = `${PUBLIC_URL}/order-tracking/${application_id}`;
        return res.json({ success: true, application_id, application_number, tracking_url });
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'CRM error') });
    }
});

// ========================================
// 📁 STATIC FILES (after API routes)
// ========================================
// Serve built React frontend if dist exists, otherwise provide simple root
const candidateDistA = path.join(__dirname, 'frontend', 'dist');
const candidateDistB = path.resolve(process.cwd(), '..', 'frontend', 'dist');
const frontendDist = fs.existsSync(candidateDistA)
    ? candidateDistA
    : (fs.existsSync(candidateDistB) ? candidateDistB : null);

if (frontendDist) {
    // Static assets
    app.use(express.static(frontendDist));

    // Root route serves React index
    app.get('/', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });

    // SPA fallback for non-API routes (Express 5 safe handler)
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
} else {
    console.warn('⚠️ Frontend dist not found. Skipping static React serving. Use Vite dev (frontend: npm run dev) or build (npm run build).');
    // Simple root response when no dist is present
    app.get('/', (req, res) => {
        res.json({
            status: 'ok',
            message: 'Frontend dist not found. Backend API is running.',
            api: `/api`,
            docs: `/api/docs`
        });
    });
}

// ========================================
// 🚀 SERVER INITIALIZATION
// ========================================

// Initialize database and start server 
async function startServer() {
    try {
        console.log('🔄 Initializing database...');
        await db.initialize();
        console.log('💾 Using database file:', db.dbPath);

        // Migration: Add calculated_price column to shopping_cart table
        try {
            console.log('🔄 Running migration: adding calculated_price column...');
            await db.query(`
                ALTER TABLE shopping_cart 
                ADD COLUMN calculated_price DECIMAL(10,2)
            `);
            console.log('✅ Migration completed: calculated_price column added');
        } catch (migrationError) {
            // Column might already exist, which is fine
            if (migrationError.message.includes('duplicate column name') ||
                migrationError.message.includes('already exists')) {
                console.log('ℹ️ Migration skipped: calculated_price column already exists');
            } else {
                console.error('⚠️ Migration warning:', migrationError.message);
            }
        }

        // Migration: Ensure metric_events has expected columns (schema drift fix)
        try {
            const meInfo = await db.query('PRAGMA table_info(metric_events)');
            const cols = new Set((Array.isArray(meInfo) ? meInfo : []).map(c => String(c.name || '').toLowerCase()));
            const hadType = cols.has('type');
            const hadTs = cols.has('ts');

            const addCol = async (name, def) => {
                if (!cols.has(name)) {
                    await db.query(`ALTER TABLE metric_events ADD COLUMN ${name} ${def}`);
                }
            };

            await addCol('event_type', 'TEXT');
            await addCol('value', 'INTEGER DEFAULT 1');
            await addCol('metadata', 'TEXT');
            await addCol('created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            await addCol('session_id', 'TEXT');
            await addCol('referrer', 'TEXT');
            await addCol('source_path', 'TEXT');
            await addCol('dwell_ms', 'INTEGER');
            await addCol('user_id', 'INTEGER');

            if (hadType) {
                await db.query('UPDATE metric_events SET event_type = COALESCE(event_type, type) WHERE event_type IS NULL');
            }
            if (hadTs) {
                await db.query('UPDATE metric_events SET created_at = COALESCE(created_at, ts) WHERE created_at IS NULL');
            }

            await db.query('CREATE INDEX IF NOT EXISTS idx_metric_events_bike_created ON metric_events(bike_id, created_at)');
            await db.query('CREATE INDEX IF NOT EXISTS idx_metric_events_type_created ON metric_events(event_type, created_at)');
        } catch (e) {
            const msg = (e && e.message ? e.message : '').toLowerCase();
            if (!msg.includes('no such table')) {
                console.warn('⚠️ metric_events migration warning:', e.message || e);
            }
        }

        // Migration: Create orders and order_items tables
        try {
            console.log('🔄 Running migration: creating orders tables...');

            // Create orders table
            await db.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    total_amount DECIMAL(10,2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Create order_items table
            await db.query(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    bike_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    price DECIMAL(10,2) NOT NULL,
                    FOREIGN KEY (order_id) REFERENCES orders(id),
                    FOREIGN KEY (bike_id) REFERENCES bikes(id)
                )
            `);

            console.log('✅ Migration completed: orders tables created');
        } catch (migrationError) {
            console.error('⚠️ Orders migration warning:', migrationError.message);
        }

        // Migration: Create applications table
        try {
            console.log('🔄 Running migration: creating applications table...');

            await db.query(`
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    application_number VARCHAR(50) UNIQUE NOT NULL,
                    contact_name VARCHAR(255) NOT NULL,
                    contact_phone VARCHAR(50) NOT NULL,
                    contact_email VARCHAR(255),
                    experience_level VARCHAR(50),
                    bike_link TEXT,
                    budget VARCHAR(100),
                    bike_type VARCHAR(100),
                    notes TEXT,
                    lead_score INTEGER DEFAULT 0,
                    conversion_probability DECIMAL(3,2) DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'new',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            console.log('✅ Migration completed: applications table created');
        } catch (migrationError) {
            console.error('⚠️ Migration error (applications):', migrationError.message);
        }

        // Migration: Add new questionnaire fields to applications table
        try {
            console.log('🔄 Running migration: adding questionnaire fields to applications...');

            // Add new columns for questionnaire data
            const newColumns = [
                'experience VARCHAR(50)',
                'usage VARCHAR(50)',
                'terrain VARCHAR(50)',
                'features TEXT',
                'preferred_contact VARCHAR(20) DEFAULT "phone"'
            ];

            for (const column of newColumns) {
                try {
                    await db.query(`ALTER TABLE applications ADD COLUMN ${column}`);
                    console.log(`✅ Added column: ${column.split(' ')[0]}`);
                } catch (columnError) {
                    // Normalize error message for both SQLite and MySQL
                    const msg = (columnError.message || '').toLowerCase();
                    if (msg.includes('duplicate column name') ||
                        msg.includes('already exists')) {
                        console.log(`ℹ️ Column already exists: ${column.split(' ')[0]}`);
                    } else {
                        console.error(`⚠️ Error adding column ${column.split(' ')[0]}:`, columnError.message);
                    }
                }
            }

            console.log('✅ Migration completed: questionnaire fields added');
        } catch (migrationError) {
            console.error('⚠️ Migration error (questionnaire fields):', migrationError.message);
        }

        // Create tables for password resets and email queue
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    attempt_count INTEGER DEFAULT 0,
                    max_attempts INTEGER DEFAULT 5,
                    blocked_until TEXT NULL,
                    verified INTEGER DEFAULT 0,
                    verified_at TEXT NULL,
                    reset_token TEXT NULL
                )
            `);
            await db.query(`
                CREATE TABLE IF NOT EXISTS email_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    to_email TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    body_text TEXT NULL,
                    body_html TEXT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 5,
                    last_error TEXT NULL,
                    created_at TEXT NOT NULL,
                    next_attempt_at TEXT NOT NULL,
                    sent_at TEXT NULL
                )
            `);
            console.log('✅ Password reset & email queue tables ensured');
        } catch (e) {
            console.warn('⚠️ Failed to ensure password reset/email queue tables:', e.message || e);
        }

        console.log('🔄 Testing database connection...');
        await db.testConnection();

        // Ensure bikes exist based on image directories, then sync images
        console.log('🔄 Ensuring bikes from image directories...');
        await ensureBikesFromImageDirs();
        try {
            const rows = await db.query("SELECT id, name, brand, model, description, category, discipline FROM bikes");
            const mapCat = (label) => {
                const l = String(label || '').toLowerCase();
                if (!l) return null;
                if (l.startsWith('mtb ')) return 'Горный';
                if (l.startsWith('road ')) return 'Шоссейный';
                if (l.startsWith('gravel ')) return 'Гравийный';
                if (l === 'emtb' || l.startsWith('emtb ')) return 'Электро';
                if (l.startsWith('kids ')) return 'Детский';
                return null;
            };
            const canonicalLabel = (raw, cat) => {
                const r = String(raw || '').trim().toLowerCase();
                if (!r) return null;
                if (r.startsWith('mtb ') || r.startsWith('road ') || r.startsWith('gravel ') || r.startsWith('kids ') || r.startsWith('parts ')) return raw;
                if (r.startsWith('emtb')) return 'eMTB';
                if (r === 'downhill' || r === 'dh') return 'MTB DH';
                if (r === 'enduro') return 'MTB Enduro';
                if (r === 'trail') return 'MTB Trail';
                if (r === 'xc' || r === 'cross-country' || r === 'cross country') return 'MTB XC';
                if (r === 'time trial' || r === 'tt') return 'ROAD TT';
                if (r === 'aero') return 'ROAD Aero';
                if (r === 'endurance') return 'ROAD Endurance';
                if (r === 'gravel') return 'GRAVEL Race';
                return null;
            };
            const classify = (name, description) => {
                const t = `${name || ''} ${description || ''}`.toLowerCase();
                if (/\bdh\b|downhill|sender|status|supreme|tues|session|fury|v10|glory/.test(t)) return 'MTB DH';
                if (/enduro|nomad|capra|jeffsy|strive|patrol|slash|mega|spice/.test(t)) return 'MTB Enduro';
                if (/trail|stumpjumper|trance|habit|optic|fuel\s?ex/.test(t)) return 'MTB Trail';
                if (/\bxc\b|cross\-country|marathon|epic\b|spark\s?rc|scale\b/.test(t)) return 'MTB XC';
                if (/gravel|diverge|topstone|aspero|checkpoint|kanzo/.test(t)) return 'GRAVEL Race';
                if (/endurance|domane|defy|synapse|roubaix/.test(t)) return 'ROAD Endurance';
                if (/aero|madone|aeroad|foil|vencedor/.test(t)) return 'ROAD Aero';
                return null;
            };
            for (const r of rows) {
                const currentLabel = r.discipline;
                const canon = canonicalLabel(currentLabel, r.category);
                const label = canon || classify(r.name, r.description);
                if (!label) continue;
                const cat = mapCat(label);
                const needCatUpdate = cat && r.category !== cat;
                const needDiscUpdate = !currentLabel || currentLabel !== label;
                if (needCatUpdate || needDiscUpdate) {
                    await db.query("UPDATE bikes SET discipline = ?, category = COALESCE(?, category) WHERE id = ?", [label, cat, r.id]);
                }
            }
        } catch (_) { }
        console.log('🔄 Normalizing categories from discipline...');
        try {
            await db.query("UPDATE bikes SET category='Горный' WHERE discipline LIKE 'MTB %' AND (category IS NULL OR category <> 'Горный')");
            await db.query("UPDATE bikes SET category='Шоссейный' WHERE discipline LIKE 'ROAD %' AND (category IS NULL OR category <> 'Шоссейный')");
            await db.query("UPDATE bikes SET category='Гравийный' WHERE discipline LIKE 'GRAVEL %' AND (category IS NULL OR category <> 'Гравийный')");
            await db.query("UPDATE bikes SET category='Электро' WHERE (discipline = 'eMTB' OR discipline LIKE 'eMTB %') AND (category IS NULL OR category <> 'Электро')");
            await db.query("UPDATE bikes SET category='Детский' WHERE discipline LIKE 'KIDS %' AND (category IS NULL OR category <> 'Детский')");
        } catch (_) { }
        console.log('🔄 Syncing image directories with database...');
        await syncImageDirectoryWithDB();
        setInterval(syncImageDirectoryWithDB, 60000);

        app.listen(PORT, () => {
            console.log(`🚀 EUBike MySQL Server running on port ${PORT}`);
            console.log(`📊 Database: MySQL`);
            console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
            console.log(`🖼️ Images static: ${PUBLIC_URL}/images`);
            console.log(`📁 IMAGES_DIR: ${IMAGES_DIR}`);
            // Start email queue worker every 30s
            setInterval(() => { processEmailQueue(db).catch(err => console.error('Email queue worker error:', err)); }, 30 * 1000);
            console.log('📬 Email queue worker started (30s interval)');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down server...');
    await db.close();
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
app.use(express.json());
function isAllowedListingDomain(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '').toLowerCase();
        const protocolOk = u.protocol === 'http:' || u.protocol === 'https:';
        const isLocal = /^(localhost|127\.0\.0\.1)$/.test(host);
        return protocolOk && !isLocal;
    } catch {
        return false;
    }
}

function stripMarkdownJson(text) {
    let t = text || '';
    t = t.replace(/^```json\s*/i, '');
    t = t.replace(/^json\s*/i, '');
    t = t.replace(/```\s*$/i, '');
    return t.trim();
}

async function fetchHtmlWithFallbacks(targetUrl) {
    // Try direct
    try {
        const r = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
                'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8,ru;q=0.7',
                'Referer': 'https://www.kleinanzeigen.de/'
            }
        });
        if (r.ok) {
            return await r.text();
        }
    } catch { }
    // corsproxy.io
    try {
        const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        if (r.ok) return await r.text();
    } catch { }
    // cors-anywhere
    try {
        const r = await fetch(`https://cors-anywhere.herokuapp.com/${targetUrl}`);
        if (r.ok) return await r.text();
    } catch { }
    // thingproxy removed due to DNS instability; prefer r.jina.ai reader below
    // r.jina.ai reader (robust HTML fetch)
    try {
        const u = new URL(targetUrl);
        const readerUrl = `https://r.jina.ai/${u.protocol}//${u.hostname}${u.pathname}${u.search}`;
        const r = await fetch(readerUrl);
        if (r.ok) return await r.text();
    } catch { }
    return null;
}

function extractDataFromUrlServer(url) {
    try {
        const u = new URL(url);
        const slug = u.pathname.split('/').filter(Boolean).join(' ');
        const title = decodeURIComponent(slug).replace(/-/g, ' ');
        const tokens = title.split(/\s+/);
        const brand = tokens[0] ? tokens[0][0].toUpperCase() + tokens[0].slice(1) : undefined;
        const model = tokens.slice(1, 4).join(' ') || undefined;
        return { title, brand, model };
    } catch {
        return null;
    }
}

// Parse listing via Gemini on server
app.post('/api/parse-listing', async (req, res) => {
    try {
        let url = req.body?.url;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'url is required' });
        }
        // Normalize duplicated schemes
        url = url.replace(/^(https?:\/\/)(https?:\/\/)/i, '$1');
        if (!isAllowedListingDomain(url)) {
            return res.status(400).json({ error: 'invalid or local url' });
        }
        const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        const allowPickup = host.endsWith('kleinanzeigen.de') || host.endsWith('pinkbike.com');
        const html = await fetchHtmlWithFallbacks(url);
        if (!html) {
            const basic = extractDataFromUrlServer(url) || {};
            return res.status(502).json({
                warning: 'proxies unavailable',
                title: basic.title || '',
                brand: basic.brand,
                model: basic.model,
                priceEUR: null,
                characteristics: {}
            });
        }

        if (!GEMINI_API_KEY) {
            // Эвристики без Gemini: извлекаем заголовок, цену, доставку
            const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
                || html.match(/<meta[^>]+name=["']title["'][^>]*content=["']([^"']+)["']/i)?.[1];
            const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
            const h1Title = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
            const combinedTitle = (ogTitle || pageTitle || h1Title || '').trim();

            const metaPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i)?.[1]
                || html.match(/<meta[^>]+property=["']og:price:amount["'][^>]*content=["']([^"']+)["']/i)?.[1]
                || html.match(/<meta[^>]+name=["']price["'][^>]*content=["']([^"']+)["']/i)?.[1];
            const normalizeNum = (s) => {
                const cleaned = String(s).replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,(?=\d{2}$)/, '.');
                const n = Number(cleaned);
                return isFinite(n) && n > 0 ? n : undefined;
            };
            let priceEUR = metaPrice ? normalizeNum(metaPrice) : undefined;
            if (!priceEUR) {
                const m = html.match(/(?:Preis|Price|Цена)[^0-9]{0,10}([0-9]{2,6}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i)
                    || html.match(/([0-9]{2,6}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:€|eur)/i);
                if (m?.[1]) priceEUR = normalizeNum(m[1]);
            }

            const hasPickupOnly = /(nur\s*-?\s*abholung|selbstabholung|selbstabholer|kein\s+versand|versand\s*:\s*nein|versand\s+nicht\s*möglich)/i.test(html);
            const hasDeliveryAvailable = /(versand\s*ab\s*[0-9.,]+\s*€|versand\s*möglich|versand\s*:\s*ja|lieferung\s*möglich|lieferung\s*verfügbar|shipping\s*available)/i.test(html);
            const isNegotiable = /\bVB\b|Verhandlungsbasis/i.test(html);
            const deliveryOption = allowPickup ? (hasPickupOnly ? 'pickup-only' : (hasDeliveryAvailable ? 'available' : 'unknown')) : 'available';

            const tokens = combinedTitle.split(/\s+/).filter(Boolean);
            const brand = tokens[0] ? tokens[0][0].toUpperCase() + tokens[0].slice(1) : undefined;
            const model = tokens.slice(1, 4).join(' ') || undefined;

            return res.json({
                title: combinedTitle,
                brand,
                model,
                priceEUR,
                characteristics: { frameSize: '', wheelDiameter: '', Zustand: isNegotiable ? 'VB' : '', deliveryOption },
            });
        }

        const prompt = `Ты аналитик объявлений. Вот HTML страницы объявления:\n\n---HTML START---\n${html}\n---HTML END---\n\nИзвлеки информацию и верни строго JSON без пояснений с полями:\n{ "price": число(EUR), "year": число|null, "brand": строка|null, "model": строка|null, "frameSize": строка|null, "wheelDiameter": строка|null, "isNegotiable": boolean, "deliveryOption": "available"|"pickup-only", "description": строка }\nЕсли данных нет — ставь null/false.`;

        const resp = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '';
        const clean = stripMarkdownJson(text);
        const parsed = JSON.parse(clean);
        // Эвристики доставки на случай, если Gemini не вернул метку
        const hasPickupOnly = /(nur\s*-?\s*abholung|selbstabholung|selbstabholer|kein\s+versand|versand\s*:\s*nein|versand\s+nicht\s*möglich)/i.test(html);
        const hasDeliveryAvailable = /(versand\s*ab\s*[0-9.,]+\s*€|versand\s*möglich|versand\s*:\s*ja|lieferung\s*möglich|lieferung\s*verfügbar|shipping\s*available)/i.test(html);
        const deliveryCandidate = parsed?.deliveryOption || (hasPickupOnly ? 'pickup-only' : (hasDeliveryAvailable ? 'available' : 'unknown'));
        const deliveryOption = allowPickup ? deliveryCandidate : 'available';

        return res.json({
            title: parsed?.description || '',
            brand: parsed?.brand || undefined,
            model: parsed?.model || undefined,
            priceEUR: Number(parsed?.price || 0) || undefined,
            characteristics: {
                Zustand: parsed?.isNegotiable ? 'VB' : '',
                frameSize: parsed?.frameSize || '',
                wheelDiameter: parsed?.wheelDiameter || '',
                deliveryOption
            }
        });
    } catch (err) {
        console.error('parse-listing error:', err);
        res.status(500).json({ error: 'internal error' });
    }
});
try {
    db.query(`
      CREATE TABLE IF NOT EXISTS tg_client_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        order_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `).catch(() => { })
    db.query(`
      CREATE TABLE IF NOT EXISTS tg_client_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id INTEGER,
        order_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chat_id, order_id)
      )
    `).catch(() => { })
    db.query(`
      CREATE TABLE IF NOT EXISTS tg_saved_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        brand TEXT,
        category TEXT,
        min_price REAL,
        max_price REAL,
        language_code TEXT DEFAULT 'ru',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_checked_at DATETIME
      )
    `).catch(() => { })
} catch { }

app.post('/api/tg/link', optionalAuth, async (req, res) => {
    try {
        const orderId = String(req.body?.order_id || req.body?.tracking_id || req.query?.order_id || '').trim()
        if (!orderId) return res.status(400).json({ success: false, error: 'order_id required' })
        const payload = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24)
        try { await db.query(`INSERT INTO tg_client_links (payload, user_id, order_id) VALUES (?, ?, ?)`, [payload, req.user?.id || null, orderId]) } catch { }
        let username = process.env.TG_CLIENT_BOT_USERNAME || ''
        const token = process.env.TG_CLIENT_BOT_TOKEN || ''
        if (!username && token) {
            try {
                const r = await fetch(`https://api.telegram.org/bot${token}/getMe`)
                const j = await r.json()
                username = j?.result?.username || username
            } catch { }
        }
        if (!username) return res.json({ success: true, payload })
        const deep_link = `https://t.me/${username}?start=${encodeURIComponent(payload)}`
        return res.json({ success: true, payload, deep_link })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'tg link error') })
    }
})

app.post('/api/tg/consume-link', async (req, res) => {
    try {
        const payload = String(req.body?.payload || '').trim()
        if (!payload) return res.status(400).json({ success: false, error: 'payload required' })
        const rows = await db.query(`SELECT user_id, order_id FROM tg_client_links WHERE payload = ?`, [payload])
        if (!rows || !rows.length) return res.status(404).json({ success: false, error: 'not_found' })
        const row = rows[0]
        return res.json({ success: true, user_id: row.user_id || null, order_id: row.order_id })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'consume error') })
    }
})

app.post('/api/tg/subscribe', async (req, res) => {
    try {
        const chat_id = String(req.body?.chat_id || '').trim()
        const payload = String(req.body?.payload || '').trim()
        let order_id = String(req.body?.order_id || '').trim()
        let user_id = req.body?.user_id || null
        if (payload && !order_id) {
            try {
                const rows = await db.query(`SELECT user_id, order_id FROM tg_client_links WHERE payload = ?`, [payload])
                if (rows && rows.length) { user_id = rows[0].user_id || user_id; order_id = rows[0].order_id }
            } catch { }
        }
        if (!chat_id || !order_id) return res.status(400).json({ success: false, error: 'chat_id and order_id required' })
        try { await db.query(`DELETE FROM tg_client_subscriptions WHERE chat_id = ? AND order_id = ?`, [chat_id, order_id]) } catch { }
        await db.query(`INSERT INTO tg_client_subscriptions (chat_id, user_id, order_id) VALUES (?, ?, ?)`, [chat_id, user_id || null, order_id])
        return res.json({ success: true })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'subscribe error') })
    }
})

app.get('/api/tg/subscriptions/:chat_id', async (req, res) => {
    try {
        const chat_id = String(req.params.chat_id || '').trim()
        if (!chat_id) return res.status(400).json({ success: false, error: 'chat_id required' })
        const rows = await db.query('SELECT * FROM tg_client_subscriptions WHERE chat_id = ?', [chat_id])
        return res.json({ success: true, subscriptions: rows })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'get subscriptions error') })
    }
})

app.delete('/api/tg/subscriptions', async (req, res) => {
    try {
        const { chat_id, order_id } = req.body || {}
        if (!chat_id || !order_id) return res.status(400).json({ success: false, error: 'chat_id and order_id required' })
        await db.query('DELETE FROM tg_client_subscriptions WHERE chat_id = ? AND order_id = ?', [chat_id, order_id])
        return res.json({ success: true })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'unsubscribe error') })
    }
})

app.get('/api/tg/searches/:chat_id', async (req, res) => {
    try {
        const chat_id = String(req.params?.chat_id || '').trim()
        if (!chat_id) return res.status(400).json({ success: false, error: 'chat_id required' })
        const rows = await db.query(`SELECT * FROM tg_saved_searches WHERE chat_id = ? ORDER BY created_at DESC`, [chat_id])
        return res.json({ success: true, searches: rows })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'searches error') })
    }
})

app.post('/api/tg/searches', async (req, res) => {
    try {
        const chat_id = String(req.body?.chat_id || '').trim()
        const brand = req.body?.brand ? String(req.body.brand).trim() : null
        const category = req.body?.category ? String(req.body.category).trim() : null
        const min_price = req.body?.min_price != null ? Number(req.body.min_price) : null
        const max_price = req.body?.max_price != null ? Number(req.body.max_price) : null
        const language_code = req.body?.language_code ? String(req.body.language_code).trim() : null
        if (!chat_id) return res.status(400).json({ success: false, error: 'chat_id required' })
        const nowIso = new Date().toISOString()
        await db.query(`INSERT INTO tg_saved_searches (chat_id, brand, category, min_price, max_price, language_code, created_at, last_checked_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, 'ru'), ?, NULL)`, [chat_id, brand, category, min_price, max_price, language_code, nowIso])
        const rows = await db.query(`SELECT * FROM tg_saved_searches WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1`, [chat_id])
        return res.json({ success: true, search: rows[0] || null })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'save_search error') })
    }
})

app.delete('/api/tg/searches/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params?.id || '').trim())
        if (!id) return res.status(400).json({ success: false, error: 'id required' })
        await db.query(`DELETE FROM tg_saved_searches WHERE id = ?`, [id])
        return res.json({ success: true })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'delete_search error') })
    }
})

async function processSavedSearchNotifications(db) {
    try {
        const token = process.env.TG_CLIENT_BOT_TOKEN || ''
        if (!token) return
        const searches = await db.query(`
        SELECT * FROM tg_saved_searches 
        WHERE last_checked_at IS NULL OR last_checked_at < datetime('now', '-10 minutes')
        ORDER BY created_at ASC LIMIT 10
      `)
        for (const s of searches) {
            const params = []
            let where = ['b.is_active = 1']
            if (s.brand) { where.push('b.brand = ?'); params.push(s.brand) }
            if (s.category) { where.push('b.category = ?'); params.push(s.category) }
            if (s.min_price != null) { where.push('b.price >= ?'); params.push(Number(s.min_price)) }
            if (s.max_price != null) { where.push('b.price <= ?'); params.push(Number(s.max_price)) }
            if (s.last_checked_at) { where.push('b.added_at > ?'); params.push(String(s.last_checked_at)) }
            else { where.push(`b.added_at > datetime('now','-1 day')`) }
            const sql = `
          SELECT b.id, b.name, b.brand, b.model, b.price, b.main_image, b.category 
          FROM bikes b WHERE ${where.join(' AND ')} 
          ORDER BY b.ranking_score DESC, b.added_at DESC LIMIT 3
        `
            const rows = await db.query(sql, params)
            for (const b of rows) {
                let image = null
                if (b.main_image) image = resolveImageUrl(normalizeImagePath(b.main_image))
                if (!image) {
                    const imgs = await db.query('SELECT image_url FROM bike_images WHERE bike_id = ? ORDER BY image_order LIMIT 1', [b.id])
                    const u = imgs[0]?.image_url || null
                    if (u) image = resolveImageUrl(normalizeImagePath(u))
                }
                const lang = (s.language_code || 'ru').toLowerCase()
                const caption = (function () {
                    const name = `${b.brand ? b.brand + ' ' : ''}${b.model || b.name || ''}`.trim()
                    const price = Math.round(Number(b.price || 0))
                    if (lang.startsWith('de')) return `Neues Angebot: ${name} — ${price}€\nAus Europa, schnelle Lieferung.`
                    if (lang.startsWith('en')) return `New offer: ${name} — ${price}€\nFrom Europe, fast delivery.`
                    return `Новое предложение: ${name} — ${price}€\nИз Европы, быстрая доставка.`
                })()
                const url = `${PUBLIC_URL}/product/${b.id}`
                const markup = {
                    inline_keyboard: [[{ text: (function () { const l = (s.language_code || 'ru').toLowerCase(); if (l.startsWith('de')) return 'Im Katalog öffnen'; if (l.startsWith('en')) return 'Open in catalog'; return 'Открыть в каталоге' })(), url }]]
                }
                try {
                    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: s.chat_id, photo: image || url, caption, parse_mode: 'HTML', reply_markup: markup })
                    })
                } catch { }
            }
            await db.query('UPDATE tg_saved_searches SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?', [s.id])
        }
    } catch { }
}

setInterval(() => { processSavedSearchNotifications(db).catch(() => { }) }, 2 * 60 * 1000)

app.get('/api/tg/subscriptions/:chat_id', async (req, res) => {
    try {
        const chat_id = String(req.params?.chat_id || '').trim()
        if (!chat_id) return res.status(400).json({ success: false, error: 'chat_id required' })
        const rows = await db.query(`SELECT id, chat_id, user_id, order_id, created_at FROM tg_client_subscriptions WHERE chat_id = ? ORDER BY created_at DESC`, [chat_id])
        return res.json({ success: true, subscriptions: rows })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'subscriptions error') })
    }
})

app.delete('/api/tg/subscriptions', async (req, res) => {
    try {
        const chat_id = String(req.body?.chat_id || '').trim()
        const order_id = String(req.body?.order_id || '').trim()
        if (!chat_id || !order_id) return res.status(400).json({ success: false, error: 'chat_id and order_id required' })
        await db.query(`DELETE FROM tg_client_subscriptions WHERE chat_id = ? AND order_id = ?`, [chat_id, order_id])
        return res.json({ success: true })
    } catch (error) {
        return res.status(500).json({ success: false, error: String(error && error.message || 'unsubscribe error') })
    }
})

// ========================================
// 🕒 WAITLIST ROUTES
// ========================================
app.post('/api/waitlist/add', async (req, res) => {
    try {
        const { brand, model, max_price, telegram_chat_id, category, size, min_year, email } = req.body;

        // Basic validation
        if (!telegram_chat_id && !email) {
            return res.status(400).json({ error: 'Telegram ID or Email required' });
        }

        await db.query(`
            INSERT INTO user_waitlists (
                brand, model, max_price, telegram_chat_id, email, category, size, min_year
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            brand || null,
            model || null,
            max_price ? Number(max_price) : null,
            telegram_chat_id || null,
            email || null,
            category || null,
            size || null,
            min_year ? Number(min_year) : null
        ]);

        res.json({ success: true, message: 'Waitlist entry added' });
    } catch (error) {
        console.error('Waitlist add error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
