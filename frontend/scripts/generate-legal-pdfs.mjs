import http from 'node:http';
import { mkdir, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const PREFERRED_PORT = Number.parseInt(process.env.LEGAL_PDF_PORT || '4173', 10);
const OVERRIDE_BASE_URL = process.env.LEGAL_PDF_BASE_URL || null;

async function loadLegalDocsVersion() {
  const p = path.resolve(process.cwd(), 'src', 'lib', 'legal.ts');
  const text = await readFile(p, 'utf8');
  const match = text.match(/export const LEGAL_DOCS_VERSION\s*=\s*'([^']+)'/);
  if (!match) throw new Error('Cannot find LEGAL_DOCS_VERSION in src/lib/legal.ts');
  return match[1];
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForOk(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (true) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timeout waiting for server: ${url}`);
    }
    await sleep(300);
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.ttf') return 'font/ttf';
  return 'application/octet-stream';
}

async function startSpaServer(distDir) {
  const resolvedDist = path.resolve(distDir);
  const indexPath = path.join(resolvedDist, 'index.html');

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname || '/');

      const normalized = pathname === '/' ? '/index.html' : pathname;
      const candidate = path.resolve(resolvedDist, `.${normalized}`);

      // Prevent path traversal.
      if (!candidate.startsWith(resolvedDist)) {
        res.statusCode = 400;
        res.end('Bad Request');
        return;
      }

      try {
        const body = await readFile(candidate);
        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeFor(candidate));
        res.end(body);
        return;
      } catch {
        const body = await readFile(indexPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(body);
      }
    } catch {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const listen = (port) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  try {
    await listen(PREFERRED_PORT);
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      await listen(0);
    } else {
      throw err;
    }
  }

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : PREFERRED_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function main() {
  const version = await loadLegalDocsVersion();
  const docs = [
    { route: '/legal/terms', out: `BikeWerk_Public_Offer_Terms_${version}.pdf` },
    { route: '/legal/privacy', out: `BikeWerk_Privacy_Policy_${version}.pdf` },
    { route: '/legal/consent', out: `BikeWerk_PD_Consent_${version}.pdf` },
    { route: '/legal/cookies', out: `BikeWerk_Cookie_Policy_${version}.pdf` },
    { route: '/legal/imprint', out: `BikeWerk_Imprint_${version}.pdf` },
    { route: '/legal/refunds', out: `BikeWerk_Cancellations_Refunds_${version}.pdf` },
    { route: '/legal/sanctions', out: `BikeWerk_Sanctions_Compliance_${version}.pdf` },
  ];

  const distPath = path.resolve(process.cwd(), 'dist');
  try {
    await access(distPath);
  } catch {
    throw new Error('Missing frontend/dist. Run `npm run build` in frontend first.');
  }

  const outDir = path.resolve(process.cwd(), 'public', 'legal');
  await mkdir(outDir, { recursive: true });

  const baseUrl = OVERRIDE_BASE_URL || null;
  const server = baseUrl ? null : await startSpaServer(distPath);
  const effectiveBaseUrl = baseUrl || server.baseUrl;

  try {
    await waitForOk(`${effectiveBaseUrl}/`, 10_000);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    for (const doc of docs) {
      const url = `${effectiveBaseUrl}${doc.route}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('main h1', { timeout: 15_000 });

      const outPath = path.join(outDir, doc.out);
      await page.pdf({
        path: outPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
      });
      console.log(`PDF written: ${path.relative(process.cwd(), outPath)}`);
    }

    await browser.close();
  } finally {
    if (server) await server.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
