// КРИГА: пересилає замовлення з сайту в Telegram.
// Змінні в налаштуваннях Cloudflare Worker (Settings → Variables and Secrets):
//   BOT_TOKEN        — токен бота від @BotFather (тип Secret)
//   CHAT_ID          — ваш числовий ID у Telegram (або ID групи)
//   ALLOWED_ORIGINS  — необов'язково: адреси сайту через кому,
//                      напр. https://kryha.com.ua,https://www.kryha.com.ua
export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.length ? (allowed.includes(origin) ? origin : allowed[0]) : '*',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (allowed.length && !allowed.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });

    let d;
    try { d = await request.json(); } catch { return new Response('Bad request', { status: 400, headers: cors }); }

    // Пастка для спам-ботів: люди це поле не бачать і не заповнюють.
    if (d.website) return new Response('ok', { headers: cors });

    const clip = (v, n = 200) => String(v ?? '').trim().slice(0, n);
    if (clip(d.phone).replace(/\D/g, '').length < 9) {
      return new Response('Phone required', { status: 400, headers: cors });
    }

    const text = [
      '🕯 Нове замовлення КРИГА',
      '',
      'Товар: ' + clip(d.product),
      'Кількість: ' + clip(d.qty, 5),
      'Підставка: ' + clip(d.stand),
      'Сума: ' + clip(d.total, 12) + ' ₴',
      '',
      "Ім'я: " + clip(d.name),
      'Телефон: ' + clip(d.phone),
      'Місто: ' + clip(d.city),
      'Відділення НП: ' + clip(d.branch),
      'Коментар: ' + (clip(d.comment, 1000) || '—'),
    ].join('\n');

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text }),
    });
    return new Response(tg.ok ? 'ok' : 'error', { status: tg.ok ? 200 : 502, headers: cors });
  },
};
