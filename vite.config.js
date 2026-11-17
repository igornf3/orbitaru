import { defineConfig } from 'vite';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FEEDBACK_DIR = join(dirname(fileURLToPath(import.meta.url)), 'feedback');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'feedback.jsonl');
const MAX_BODY_LENGTH = 10 * 1024;
const MAX_TEXT_LENGTH = 2000;
const MAX_CONTACT_LENGTH = 120;
const ADMIN_KEY = process.env.FEEDBACK_ADMIN_KEY || '';

const BOT_UA = /bot|crawler|spider|scraper|slurp|curl|wget|httpclient|python|urllib|java|okhttp|go-http|libwww|perl|ruby|php|headless|phantom|selenium|puppeteer|playwright|lighthouse|pingdom|uptime|monitor/i;

const denyPage = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Доступ запрещён</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #05070b; color: #e7edf3; font-family: system-ui, sans-serif; }
      h1 { margin: 0; font-size: 54px; letter-spacing: 0.08em; }
      p { margin: 0; color: #7d8999; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>403</h1>
    <p>Автоматическим клиентам доступ запрещён.</p>
  </body>
</html>`;

const isBot = (request) => BOT_UA.test(request.headers['user-agent'] || '');

const deny = (response) => {
  response.statusCode = 403;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(denyPage);
};

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sanitizeField = (value, limit) => escapeHtml(
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, limit)
);

const json = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

async function feedbackHandler(request, response) {
  if (isBot(request)) return deny(response);
  if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'method_not_allowed' });

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > MAX_BODY_LENGTH) return json(response, 413, { ok: false, error: 'payload_too_large' });
  }

  try {
    const data = JSON.parse(body || '{}');
    if (data.hp) return deny(response);
    const text = sanitizeField(data.text, MAX_TEXT_LENGTH);
    if (!text) return json(response, 400, { ok: false, error: 'empty_text' });
    const record = {
      date: new Date().toISOString(),
      contact: sanitizeField(data.contact, MAX_CONTACT_LENGTH),
      text
    };
    await mkdir(FEEDBACK_DIR, { recursive: true });
    await appendFile(FEEDBACK_FILE, `${JSON.stringify(record)}\n`, 'utf8');
    return json(response, 200, { ok: true });
  } catch {
    return json(response, 400, { ok: false, error: 'bad_request' });
  }
}

async function feedbackAdminHandler(request, response) {
  if (isBot(request)) return deny(response);
  if (request.method !== 'GET') return json(response, 405, { ok: false, error: 'method_not_allowed' });
  const url = new URL(request.url, 'http://localhost');
  if (ADMIN_KEY && url.searchParams.get('key') !== ADMIN_KEY) return deny(response);

  let entries = [];
  try {
    const raw = await readFile(FEEDBACK_FILE, 'utf8');
    entries = raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch { /* файла ещё нет — отзывов не поступало */ }

  const rows = entries.map((entry) => {
    const date = new Date(entry.date).toLocaleString('ru-RU');
    const contact = entry.contact || 'Аноним';
    return `<article class="entry"><header><strong>${contact}</strong><time>${date}</time></header><p>${entry.text}</p></article>`;
  }).join('');

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Отзывы · Орбита</title>
    <style>
      body { margin: 0; min-height: 100vh; padding: 48px 20px; box-sizing: border-box; background: #05070b; color: #e7edf3; font-family: system-ui, sans-serif; }
      main { max-width: 720px; margin: 0 auto; }
      h1 { margin: 0 0 6px; font-size: 26px; font-weight: 600; }
      .count { color: #7d8999; font-size: 13px; margin-bottom: 28px; }
      .entry { margin-bottom: 14px; padding: 16px 18px; border: 1px solid rgba(255,255,255,0.085); border-radius: 12px; background: rgba(7,11,18,0.79); }
      .entry header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 13px; }
      .entry strong { color: #c8f978; }
      .entry time { color: #7d8999; font-size: 12px; }
      .entry p { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
      .empty { padding: 48px 0; color: #7d8999; text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <h1>Отзывы</h1>
      <div class="count">${entries.length} ${entries.length === 1 ? 'запись' : entries.length < 5 && entries.length ? 'записи' : 'записей'}</div>
      ${rows || '<div class="empty">Отзывов пока нет.</div>'}
    </main>
  </body>
</html>`);
}

function botPageFilter(request, response, next) {
  const accept = String(request.headers.accept || '');
  if (isBot(request) && (accept.includes('text/html') || request.url === '/')) return deny(response);
  next();
}

function feedbackPlugin() {
  const attach = (server) => {
    server.middlewares.use(botPageFilter);
    server.middlewares.use('/api/feedback', feedbackHandler);
    server.middlewares.use('/admin/feedback', feedbackAdminHandler);
  };
  return {
    name: 'orbita-feedback',
    configureServer: attach,
    configurePreviewServer: attach
  };
}

export default defineConfig({
  plugins: [feedbackPlugin()]
});
