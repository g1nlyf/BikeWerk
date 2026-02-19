const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const telegramHub = require('../backend/src/services/TelegramHubService');

async function main() {
    process.env.TELEGRAM_HUB_POLLING_ROLES = 'manager';
    await telegramHub.start({ pollingRoles: ['manager'] });
    console.log('[manager-bot] TelegramHub manager polling is running');
}

main().catch((error) => {
    console.error('[manager-bot] Failed to start:', error?.message || error);
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
