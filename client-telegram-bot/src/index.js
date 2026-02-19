import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const telegramHub = require('../../backend/src/services/TelegramHubService');

async function main() {
  process.env.TELEGRAM_HUB_POLLING_ROLES = 'client';
  await telegramHub.start({ pollingRoles: ['client'] });
  console.log('[client-telegram-bot] TelegramHub client polling is running');
}

main().catch((error) => {
  console.error('[client-telegram-bot] Failed to start:', error?.message || error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await telegramHub.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await telegramHub.stop();
  process.exit(0);
});
