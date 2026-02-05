const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

function fileToDataUri(p) {
  const buf = fs.readFileSync(p);
  const b64 = buf.toString('base64');
  return `data:image/jpeg;base64,${b64}`;
}

function buildPrompt(url) {
  return [
    'Ты помощник маркетплейса. По скриншотам страницы Kleinanzeigen определи, доступно ли объявление или оно удалено/скрыто.',
    '- Если на странице виден текст "Gelöscht" (в заголовке, оверлей на фото, серый слой) — это удалённое объявление.',
    '- Если кнопки взаимодействия (например, "Nachricht schreiben") недоступны И виден явный маркер удаления — считай удалено.',
    '- Если требуется вход/авторизация без явного признака удаления — статус "requires_login".',
    '- Если есть явный контент объявления (цена, описание, фото без серого оверлея, заголовок без "Gelöscht") — статус "available".',
    `URL: ${url}`,
    'Верни ТОЛЬКО JSON вида: {"success":true,"status":"available|removed|requires_login|unknown","confidence":0.0..1.0,"signals":{"geloscht":bool,"priceVisible":bool,"messageButtonEnabled":bool,"overlaySeen":bool},"reason":"кратко"}',
  ].join('\n');
}

async function evaluateListingStatus(slicePaths, url) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GROQ_API_KEY не настроен' };
  }
  const client = new Groq({ apiKey });

  const prompt = buildPrompt(url);
  const content = [{ type: 'text', text: prompt }];
  for (const p of slicePaths.slice(0, 6)) { // ограничим до 6 картинок
    const uri = fileToDataUri(p);
    content.push({ type: 'input_image', image_url: uri });
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.2-11b-vision',
      messages: [{ role: 'user', content }],
      temperature: 0.2,
    });

    const text = completion?.choices?.[0]?.message?.content || '';
    // Попытка распарсить JSON
    let data = null;
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        data = JSON.parse(text.slice(start, end + 1));
      }
    } catch (_) {}

    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Groq вернул неожиданный ответ', raw: text };
    }
    return { ...data, success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { evaluateListingStatus };