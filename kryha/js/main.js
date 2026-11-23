// КРИГА — логіка сайту: меню, товари, форма замовлення, анімації.
(function () {
  document.documentElement.classList.add('js');

  const CFG = window.KRYHA_CONFIG || {};
  const PRODUCTS = window.KRYHA_PRODUCTS || [];
  const REVIEWS = window.KRYHA_REVIEWS || [];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) => n.toLocaleString('uk-UA') + ' ₴';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  let io; // спостерігач для анімацій при скролі

  // ---------- Посилання на соцмережі ----------
  $$('[data-link="instagram"]').forEach((a) => (a.href = CFG.instagram || '#'));
  $$('[data-link="telegram"]').forEach((a) => (a.href = CFG.telegram || '#'));
  $$('[data-handle]').forEach((el) => (el.textContent = CFG.instagramHandle || ''));
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  // ---------- Шапка і мобільне меню ----------
  const header = $('.header');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('.burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open);
    });
    $$('.nav a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('nav-open')));
  }

  // ---------- Картки товарів ----------
  const media = (p) =>
    p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)} — прозора гелева свічка ручної роботи КРИГА" loading="lazy">`
      : `<div class="ph" role="img" aria-label="${esc(p.name)}"><span>${esc(p.photoHint || p.name)}</span></div>`;

  const card = (p, i) => {
    const badge = p.oldPrice ? 'Дешевше, ніж окремо' : p.badge;
    const meta = [p.weight, p.burn && 'горить ' + p.burn].filter(Boolean).join(' · ');
    return `
      <article class="card reveal" data-delay="${i % 3}">
        <div class="card__media">
          ${badge ? `<span class="badge ${p.oldPrice ? 'badge--flame' : ''}">${esc(badge)}</span>` : ''}
          ${media(p)}
        </div>
        <div class="card__body">
          <div class="card__title">
            <h3>${esc(p.name)}</h3>
            <span class="price">${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ''}${money(p.price)}</span>
          </div>
          ${meta ? `<div class="card__meta">${esc(meta)}</div>` : '<div class="card__meta"></div>'}
          <p class="card__desc">${esc(p.desc)}</p>
          <button class="btn btn--dark btn--block" type="button" data-order-product="${esc(p.id)}">Замовити</button>
        </div>
      </article>`;
  };

  function renderProducts(el, filter) {
    const list = PRODUCTS.filter((p) =>
      filter === 'featured' ? p.featured : filter === 'all' || !filter ? true : p.cat === filter
    );
    el.innerHTML = list.map(card).join('');
    observe(el);
  }
  $$('[data-products]').forEach((el) => renderProducts(el, el.dataset.products));

  // Фільтри каталогу
  $$('[data-filter]').forEach((chip) =>
    chip.addEventListener('click', () => {
      $$('[data-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
      const grid = $('[data-products]');
      grid.dataset.products = chip.dataset.filter;
      renderProducts(grid, chip.dataset.filter);
    })
  );

  // ---------- Відгуки ----------
  const reviewsEl = $('[data-reviews]');
  if (reviewsEl) {
    if (REVIEWS.length) {
      reviewsEl.innerHTML = `<div class="reviews">${REVIEWS.map(
        (r, i) => `
        <figure class="review reveal" data-delay="${i % 3}">
          ${r.img ? `<img src="${esc(r.img)}" alt="Фото від покупця: ${esc(r.name)}" loading="lazy">` : ''}
          <p>«${esc(r.text)}»</p>
          <cite>${esc(r.name)}</cite>
        </figure>`
      ).join('')}</div>`;
    } else {
      reviewsEl.innerHTML = `
        <div class="reviews-empty reveal">
          <p class="lead" style="color:inherit">Тут з'являться фото наших свічок у ваших домівках.</p>
          <p class="muted">Відзначте <a data-link="instagram" href="${esc(CFG.instagram)}">${esc(CFG.instagramHandle)}</a> у сторіз, коли запалите свою Кригу.</p>
        </div>`;
    }
    observe(reviewsEl);
  }

  // ---------- Форма замовлення ----------
  const orderable = PRODUCTS.filter((p) => p.cat !== 'stands');
  const stands = PRODUCTS.filter((p) => p.cat === 'stands');

  const formHTML = `
    <form class="form" novalidate>
      <div class="form__row">
        <label class="field"><span>Ім'я</span><input name="name" autocomplete="given-name" required></label>
        <label class="field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+380" required></label>
      </div>
      <div class="form__row">
        <label class="field"><span>Що замовляєте</span>
          <select name="product">${PRODUCTS.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Кількість</span>
          <select name="qty">${Array.from({ length: 10 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select>
        </label>
      </div>
      <label class="field"><span>Додай підставку</span>
        <select name="stand">
          <option value="">Без підставки</option>
          ${stands.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} + ${money(s.price)}</option>`).join('')}
        </select>
      </label>
      <div class="form__row">
        <label class="field"><span>Місто</span><input name="city" autocomplete="address-level2" required></label>
        <label class="field"><span>Відділення Нової Пошти</span><input name="branch" placeholder="№ або адреса" required></label>
      </div>
      <label class="field"><span>Коментар</span><textarea name="comment" placeholder="Текст для листівки, побажання, зручний месенджер"></textarea></label>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form__total"><span>Разом</span><strong data-total>0 ₴</strong></div>
      <button class="btn btn--flame btn--block" type="submit">Надіслати заявку</button>
      <p class="form__hint">Відправляємо в день замовлення. Ми зв'яжемося з вами, щоб підтвердити.</p>
      <div class="form__msg" role="status" aria-live="polite"></div>
    </form>`;

  $$('[data-order]').forEach((host) => {
    host.innerHTML = formHTML;
    const form = $('form', host);
    const total = () => {
      const p = byId(form.product.value);
      const s = byId(form.stand.value);
      const qty = +form.qty.value || 1;
      const sum = (p ? p.price : 0) * qty + (s ? s.price : 0);
      $('[data-total]', form).textContent = money(sum);
      return sum;
    };
    form.addEventListener('change', total);

    // Якщо прийшли з кнопки «Замовити» на іншій сторінці
    const fromUrl = new URLSearchParams(location.search).get('p');
    if (fromUrl && byId(fromUrl)) form.product.value = fromUrl;
    else if (orderable[0]) form.product.value = (orderable.find((p) => p.badge) || orderable[0]).id;
    total();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('.form__msg', form);
      msg.className = 'form__msg';
      const btn = $('button[type="submit"]', form);

      const required = ['name', 'phone', 'city', 'branch'];
      const empty = required.find((n) => !form[n].value.trim());
      if (empty || form.phone.value.replace(/\D/g, '').length < 9) {
        msg.textContent = 'Заповніть, будь ласка, ім\'я, телефон, місто та відділення.';
        msg.classList.add('is-err');
        (form[empty] || form.phone).focus();
        return;
      }

      const p = byId(form.product.value);
      const s = byId(form.stand.value);
      const data = {
        name: form.name.value, phone: form.phone.value,
        product: p ? p.name : '', qty: form.qty.value,
        stand: s ? s.name : 'без підставки',
        total: total(), city: form.city.value, branch: form.branch.value,
        comment: form.comment.value, website: form.website.value,
      };

      const fallback = `Не вдалося надіслати заявку. Напишіть нам, будь ласка, в
        <a href="${esc(CFG.instagram)}" target="_blank" rel="noopener">Instagram</a> або
        <a href="${esc(CFG.telegram)}" target="_blank" rel="noopener">Telegram</a> — відповімо швидко.`;

      if (!CFG.workerUrl) { msg.innerHTML = fallback; msg.classList.add('is-err'); return; }

      btn.disabled = true; btn.textContent = 'Надсилаємо…';
      try {
        const res = await fetch(CFG.workerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(res.status);
        form.reset(); total();
        msg.textContent = 'Дякуємо! Заявку отримали — скоро напишемо або зателефонуємо.';
        msg.classList.add('is-ok');
      } catch {
        msg.innerHTML = fallback; msg.classList.add('is-err');
      } finally {
        btn.disabled = false; btn.textContent = 'Надіслати заявку';
      }
    });
  });

  // Кнопки «Замовити» в картках
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-order-product]');
    if (!btn) return;
    const form = $('[data-order] form');
    if (!form) { location.href = 'catalog.html?p=' + encodeURIComponent(btn.dataset.orderProduct) + '#order'; return; }
    form.product.value = btn.dataset.orderProduct;
    form.dispatchEvent(new Event('change'));
    $('#order').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- Анімації при скролі ----------
  function observe(root = document) {
    if (!('IntersectionObserver' in window)) { $$('.reveal', root).forEach((el) => el.classList.add('is-in')); return; }
    io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal:not(.is-in)', root).forEach((el) => io.observe(el));
  }
  observe();

  // ---------- Липка кнопка: ховаємо, коли форма вже на екрані ----------
  const sticky = $('.sticky-cta');
  const orderSec = $('#order');
  if (sticky) {
    let formVisible = false;
    const update = () => sticky.classList.toggle('is-hidden', formVisible || window.scrollY < window.innerHeight * 0.6);
    if (orderSec && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { formVisible = en.isIntersecting; update(); }, { threshold: 0.05 }).observe(orderSec);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }
})();
