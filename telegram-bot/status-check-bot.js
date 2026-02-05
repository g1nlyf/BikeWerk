// Telegram bot to test Kleinanzeigen listing status (removed/available/etc.)
// Sends full structured debug (JSON + raw HTML + screenshot) to all subscribers

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { checkKleinanzeigenStatus, DEFAULT_OPTS } = require('./status-checker');
const GroqStatus = require('./groq-status');

// Token: provided via env STATUS_BOT_TOKEN
const TOKEN = process.env.STATUS_BOT_TOKEN || '';

const DATA_DIR = path.resolve(__dirname);
const SUBSCRIBERS_PATH = path.join(DATA_DIR, 'subscribers.json');
const DEBUG_DIR = path.join(DATA_DIR, 'debug');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DEBUG_DIR);

function loadSubscribers() {
  try {
    if (!fs.existsSync(SUBSCRIBERS_PATH)) return [];
    const raw = fs.readFileSync(SUBSCRIBERS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

async function saveSubscribers(subs) {
  await fsp.writeFile(SUBSCRIBERS_PATH, JSON.stringify(subs, null, 2));
}

function addSubscriber(chatId) {
  const subs = loadSubscribers();
  if (!subs.includes(chatId)) {
    subs.push(chatId);
    fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(subs, null, 2));
  }
}

async function broadcast(bot, payload) {
  const subs = loadSubscribers();
  for (const chatId of subs) {
    try {
      if (payload.text) await bot.sendMessage(chatId, payload.text, { parse_mode: 'Markdown' });
      if (payload.photo) await bot.sendPhoto(chatId, payload.photo, payload.photoOptions || {});
      if (payload.document) await bot.sendDocument(chatId, payload.document, payload.documentOptions || {});
    } catch (err) {
      console.error('Broadcast error', err);
    }
  }
}

function extractLinks(text) {
  if (!text) return [];
  const re = /(https?:\/\/[^\s]+)/g;
  const links = text.match(re) || [];
  // Focus on Kleinanzeigen
  return links.filter((u) => /kleinanzeigen\.de\//i.test(u));
}

if (!TOKEN) {
  console.error('❌ STATUS_BOT_TOKEN is not configured.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  addSubscriber(chatId);
  const welcome = [
    'Привет! Я бот для тестирования объявлений Kleinanzeigen.',
    'Отправь ссылку объявления (или несколько), и я проверю, удалено оно или доступно.',
    'Я отправлю отладочные данные (JSON, HTML, скриншот) всем пользователям бота.',
  ].join('\n');
  await bot.sendMessage(chatId, welcome);
});

bot.onText(/^\/help$/, async (msg) => {
  const chatId = msg.chat.id;
  const text = [
    'Команды:',
    '- Отправь одну или несколько ссылок Kleinanzeigen для проверки.',
    '- /help — помощь.',
    '- /start — подписаться на рассылку результатов.',
  ].join('\n');
  await bot.sendMessage(chatId, text);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';
  if (!text) return;
  const links = extractLinks(text);
  if (links.length === 0) return;

  addSubscriber(chatId);

  for (const url of links) {
    await bot.sendMessage(chatId, `Проверяю объявление:\n${url}`);
    const report = await checkKleinanzeigenStatus(url, { headless: false, postLoadDelayMs: 5000 });

    // Write debug files: JSON + raw HTML
    const ts = Date.now();
    const baseName = `debug_${ts}`;
    const jsonPath = path.join(DEBUG_DIR, `${baseName}.json`);
    const htmlPath = path.join(DEBUG_DIR, `${baseName}.html`);
    const jsonPayload = JSON.stringify(report, null, 2);
    await fsp.writeFile(jsonPath, jsonPayload);
    if (report.network?.rawHtml) {
      await fsp.writeFile(htmlPath, report.network.rawHtml);
    }

    // Оценка статуса через Groq Vision на основе нарезанных скринов
    let groqEval = null;
    try {
      if (report.slices && report.slices.length > 0) {
        groqEval = await GroqStatus.evaluateListingStatus(report.slices, url);
      }
    } catch (e) {
      groqEval = { success: false, error: e.message };
    }

    const caption = [
      `Статус: ${report.status}`,
      `Доверие: ${(report.confidence * 100).toFixed(0)}%`,
      groqEval?.success ? `Groq: ${groqEval.status} (${Math.round((groqEval.confidence || 0) * 100)}%)` : undefined,
      report.error ? `Ошибка: ${report.error}` : undefined,
      groqEval?.error ? `Groq ошибка: ${groqEval.error}` : undefined,
    ].filter(Boolean).join('\n');

    // Reply to requester
    try {
      const photoPath = report.telegramPhotoPath && fs.existsSync(report.telegramPhotoPath)
        ? report.telegramPhotoPath
        : (report.screenshotPath && fs.existsSync(report.screenshotPath) ? report.screenshotPath : null);
      if (photoPath) {
        try {
          await bot.sendPhoto(chatId, photoPath, { caption });
        } catch (errPhoto) {
          // Фолбэк на документ при ошибке размеров
          await bot.sendDocument(chatId, photoPath, { caption });
        }
      } else {
        await bot.sendMessage(chatId, caption);
      }
      await bot.sendDocument(chatId, jsonPath, { caption: 'Полный JSON-отчёт' });
      if (fs.existsSync(htmlPath)) {
        await bot.sendDocument(chatId, htmlPath, { caption: 'Полный HTML ответа' });
      }
    } catch (err) {
      await bot.sendMessage(chatId, `Ошибка отправки результатов: ${err.message}`);
    }

    // Broadcast to all subscribers (as required: всем пользователям)
    const bText = `Результат проверки объявления:\n${url}\nСтатус: ${report.status}\nДоверие: ${(report.confidence * 100).toFixed(0)}%${groqEval?.success ? `\nGroq: ${groqEval.status} (${Math.round((groqEval.confidence || 0) * 100)}%)` : ''}`;
    await broadcast(bot, { text: bText });
    const bPhoto = report.telegramPhotoPath && fs.existsSync(report.telegramPhotoPath)
      ? report.telegramPhotoPath
      : (report.screenshotPath && fs.existsSync(report.screenshotPath) ? report.screenshotPath : null);
    if (bPhoto) {
      await broadcast(bot, { photo: bPhoto, photoOptions: { caption: 'Скриншот' } });
    }
    await broadcast(bot, { document: jsonPath, documentOptions: { caption: 'JSON-отчёт' } });
    if (fs.existsSync(htmlPath)) {
      await broadcast(bot, { document: htmlPath, documentOptions: { caption: 'HTML' } });
    }
  }
});

console.log('Status-check bot is running with polling.');
