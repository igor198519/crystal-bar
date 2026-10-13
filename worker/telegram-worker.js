// Crystal Bar: пересилає заявки з сайту в Telegram.
// У налаштуваннях Cloudflare Worker потрібно додати дві змінні:
//   BOT_TOKEN — токен бота від @BotFather (тип Secret)
//   CHAT_ID   — ваш числовий ID у Telegram
const ALLOWED_ORIGIN = 'https://igor198519.github.io';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    let d;
    try { d = await request.json(); } catch { return new Response('Bad request', { status: 400, headers: cors }); }

    // Пастка для спам-ботів: справжні люди це поле не заповнюють.
    if (d.website) return new Response('ok', { headers: cors });

    const clip = (v, n = 200) => String(v ?? '').trim().slice(0, n);
    if (clip(d.phone).replace(/\D/g, '').length < 9) {
      return new Response('Phone required', { status: 400, headers: cors });
    }

    const text = [
      '🥂 Нова заявка з сайту Crystal Bar',
      '',
      'Послуга: ' + clip(d.service),
      'Дата: ' + clip(d.date),
      'Гостей: ' + clip(d.guests),
      'Тематика: ' + clip(d.theme),
      'Локація: ' + clip(d.place),
      "Ім'я: " + (clip(d.name) || 'не вказано'),
      'Телефон: ' + clip(d.phone),
    ].join('\n');

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text }),
    });
    return new Response(tg.ok ? 'ok' : 'error', { status: tg.ok ? 200 : 502, headers: cors });
  },
};
