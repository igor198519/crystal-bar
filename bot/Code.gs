/**
 * ==========================================================================
 *  БОТ-МАГАЗИН + CRM ДЛЯ СВІЧОК РУЧНОЇ РОБОТИ
 *  Google Apps Script + Google Таблиця. Один файл, без сервера.
 * ==========================================================================
 *
 *  ЯК ЗАПУСТИТИ (покроково, без програмування)
 *  ------------------------------------------------------------------------
 *  1. Створіть нову Google Таблицю. Меню: Розширення → Apps Script.
 *  2. Видаліть усе з файлу Code.gs і вставте цей код повністю. Ctrl+S.
 *  3. Ліворуч ⚙️ «Налаштування проєкту»:
 *       • Часовий пояс: (GMT+02:00) Kyiv.
 *       • Унизу «Властивості скрипту» → «Додати властивість»:
 *           BOT_TOKEN  — токен бота від @BotFather (/newbot);
 *           NP_API_KEY — ключ API Нової Пошти (кабінет НП → Налаштування → Безпека);
 *           MONO_TOKEN — токен monobank еквайрингу (web.monobank.ua → Налаштування → API).
 *         Якщо НП чи monobank поки немає — ці дві властивості можна додати пізніше.
 *  4. Угорі у списку функцій оберіть setup → «Виконати» → надайте доступ.
 *     Зʼявляться всі аркуші з прикладами, перевірками й тригерами.
 *  5. «Розгорнути» → «Нове розгортання» → ⚙️ тип «Вебпрограма».
 *     Виконувати як: «Я». Хто має доступ: «Усі». → «Розгорнути».
 *     Скопіюйте URL вебпрограми (закінчується на /exec).
 *  6. Властивості скрипту → додайте WEBAPP_URL = цей URL.
 *  7. Оберіть функцію setWebhook → «Виконати». У «Журналі виконання» має бути "ok":true.
 *  8. Напишіть боту /start, потім /id — бот покаже ваш Telegram ID.
 *     Аркуш «Команда»: впишіть ID Ігоря і Юлії (роль «Власник») та помічника
 *     (роль «Помічник»), поставте галочку «Активний».
 *  9. Аркуш «Налаштування»: назва бренду, місто самовивозу, дані відправника НП.
 *     Для створення ТТН виконайте функцію npSetupSender — вона сама заповнить коди відправника.
 * 10. Заповніть «Товари», «Варіанти», «Сировина», «Техкарти» (приклади можна видалити).
 *     Фото товару: власник надсилає боту фото з підписом «фото P001» — бот додасть його до товару.
 *
 *  ПІСЛЯ ЗМІН У КОДІ: «Розгорнути» → «Керувати розгортаннями» → ✏️ → Версія «Нова» →
 *  «Розгорнути». URL не зміниться, повторно setWebhook запускати не треба.
 *
 *  Назви колонок читаються з першого рядка: колонки можна міняти місцями,
 *  але не перейменовувати.
 * ==========================================================================
 */

/* ============================ КОНСТАНТИ ============================ */

const TZ = 'Europe/Kyiv';
const ST = {
  NEW: 'Нове', CONF: 'Підтверджено', PROD: 'У виробництві', READY: 'Готово до відправки',
  SENT: 'Відправлено', RECV: 'Отримано', DONE: 'Завершено', CANC: 'Скасовано'
};
const STATUSES = [ST.NEW, ST.CONF, ST.PROD, ST.READY, ST.SENT, ST.RECV, ST.DONE, ST.CANC];
const CATS = ['Свічки', 'Підсвічники', 'Набори', 'Сезонна колекція', 'Подарункові сертифікати'];
const PACKS = ['Крафт', 'Коробка', 'Преміум'];
const PAY = { MONO: 'monobank', ADV: 'Аванс monobank', COD: 'Накладений платіж', PICKUP: 'При самовивозі' };
const PAYST = { WAIT: 'Очікує', PAID: 'Оплачено', ADV: 'Аванс оплачено', COD: 'При отриманні', REF: 'Повернено', FAIL: 'Не оплачено' };

const MENU = {
  CATALOG: '🛍 Каталог', CART: '🧺 Кошик', SET: '🎁 Зібрати набір', ORDERS: '📦 Мої замовлення',
  POINTS: '⭐ Бали і друзі', DATES: '🎂 Дати близьких', WHOLESALE: '💼 Опт і корпоратив',
  CONTACT: '💬 Звʼязатися', STAFF: '⚙️ Керування'
};

/* Структура аркушів: назва → колонки. Колонки-чекбокси — у CHECKBOX_COLS. */
const SHEETS = {
  'Товари': ['ID', 'Назва', 'Категорія', 'Опис', 'Аромат', 'Обʼєм', 'Час горіння, год', 'Ціна', 'Оптова ціна',
    'Собівартість', 'Фото', 'Залишок', 'Під замовлення', 'Днів виготовлення', 'Старт продажу', 'Кінець продажу', 'Активний'],
  'Варіанти': ['ID варіанту', 'ID товару', 'Аромат', 'Колір воску', 'Розмір', 'Ґніт', 'Ціна', 'Оптова ціна', 'Залишок', 'Активний'],
  'Техкарти': ['ID товару', 'ID варіанту', 'ID сировини', 'Кількість'],
  'Сировина': ['ID', 'Назва', 'Одиниця', 'Залишок', 'Мін. залишок', 'Ціна за одиницю'],
  'Клієнти': ['TG_ID', 'Імʼя', 'Username', 'Телефон', 'ПІБ', 'Тип', 'Опт погоджено', 'Бали', 'Реферер', 'Реф. бонус',
    'Дата реєстрації', 'Остання активність', 'Мій день народження', 'Кошик', 'Кошик оновлено', 'Етап нагадування', 'Підписка', 'Нотатки'],
  'Замовлення': ['№', 'Дата', 'TG_ID', 'Клієнт', 'Телефон клієнта', 'Статус', 'Спосіб оплати', 'Статус оплати', 'Сума товарів',
    'Знижка набору', 'Промокод', 'Знижка промокоду', 'Бали списано', 'Пакування', 'Ціна пакування', 'Доставка', 'Отримувач',
    'Телефон отримувача', 'Місто', 'Місто Ref', 'Відділення', 'Відділення Ref', 'Потрібно до', 'Подарунок', 'Листівка', 'Без чека',
    'До сплати', 'Сплачено', 'Invoice ID', 'Посилання оплати', 'ТТН', 'Статус НП', 'Прибуло', 'Отримано', 'Нагадано про посилку', 'Запаковано',
    'Фото пакування', 'Відповідальний', 'Собівартість', 'Кешбек нараховано', 'Відгук', 'Повідомлення команді', 'Історія'],
  'Позиції': ['№ замовлення', 'Тип', 'ID товару', 'ID варіанту', 'Назва', 'Аромат', 'Обʼєм', 'Кількість', 'Ціна', 'Сума',
    'Під замовлення', 'Набір', 'Собівартість', 'Нагадати догорає', 'Нагадано'],
  'Виробництво': ['ID', '№ замовлення', 'ID товару', 'ID варіанту', 'Назва', 'Аромат', 'Обʼєм', 'Кількість', 'Дедлайн', 'Статус', 'Відлито', 'Готово', 'Хто'],
  'Промокоди': ['Код', 'Тип', 'Значення', 'Мін. сума', 'Діє до', 'Ліміт', 'Використано', 'Активний'],
  'Відгуки': ['Дата', '№ замовлення', 'TG_ID', 'Оцінка', 'Текст', 'Фото', 'Бали'],
  'Дати клієнтів': ['TG_ID', 'Імʼя близького', 'Дата', 'Привід', 'Нагадано рік'],
  'Покинуті кошики': ['TG_ID', 'Дата', 'Сума', 'Нагадування 1', 'Нагадування 2', 'Замовлення'],
  'Заявки': ['Дата', 'TG_ID', 'Тип', 'Компанія', 'Кількість', 'Бюджет', 'Дата потреби', 'Логотип/етикетка', 'Файл', 'Контакт', 'Статус'],
  'Команда': ['TG_ID', 'Імʼя', 'Роль', 'Активний'],
  'Налаштування': ['Ключ', 'Значення', 'Опис'],
  'Лог': ['Дата', 'Рівень', 'Хто', 'Дія', 'Деталі']
};
const CHECKBOX_COLS = {
  'Товари': ['Під замовлення', 'Активний'], 'Варіанти': ['Активний'], 'Клієнти': ['Опт погоджено', 'Підписка'],
  'Позиції': ['Під замовлення', 'Нагадано'], 'Промокоди': ['Активний'], 'Команда': ['Активний']
};

const SETTINGS_DEFAULT = [
  ['Назва бренду', '[НАЗВА БРЕНДУ]', 'Назва магазину в привітанні, оплатах і розсилках'],
  ['Місто самовивозу', '[МІСТО]', 'Показується клієнту при виборі самовивозу'],
  ['Адреса самовивозу', 'Адресу і час уточнимо в повідомленні', 'Деталі самовивозу для клієнта'],
  ['Контакт для клієнтів', '@username', 'Куди писати клієнту, якщо щось термінове'],
  ['Днів виготовлення за замовчуванням', '4', 'Термін «під замовлення», якщо в товарі не вказано'],
  ['Визрівання, год', '48', 'Скільки годин свічка застигає між «Відлито» і «Готово»'],
  ['Днів доставки НП', '2', 'Запас на доставку, коли бот перевіряє дату «потрібно до»'],
  ['Знижка на набір, %', '10', 'Знижка на свічку+підсвічник у конструкторі набору'],
  ['Пакування Крафт, грн', '0', 'Ціна для клієнта'],
  ['Пакування Коробка, грн', '60', 'Ціна для клієнта'],
  ['Пакування Преміум, грн', '150', 'Ціна для клієнта'],
  ['Собівартість Крафт, грн', '5', 'Для розрахунку маржі'],
  ['Собівартість Коробка, грн', '25', 'Для розрахунку маржі'],
  ['Собівартість Преміум, грн', '70', 'Для розрахунку маржі'],
  ['Накладений платіж', 'Так', 'Так/Ні — дозволити оплату при отриманні для товарів у наявності'],
  ['Аванс під замовлення, %', '50', 'Розмір авансу для товарів під замовлення (решта — накладеним платежем)'],
  ['Кешбек, %', '5', 'Скільки балів нараховується після доставки (1 бал = 1 грн)'],
  ['Оплата балами до, %', '30', 'Максимальна частка суми, яку можна оплатити балами'],
  ['Реферальний бонус, балів', '50', 'Бонус обом — другу і тому, хто запросив, після першої покупки друга'],
  ['Бонус за фото-відгук, балів', '30', 'Нараховується за фото свічки в інтерʼєрі'],
  ['Кошик: нагадування 1, год', '3', 'Через скільки годин нагадати про покинутий кошик'],
  ['Кошик: нагадування 2, год', '24', 'Друге нагадування — з промокодом'],
  ['Кошик: промокод', 'COMEBACK10', 'Промокод у другому нагадуванні (має бути в аркуші «Промокоди»)'],
  ['Горіння на день, год', '2', 'Для розрахунку «свічка догорає»'],
  ['Нагадувати про дати за, днів', '7', 'За скільки днів до дати близької людини нагадати'],
  ['Поріг залишку', '2', 'Попередження, коли готових виробів або підсвічників ≤ цього числа'],
  ['Посилка лежить, днів', '3', 'Через скільки днів у відділенні нагадати клієнту'],
  ['Автозавершення через, днів', '7', 'Після «Отримано» замовлення автоматично стає «Завершено»'],
  ['Комісія еквайрингу, %', '1.3', 'Комісія monobank для розрахунку собівартості'],
  ['Ранкове зведення, година', '9', 'О котрій годині надсилати ранкове зведення (0–23). Після зміни запустіть setup'],
  ['Неактивні, днів', '60', 'Сегмент розсилки «неактивні»'],
  ['НП: місто відправника', 'Київ', 'Місто, звідки відправляєте'],
  ['НП: відділення відправника', '1', 'Номер відділення відправлення'],
  ['НП: телефон відправника', '380XXXXXXXXX', 'Телефон відправника у форматі 380…'],
  ['НП: вага посилки, кг', '0.5', 'Вага за замовчуванням для ТТН'],
  ['НП: опис вантажу', 'Свічки ручної роботи', 'Опис вантажу в ТТН'],
  ['НП Ref: відправник', '', 'Заповнює функція npSetupSender'],
  ['НП Ref: контакт', '', 'Заповнює функція npSetupSender'],
  ['НП Ref: місто', '', 'Заповнює функція npSetupSender'],
  ['НП Ref: адреса', '', 'Заповнює функція npSetupSender']
];

/* ============================ ЗАПУСК ============================ */

/** Створює аркуші, приклади, перевірки даних, чекбокси і тригери. Можна запускати повторно. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold').setBackground('#f1ece4');
      sh.setFrozenRows(1);
    } else {
      // додаємо відсутні колонки в кінець, не чіпаючи наявні
      const have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      SHEETS[name].forEach(h => { if (have.indexOf(h) < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold'); });
    }
  });
  const def = ss.getSheetByName('Аркуш1') || ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  fillSamples_();
  applyValidation_();
  installTriggers_();
  log_('INFO', 'система', 'setup', 'Аркуші і тригери готові');
  Logger.log('Готово. Далі: розгорніть вебпрограму, додайте WEBAPP_URL і запустіть setWebhook.');
}

function fillSamples_() {
  const add = (name, rows) => {
    const t = tbl_(name);
    if (t.rows.length) return;
    rows.forEach(r => append_(name, r));
  };
  add('Налаштування', SETTINGS_DEFAULT.map(r => ({ 'Ключ': r[0], 'Значення': r[1], 'Опис': r[2] })));
  // якщо аркуш уже був — дописуємо нові ключі
  const have = rows_('Налаштування').map(r => String(r['Ключ']));
  SETTINGS_DEFAULT.forEach(r => { if (have.indexOf(r[0]) < 0) append_('Налаштування', { 'Ключ': r[0], 'Значення': r[1], 'Опис': r[2] }); });

  const now = new Date();
  const y = now.getFullYear();
  add('Товари', [
    { 'ID': 'P001', 'Назва': 'Свічка у склі 200 мл', 'Категорія': 'Свічки', 'Опис': 'Соєвий віск, бавовняний або деревʼяний ґніт. Тихе рівне горіння.', 'Аромат': '', 'Обʼєм': '200 мл', 'Час горіння, год': 40, 'Ціна': 450, 'Оптова ціна': 340, 'Собівартість': '', 'Фото': '', 'Залишок': '', 'Під замовлення': true, 'Днів виготовлення': 4, 'Активний': true },
    { 'ID': 'P002', 'Назва': 'Свічка «Лаванда» 120 мл', 'Категорія': 'Свічки', 'Опис': 'Кокосовий віск і лаванда — для спокійного вечора.', 'Аромат': 'Лаванда', 'Обʼєм': '120 мл', 'Час горіння, год': 25, 'Ціна': 320, 'Оптова ціна': 240, 'Залишок': 4, 'Під замовлення': true, 'Днів виготовлення': 3, 'Активний': true },
    { 'ID': 'P003', 'Назва': 'Керамічний підсвічник «Хмара»', 'Категорія': 'Підсвічники', 'Опис': 'Ручна кераміка, матова глазур.', 'Ціна': 380, 'Оптова ціна': 300, 'Собівартість': 190, 'Залишок': 6, 'Під замовлення': false, 'Активний': true },
    { 'ID': 'P004', 'Назва': 'Деревʼяний підсвічник', 'Категорія': 'Підсвічники', 'Опис': 'Дуб, олія-віск.', 'Ціна': 290, 'Оптова ціна': 230, 'Собівартість': 140, 'Залишок': 4, 'Під замовлення': false, 'Активний': true },
    { 'ID': 'P005', 'Назва': 'Набір «Затишний вечір»', 'Категорія': 'Набори', 'Опис': 'Свічка 200 мл + керамічний підсвічник + коробка.', 'Аромат': 'Ваніль і сандал', 'Обʼєм': '200 мл', 'Час горіння, год': 40, 'Ціна': 790, 'Оптова ціна': 620, 'Собівартість': 330, 'Залишок': 2, 'Під замовлення': true, 'Днів виготовлення': 4, 'Активний': true },
    { 'ID': 'P006', 'Назва': 'Свічка «Глінтвейн»', 'Категорія': 'Сезонна колекція', 'Опис': 'Зимовий аромат: апельсин, кориця, гвоздика.', 'Аромат': 'Глінтвейн', 'Обʼєм': '200 мл', 'Час горіння, год': 40, 'Ціна': 480, 'Оптова ціна': 360, 'Залишок': '', 'Під замовлення': true, 'Днів виготовлення': 4, 'Старт продажу': new Date(y, 10, 1), 'Кінець продажу': new Date(y + 1, 0, 31), 'Активний': true },
    { 'ID': 'P007', 'Назва': 'Подарунковий сертифікат 500 ₴', 'Категорія': 'Подарункові сертифікати', 'Опис': 'Іменний сертифікат у конверті.', 'Ціна': 500, 'Собівартість': 15, 'Залишок': '', 'Під замовлення': false, 'Активний': true }
  ]);
  add('Варіанти', [
    { 'ID варіанту': 'V001', 'ID товару': 'P001', 'Аромат': 'Ваніль і сандал', 'Колір воску': 'Молочний', 'Розмір': '200 мл', 'Ґніт': 'Бавовна', 'Ціна': 450, 'Оптова ціна': 340, 'Залишок': 3, 'Активний': true },
    { 'ID варіанту': 'V002', 'ID товару': 'P001', 'Аромат': 'Ваніль і сандал', 'Колір воску': 'Молочний', 'Розмір': '200 мл', 'Ґніт': 'Дерево', 'Ціна': 480, 'Оптова ціна': 360, 'Залишок': 0, 'Активний': true },
    { 'ID варіанту': 'V003', 'ID товару': 'P001', 'Аромат': 'Інжир', 'Колір воску': 'Пісочний', 'Розмір': '200 мл', 'Ґніт': 'Дерево', 'Ціна': 480, 'Оптова ціна': 360, 'Залишок': 0, 'Активний': true }
  ]);
  add('Сировина', [
    { 'ID': 'R001', 'Назва': 'Соєвий віск', 'Одиниця': 'г', 'Залишок': 5000, 'Мін. залишок': 1000, 'Ціна за одиницю': 0.12 },
    { 'ID': 'R002', 'Назва': 'Кокосовий віск', 'Одиниця': 'г', 'Залишок': 2000, 'Мін. залишок': 500, 'Ціна за одиницю': 0.25 },
    { 'ID': 'R003', 'Назва': 'Ґніт бавовняний', 'Одиниця': 'шт', 'Залишок': 100, 'Мін. залишок': 20, 'Ціна за одиницю': 3 },
    { 'ID': 'R004', 'Назва': 'Ґніт деревʼяний', 'Одиниця': 'шт', 'Залишок': 30, 'Мін. залишок': 10, 'Ціна за одиницю': 8 },
    { 'ID': 'R005', 'Назва': 'Аромаолія ваніль-сандал', 'Одиниця': 'г', 'Залишок': 300, 'Мін. залишок': 60, 'Ціна за одиницю': 1.5 },
    { 'ID': 'R006', 'Назва': 'Аромаолія лаванда', 'Одиниця': 'г', 'Залишок': 200, 'Мін. залишок': 40, 'Ціна за одиницю': 1.4 },
    { 'ID': 'R007', 'Назва': 'Аромаолія інжир', 'Одиниця': 'г', 'Залишок': 150, 'Мін. залишок': 40, 'Ціна за одиницю': 1.6 },
    { 'ID': 'R008', 'Назва': 'Банка скляна 200 мл', 'Одиниця': 'шт', 'Залишок': 20, 'Мін. залишок': 5, 'Ціна за одиницю': 28 },
    { 'ID': 'R009', 'Назва': 'Банка скляна 120 мл', 'Одиниця': 'шт', 'Залишок': 20, 'Мін. залишок': 5, 'Ціна за одиницю': 20 },
    { 'ID': 'R010', 'Назва': 'Етикетка', 'Одиниця': 'шт', 'Залишок': 200, 'Мін. залишок': 30, 'Ціна за одиницю': 2 }
  ]);
  add('Техкарти', [
    { 'ID товару': 'P001', 'ID варіанту': 'V001', 'ID сировини': 'R001', 'Кількість': 180 },
    { 'ID товару': 'P001', 'ID варіанту': 'V001', 'ID сировини': 'R003', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V001', 'ID сировини': 'R005', 'Кількість': 12 },
    { 'ID товару': 'P001', 'ID варіанту': 'V001', 'ID сировини': 'R008', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V001', 'ID сировини': 'R010', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V002', 'ID сировини': 'R001', 'Кількість': 180 },
    { 'ID товару': 'P001', 'ID варіанту': 'V002', 'ID сировини': 'R004', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V002', 'ID сировини': 'R005', 'Кількість': 12 },
    { 'ID товару': 'P001', 'ID варіанту': 'V002', 'ID сировини': 'R008', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V002', 'ID сировини': 'R010', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V003', 'ID сировини': 'R001', 'Кількість': 180 },
    { 'ID товару': 'P001', 'ID варіанту': 'V003', 'ID сировини': 'R004', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V003', 'ID сировини': 'R007', 'Кількість': 12 },
    { 'ID товару': 'P001', 'ID варіанту': 'V003', 'ID сировини': 'R008', 'Кількість': 1 },
    { 'ID товару': 'P001', 'ID варіанту': 'V003', 'ID сировини': 'R010', 'Кількість': 1 },
    { 'ID товару': 'P002', 'ID варіанту': '', 'ID сировини': 'R002', 'Кількість': 105 },
    { 'ID товару': 'P002', 'ID варіанту': '', 'ID сировини': 'R003', 'Кількість': 1 },
    { 'ID товару': 'P002', 'ID варіанту': '', 'ID сировини': 'R006', 'Кількість': 7 },
    { 'ID товару': 'P002', 'ID варіанту': '', 'ID сировини': 'R009', 'Кількість': 1 },
    { 'ID товару': 'P002', 'ID варіанту': '', 'ID сировини': 'R010', 'Кількість': 1 },
    { 'ID товару': 'P006', 'ID варіанту': '', 'ID сировини': 'R001', 'Кількість': 180 },
    { 'ID товару': 'P006', 'ID варіанту': '', 'ID сировини': 'R003', 'Кількість': 1 },
    { 'ID товару': 'P006', 'ID варіанту': '', 'ID сировини': 'R008', 'Кількість': 1 },
    { 'ID товару': 'P006', 'ID варіанту': '', 'ID сировини': 'R010', 'Кількість': 1 }
  ]);
  add('Промокоди', [
    { 'Код': 'COMEBACK10', 'Тип': '%', 'Значення': 10, 'Мін. сума': 300, 'Діє до': '', 'Ліміт': '', 'Використано': 0, 'Активний': true },
    { 'Код': 'WELCOME50', 'Тип': 'Сума', 'Значення': 50, 'Мін. сума': 500, 'Діє до': new Date(y, 11, 31), 'Ліміт': 100, 'Використано': 0, 'Активний': true }
  ]);
  add('Команда', [
    { 'TG_ID': '', 'Імʼя': 'Ігор', 'Роль': 'Власник', 'Активний': false },
    { 'TG_ID': '', 'Імʼя': 'Юлія', 'Роль': 'Власник', 'Активний': false },
    { 'TG_ID': '', 'Імʼя': 'Помічник', 'Роль': 'Помічник', 'Активний': false }
  ]);
}

function applyValidation_() {
  const list = (name, col, values) => {
    const t = tbl_(name); const i = t.idx[col]; if (i === undefined) return;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
    t.sh.getRange(2, i + 1, Math.max(t.sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  };
  list('Товари', 'Категорія', CATS);
  list('Варіанти', 'Ґніт', ['Бавовна', 'Дерево']);
  list('Замовлення', 'Статус', STATUSES);
  list('Замовлення', 'Статус оплати', Object.keys(PAYST).map(k => PAYST[k]));
  list('Замовлення', 'Пакування', PACKS.concat(['Без пакування']));
  list('Промокоди', 'Тип', ['%', 'Сума']);
  list('Клієнти', 'Тип', ['Роздріб', 'Опт', 'Корпоратив']);
  list('Команда', 'Роль', ['Власник', 'Помічник']);
  list('Виробництво', 'Статус', ['Чекає', 'Відлито', 'Готово', 'Скасовано']);
  list('Заявки', 'Статус', ['Нова', 'Погоджено', 'Відхилено']);
  // чекбокси тільки в заповнених рядках, щоб appendRow не «їхав» вниз
  Object.keys(CHECKBOX_COLS).forEach(name => {
    const t = tbl_(name);
    if (!t.rows.length) return;
    CHECKBOX_COLS[name].forEach(col => {
      const i = t.idx[col]; if (i === undefined) return;
      t.sh.getRange(2, i + 1, t.rows.length, 1).insertCheckboxes();
    });
  });
  const dateCols = { 'Товари': ['Старт продажу', 'Кінець продажу'], 'Промокоди': ['Діє до'], 'Замовлення': ['Дата', 'Потрібно до', 'Прибуло', 'Отримано'], 'Виробництво': ['Дедлайн', 'Відлито', 'Готово'], 'Лог': ['Дата'] };
  Object.keys(dateCols).forEach(name => {
    const t = tbl_(name);
    dateCols[name].forEach(col => {
      const i = t.idx[col]; if (i === undefined) return;
      t.sh.getRange(2, i + 1, Math.max(t.sh.getMaxRows() - 1, 1), 1).setNumberFormat(col === 'Дата' || col === 'Відлито' || col === 'Готово' ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy');
    });
  });
}

function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['hourlyJob', 'trackingJob', 'morningJob'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('trackingJob').timeBased().everyHours(2).create();
  const h = Math.min(23, Math.max(0, parseInt(S_('Ранкове зведення, година'), 10) || 9));
  ScriptApp.newTrigger('morningJob').timeBased().atHour(h).everyDays(1).inTimezone(TZ).create();
}

/** Підключає бота до вебпрограми. Запускати після кожної зміни WEBAPP_URL. */
function setWebhook() {
  const url = prop_('WEBAPP_URL');
  if (!url) throw new Error('Додайте WEBAPP_URL у Властивості скрипту');
  const r = tg_('setWebhook', { url: url, drop_pending_updates: true, allowed_updates: ['message', 'callback_query'] });
  Logger.log(JSON.stringify(r));
  tg_('setMyCommands', { commands: [{ command: 'start', description: 'Головне меню' }, { command: 'id', description: 'Мій Telegram ID' }] });
  Logger.log(JSON.stringify(tg_('getWebhookInfo', {})));
}

/* ============================ ТАБЛИЦЯ ============================ */

let _memo = {};
let _settings = null;

function tbl_(name) {
  if (_memo[name]) return _memo[name];
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Немає аркуша «' + name + '». Запустіть setup()');
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const lastRow = sh.getLastRow();
  const values = lastRow ? sh.getRange(1, 1, lastRow, lastCol).getValues() : [[]];
  const headers = values[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { if (h) idx[h] = i; });
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    if (values[r].every(v => v === '' || v === false)) continue;
    const o = { _row: r + 1 };
    headers.forEach((h, i) => { if (h) o[h] = values[r][i]; });
    rows.push(o);
  }
  _memo[name] = { name: name, sh: sh, headers: headers, idx: idx, rows: rows };
  return _memo[name];
}
function invalidate_(name) { delete _memo[name]; if (name === 'Налаштування') _settings = null; }
function rows_(name) { return tbl_(name).rows; }
function find_(name, col, val) { return rows_(name).find(r => String(r[col]) === String(val)); }
function filter_(name, fn) { return rows_(name).filter(fn); }

function append_(name, obj) {
  const t = tbl_(name);
  const missing = Object.keys(obj).filter(k => t.idx[k] === undefined);
  if (missing.length) throw new Error('В аркуші «' + name + '» немає колонок: ' + missing.join(', '));
  const arr = t.headers.map(h => (h && h in obj) ? obj[h] : '');
  const row = Math.max(t.sh.getLastRow(), 1) + 1;
  t.sh.getRange(row, 1, 1, arr.length).setValues([arr]);
  (CHECKBOX_COLS[name] || []).forEach(col => {
    const i = t.idx[col]; if (i === undefined) return;
    t.sh.getRange(row, i + 1).insertCheckboxes().setValue(obj[col] === true);
  });
  invalidate_(name);
  return row;
}

function update_(name, rowNum, obj) {
  const t = tbl_(name);
  Object.keys(obj).forEach(k => {
    const i = t.idx[k];
    if (i === undefined) throw new Error('В аркуші «' + name + '» немає колонки «' + k + '»');
    t.sh.getRange(rowNum, i + 1).setValue(obj[k]);
  });
  invalidate_(name);
}

/* ============================ НАЛАШТУВАННЯ ============================ */

function S_(key) {
  if (!_settings) {
    _settings = {};
    rows_('Налаштування').forEach(r => { _settings[String(r['Ключ']).trim()] = r['Значення']; });
  }
  const v = _settings[key];
  if (v === undefined || v === '') {
    const d = SETTINGS_DEFAULT.find(r => r[0] === key);
    return d ? d[1] : '';
  }
  return v;
}
function N_(key) { const n = parseFloat(String(S_(key)).replace(',', '.')); return isNaN(n) ? 0 : n; }
function yes_(key) { return /^(так|yes|true|1)$/i.test(String(S_(key)).trim()); }
function setSetting_(key, value) {
  const r = find_('Налаштування', 'Ключ', key);
  if (r) update_('Налаштування', r._row, { 'Значення': value });
  else append_('Налаштування', { 'Ключ': key, 'Значення': value, 'Опис': '' });
}
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function brand_() { return String(S_('Назва бренду')); }

/* ============================ ЛОГ ============================ */

function log_(level, who, action, details) {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('Лог');
    if (!sh) return;
    sh.appendRow([new Date(), level, String(who || ''), String(action || ''), String(details || '').slice(0, 2000)]);
  } catch (e) { console.error(e); }
}
function logErr_(action, err) {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(action, msg);
  log_('ERROR', 'система', action, msg);
}

/* ============================ ДОПОМІЖНІ ============================ */

function esc_(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function money_(n) { const v = Math.round(Number(n) || 0); return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴'; }
function num_(v) { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }
function fdate_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, 'dd.MM.yyyy') : (d ? String(d) : ''); }
function fdt_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, 'dd.MM HH:mm') : (d ? String(d) : ''); }
function dayStart_(d) { const s = Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM-dd'); const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays_(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function daysBetween_(a, b) { return Math.round((dayStart_(b) - dayStart_(a)) / 86400000); }
function parseDate_(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?$/);
  if (!m) return null;
  const now = new Date();
  let y = m[3] ? +m[3] : now.getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, +m[2] - 1, +m[1]);
  if (d.getMonth() !== +m[2] - 1) return null;
  if (!m[3] && dayStart_(d) < dayStart_(now)) d.setFullYear(y + 1);
  return d;
}
function phone_(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 10 && d[0] === '0') d = '38' + d;
  if (d.length === 9) d = '380' + d;
  return /^380\d{9}$/.test(d) ? d : '';
}
function bool_(v) { return v === true || /^(true|так|1)$/i.test(String(v)); }
function lock_() { const l = LockService.getScriptLock(); l.waitLock(25000); return l; }
function uid_() { return Utilities.getUuid().slice(0, 8); }

/* ============================ TELEGRAM API ============================ */

function tg_(method, payload, quiet) {
  const token = prop_('BOT_TOKEN');
  if (!token) throw new Error('Додайте BOT_TOKEN у Властивості скрипту');
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  let j;
  try { j = JSON.parse(res.getContentText()); } catch (e) { j = { ok: false, description: res.getContentText() }; }
  if (!j.ok && !quiet && !/message is not modified|query is too old|message to delete not found/.test(j.description || '')) {
    log_('ERROR', 'telegram', method, (j.description || '') + ' | ' + JSON.stringify(payload).slice(0, 400));
  }
  return j;
}
function kb_(rows) { return { inline_keyboard: rows.filter(r => r && r.length) }; }
function b_(text, data) { return { text: text, callback_data: String(data).slice(0, 64) }; }
function u_(text, url) { return { text: text, url: url }; }

function send_(chat, text, rows, quiet) {
  const p = { chat_id: chat, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (rows) p.reply_markup = Array.isArray(rows) ? kb_(rows) : rows;
  return tg_('sendMessage', p, quiet);
}
function edit_(chat, msgId, text, rows) {
  const p = { chat_id: chat, message_id: msgId, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (rows) p.reply_markup = kb_(rows);
  return tg_('editMessageText', p, true);
}
/** Редагує повідомлення з кнопкою, а якщо не вийшло (напр., там фото) — надсилає нове. */
function show_(ctx, text, rows) {
  if (ctx.cb && ctx.cb.message && ctx.cb.message.text !== undefined) {
    const r = edit_(ctx.chat, ctx.cb.message.message_id, text, rows);
    if (r.ok || /not modified/.test(r.description || '')) return r;
  }
  return send_(ctx.chat, text, rows);
}
function photo_(chat, fileOrUrl, caption, rows) {
  const p = { chat_id: chat, photo: fileOrUrl, caption: caption, parse_mode: 'HTML' };
  if (rows) p.reply_markup = kb_(rows);
  return tg_('sendPhoto', p);
}
function answer_(ctx, text, alert) {
  if (!ctx.cb || ctx.answered) return;
  ctx.answered = true;
  tg_('answerCallbackQuery', { callback_query_id: ctx.cb.id, text: text || '', show_alert: !!alert }, true);
}
function del_(chat, msgId) { tg_('deleteMessage', { chat_id: chat, message_id: msgId }, true); }
function botName_() {
  const c = CacheService.getScriptCache();
  let n = c.get('botname');
  if (!n) { const r = tg_('getMe', {}); n = r.ok ? r.result.username : ''; c.put('botname', n, 21600); }
  return n;
}

/* ============================ СТАН ДІАЛОГУ ============================ */

function getState_(chat) { const v = CacheService.getScriptCache().get('st' + chat); return v ? JSON.parse(v) : null; }
function setState_(chat, st) { CacheService.getScriptCache().put('st' + chat, JSON.stringify(st), 21600); }
function clearState_(chat) { CacheService.getScriptCache().remove('st' + chat); }
function tmpPut_(key, obj) { CacheService.getScriptCache().put(key, JSON.stringify(obj), 21600); }
function tmpGet_(key) { const v = CacheService.getScriptCache().get(key); return v ? JSON.parse(v) : null; }

/* ============================ КОМАНДА І РОЛІ ============================ */

function staffOf_(tgId) {
  const r = rows_('Команда').find(x => String(x['TG_ID']) === String(tgId) && bool_(x['Активний']));
  if (!r) return null;
  return { id: String(r['TG_ID']), name: String(r['Імʼя']), role: /власни/i.test(String(r['Роль'])) ? 'owner' : 'helper', row: r._row };
}
function team_(role) {
  return rows_('Команда').filter(x => x['TG_ID'] && bool_(x['Активний']) && (!role || (role === 'owner') === /власни/i.test(String(x['Роль']))))
    .map(x => ({ id: String(x['TG_ID']), name: String(x['Імʼя']), role: /власни/i.test(String(x['Роль'])) ? 'owner' : 'helper' }));
}
function notifyOwners_(text, rows) { return team_('owner').map(o => ({ id: o.id, r: send_(o.id, text, rows) })); }
function notifyHelpers_(text, rows) { team_('helper').forEach(h => send_(h.id, text, rows)); }
function staffName_(ctx) { return ctx.staff ? ctx.staff.name : (ctx.from.first_name || String(ctx.from.id)); }

/* ============================ ВХІД: WEBHOOK ============================ */

function doPost(e) {
  try {
    const src = e && e.parameter ? e.parameter.src : '';
    const body = e && e.postData ? e.postData.contents : '';
    if (src === 'mono') { monoWebhook_(body); return ContentService.createTextOutput('ok'); }
    if (!body) return ContentService.createTextOutput('ok');
    const u = JSON.parse(body);
    const cache = CacheService.getScriptCache();
    if (u.update_id !== undefined) {
      if (cache.get('u' + u.update_id)) return ContentService.createTextOutput('ok'); // дубль
      cache.put('u' + u.update_id, '1', 21600);
    }
    if (u.message) onMessage_(u.message);
    else if (u.callback_query) onCallback_(u.callback_query);
  } catch (err) {
    logErr_('doPost', err);
  }
  return ContentService.createTextOutput('ok');
}

function doGet(e) {
  const src = e && e.parameter ? e.parameter.src : '';
  const bot = botName_();
  const html = src === 'paid'
    ? '<meta name="viewport" content="width=device-width"><div style="font-family:sans-serif;padding:40px;text-align:center"><h2>Дякуємо! 🕯</h2><p>Оплата обробляється. Підтвердження прийде в Telegram.</p><p><a href="https://t.me/' + bot + '">Повернутися в бот</a></p></div>'
    : 'Бот працює.';
  return HtmlService.createHtmlOutput(html);
}

/* ============================ ПОВІДОМЛЕННЯ ============================ */

function ctxOf_(from, chat) {
  const ctx = { chat: chat, from: from, staff: staffOf_(from.id) };
  ctx.role = ctx.staff ? ctx.staff.role : null;
  return ctx;
}

function onMessage_(m) {
  if (!m.chat || m.chat.type !== 'private') return;
  const ctx = ctxOf_(m.from, m.chat.id);
  ctx.msg = m;
  const text = (m.text || '').trim();
  let ref = '';
  if (/^\/start/.test(text)) { const p = text.split(' ')[1] || ''; if (/^ref_\d+$/.test(p)) ref = p.slice(4); }
  ctx.client = ensureClient_(m.from, ref);

  if (/^\/start/.test(text)) { clearState_(ctx.chat); return welcome_(ctx); }
  if (text === '/id') return send_(ctx.chat, 'Ваш Telegram ID: <code>' + m.from.id + '</code>');
  if (text === '/admin' || text === MENU.STAFF) {
    clearState_(ctx.chat);
    if (!ctx.role) return send_(ctx.chat, 'Немає доступу');
    return staffMenu_(ctx);
  }
  const menuMap = {};
  menuMap[MENU.CATALOG] = catalog_; menuMap[MENU.CART] = showCart_; menuMap[MENU.SET] = setStart_;
  menuMap[MENU.ORDERS] = myOrders_; menuMap[MENU.POINTS] = points_; menuMap[MENU.DATES] = dates_;
  menuMap[MENU.WHOLESALE] = wholesaleStart_; menuMap[MENU.CONTACT] = contactStart_;
  if (menuMap[text]) { clearState_(ctx.chat); return menuMap[text](ctx); }

  // власник додає фото товару: фото з підписом «фото P001»
  if (m.photo && ctx.role === 'owner' && /^фото\s+\S+/i.test(m.caption || '')) return attachProductPhoto_(ctx, m);

  const st = getState_(ctx.chat);
  if (st) return onState_(ctx, st, m);

  return send_(ctx.chat, 'Оберіть дію в меню нижче 👇', mainKeyboard_(ctx));
}

function mainKeyboard_(ctx) {
  const rows = [[MENU.CATALOG, MENU.CART], [MENU.SET, MENU.ORDERS], [MENU.POINTS, MENU.DATES], [MENU.WHOLESALE, MENU.CONTACT]];
  if (ctx.role) rows.push([MENU.STAFF]);
  return { keyboard: rows.map(r => r.map(t => ({ text: t }))), resize_keyboard: true };
}

function welcome_(ctx) {
  const name = esc_(ctx.from.first_name || '');
  send_(ctx.chat, 'Вітаємо' + (name ? ', ' + name : '') + '! 🕯\n\n<b>' + esc_(brand_()) + '</b> — свічки ручної роботи, підсвічники й набори.\n\n' +
    'Оберіть у меню: каталог, конструктор набору, ваші замовлення чи бали.', mainKeyboard_(ctx));
}

function ensureClient_(from, ref) {
  let c = find_('Клієнти', 'TG_ID', from.id);
  const now = new Date();
  if (!c) {
    let referer = '';
    if (ref && ref !== String(from.id) && find_('Клієнти', 'TG_ID', ref)) referer = ref;
    append_('Клієнти', {
      'TG_ID': String(from.id), 'Імʼя': [from.first_name, from.last_name].filter(Boolean).join(' '), 'Username': from.username ? '@' + from.username : '',
      'Тип': 'Роздріб', 'Опт погоджено': false, 'Бали': 0, 'Реферер': referer, 'Дата реєстрації': now, 'Остання активність': now,
      'Етап нагадування': 0, 'Підписка': true
    });
    c = find_('Клієнти', 'TG_ID', from.id);
    if (referer) send_(referer, '🎉 За вашим посиланням приєднався друг. Після його першої покупки ви обоє отримаєте ' + N_('Реферальний бонус, балів') + ' балів.', null, true);
    log_('INFO', from.id, 'новий клієнт', referer ? 'реферер ' + referer : '');
  } else {
    const last = c['Остання активність'];
    if (!(last instanceof Date) || now - last > 6 * 3600000) update_('Клієнти', c._row, { 'Остання активність': now });
    c = find_('Клієнти', 'TG_ID', from.id);
  }
  return c;
}

/* ============================ КНОПКИ ============================ */

const OWNER_ONLY = ['ol', 'take', 'conf', 'canc', 'canc2', 'ref', 'ref2', 'paid', 'recv', 'done', 'cli', 'pts', 'rep', 'bc', 'bca', 'bcp', 'bcs', 'bcx',
  'promo', 'promoadd', 'promot', 'promooff', 'team', 'teamadd', 'teamrole', 'teamtog', 'set', 'sete', 'price', 'pricep', 'pricev', 'ws', 'wsok', 'wsno', 'reply'];

function onCallback_(q) {
  const chat = q.message ? q.message.chat.id : q.from.id;
  const ctx = ctxOf_(q.from, chat);
  ctx.cb = q;
  ctx.client = ensureClient_(q.from, '');
  const parts = String(q.data || '').split(':');
  try {
    if (parts[0] === 'a') {
      const act = parts[1];
      if (!ctx.role || (OWNER_ONLY.indexOf(act) >= 0 && ctx.role !== 'owner')) return answer_(ctx, 'Немає доступу', false);
      staffAction_(ctx, act, parts.slice(2));
    } else {
      clientAction_(ctx, parts[0], parts.slice(1));
    }
  } catch (err) {
    logErr_('callback ' + q.data, err);
    answer_(ctx, 'Сталася помилка, спробуйте ще раз', true);
  }
  answer_(ctx, '');
}

function clientAction_(ctx, act, p) {
  switch (act) {
    case 'cat': return catalog_(ctx);
    case 'c': return categoryList_(ctx, +p[0]);
    case 'p': return productCard_(ctx, p[0]);
    case 'pv': return variantCard_(ctx, p[0], p[1]);
    case 'add': return addToCart_(ctx, { p: p[0], v: p[1] || '', q: 1 });
    case 'cart': return showCart_(ctx);
    case 'ci': return cartQty_(ctx, +p[0], +p[1]);
    case 'cclr': return cartClear_(ctx);
    case 'set': return setStart_(ctx);
    case 'scp': return setCandleVariants_(ctx, p[0]);
    case 'sc': return setPickCandle_(ctx, p[0], p[1] || '');
    case 'shp': return setHolderVariants_(ctx, p[0]);
    case 'sh': return setPickHolder_(ctx, p[0], p[1] || '');
    case 'sp': return setPickPack_(ctx, +p[0]);
    case 'co': return checkoutStart_(ctx);
    case 'k': return checkoutCb_(ctx, p);
    case 'my': return myOrders_(ctx);
    case 'mo': return myOrder_(ctx, p[0]);
    case 'rep': return repeatOrder_(ctx, p[0]);
    case 'pay': return payAgain_(ctx, p[0]);
    case 'pts': return points_(ctx);
    case 'dt': return dates_(ctx);
    case 'dtadd': return dateAddStart_(ctx);
    case 'dtme': setState_(ctx.chat, { s: 'dt_me' }); return send_(ctx.chat, 'Введіть ваш день народження у форматі ДД.ММ (наприклад, 14.03):');
    case 'dtdel': return dateDelete_(ctx, +p[0]);
    case 'dtw': return dateReason_(ctx, +p[0]);
    case 'ws': return wholesaleForm_(ctx, p[0]);
    case 'wsl': return wholesaleLogo_(ctx, p[0] === '1');
    case 'wsskip': return wholesaleSkipFile_(ctx);
    case 'rv': return reviewScore_(ctx, p[0], +p[1]);
    case 'rvskip': return reviewFinish_(ctx, p[0], 'Дякуємо за оцінку! 💛');
    case 'ro': return addToCart_(ctx, { p: p[0], v: p[1] || '', q: 1 });
    case 'menu': return send_(ctx.chat, 'Головне меню 👇', mainKeyboard_(ctx));
    case 'call': return contactStart_(ctx);
    default: return answer_(ctx, 'Кнопка застаріла, відкрийте меню ще раз');
  }
}

/* ============================ ТОВАРИ: ДОВІДНИКИ ============================ */

function products_() { return rows_('Товари').filter(p => p['ID'] && bool_(p['Активний']) && !seasonEnded_(p)); }
function product_(id) { return rows_('Товари').find(p => String(p['ID']) === String(id)); }
function variants_(pid) { return rows_('Варіанти').filter(v => String(v['ID товару']) === String(pid) && bool_(v['Активний'])); }
function variant_(vid) { return vid ? rows_('Варіанти').find(v => String(v['ID варіанту']) === String(vid)) : null; }
function seasonEnded_(p) { const e = p['Кінець продажу']; return e instanceof Date && dayStart_(new Date()) > dayStart_(e); }
function variantLabel_(v) {
  if (!v) return '';
  return [v['Аромат'], v['Колір воску'], v['Розмір'], v['Ґніт'] ? 'ґніт: ' + String(v['Ґніт']).toLowerCase() : ''].filter(x => x !== '' && x !== null && x !== undefined).join(' · ');
}
function itemName_(p, v) { return String(p['Назва']) + (v ? ' (' + variantLabel_(v) + ')' : ''); }
function isWholesale_(client) { return client && bool_(client['Опт погоджено']); }
function priceOf_(client, p, v) {
  const src = v || p;
  const retail = num_(src['Ціна']) || num_(p['Ціна']);
  const opt = num_(src['Оптова ціна']) || (v ? 0 : 0);
  return isWholesale_(client) && opt > 0 ? opt : retail;
}
function aromaOf_(p, v) { return String((v && v['Аромат']) || p['Аромат'] || ''); }
function volumeOf_(p, v) { return String((v && v['Розмір']) || p['Обʼєм'] || ''); }

/** Чи можна купити і як: у наявності / під замовлення / передзамовлення. */
function avail_(p, v, qty) {
  qty = qty || 1;
  if (!p || !bool_(p['Активний']) || seasonEnded_(p)) return { ok: false, label: 'Немає в продажу' };
  const now = new Date();
  const start = p['Старт продажу'];
  let days = Math.round(num_(p['Днів виготовлення'])) || Math.round(N_('Днів виготовлення за замовчуванням'));
  if (start instanceof Date && dayStart_(now) < dayStart_(start)) {
    const d = Math.max(days, daysBetween_(now, start));
    return { ok: true, mto: true, days: d, pre: true, label: '⏳ Передзамовлення, продаж з ' + fdate_(start) };
  }
  const stock = v ? v['Залишок'] : p['Залишок'];
  const unlimited = stock === '' || stock === null || stock === undefined;
  if (unlimited || num_(stock) >= qty) return { ok: true, mto: false, days: 0, label: '✅ В наявності' + (unlimited ? '' : ' (' + num_(stock) + ' шт.)') };
  if (bool_(p['Під замовлення'])) return { ok: true, mto: true, days: days, label: '🕯 Під замовлення, ' + days + ' дн.' };
  return { ok: false, label: '❌ Немає в наявності' };
}

/* ============================ КАТАЛОГ ============================ */

function catalog_(ctx) {
  const ps = products_();
  const rows = CATS.map((c, i) => [c, i]).filter(x => ps.some(p => p['Категорія'] === x[0])).map(x => [b_(x[0], 'c:' + x[1])]);
  rows.push([b_('🎁 Зібрати свій набір', 'set'), b_('🧺 Кошик', 'cart')]);
  return show_(ctx, '<b>Каталог ' + esc_(brand_()) + '</b>\nОберіть категорію:' + (isWholesale_(ctx.client) ? '\n\n💼 Вам показуються оптові ціни.' : ''), rows);
}

function categoryList_(ctx, ci) {
  const cat = CATS[ci];
  const ps = products_().filter(p => p['Категорія'] === cat);
  if (!ps.length) return show_(ctx, 'У цій категорії поки порожньо.', [[b_('⬅️ Каталог', 'cat')]]);
  const rows = ps.map(p => {
    const vs = variants_(p['ID']);
    const prices = vs.length ? vs.map(v => priceOf_(ctx.client, p, v)) : [priceOf_(ctx.client, p, null)];
    const min = Math.min.apply(null, prices);
    return [b_(p['Назва'] + ' — ' + (vs.length > 1 && prices.some(x => x !== min) ? 'від ' : '') + money_(min), 'p:' + p['ID'])];
  });
  rows.push([b_('⬅️ Каталог', 'cat')]);
  return show_(ctx, '<b>' + esc_(cat) + '</b>', rows);
}

function photos_(p) {
  return String(p['Фото'] || '').split(/[;\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
}

function productText_(ctx, p, v) {
  const a = avail_(p, v, 1);
  const lines = ['<b>' + esc_(p['Назва']) + '</b>'];
  if (v) lines.push(esc_(variantLabel_(v)));
  if (p['Опис']) lines.push('', esc_(p['Опис']));
  lines.push('');
  const aroma = aromaOf_(p, v); if (aroma) lines.push('🌿 Аромат: ' + esc_(aroma));
  const vol = volumeOf_(p, v); if (vol) lines.push('🫙 Обʼєм: ' + esc_(vol));
  if (num_(p['Час горіння, год'])) lines.push('🔥 Горіння: ≈ ' + num_(p['Час горіння, год']) + ' год');
  lines.push('💰 Ціна: <b>' + money_(priceOf_(ctx.client, p, v)) + '</b>' + (isWholesale_(ctx.client) ? ' (опт)' : ''));
  lines.push(a.label);
  return lines.join('\n');
}

function productCard_(ctx, pid) {
  const p = product_(pid);
  if (!p) return answer_(ctx, 'Товар не знайдено');
  const vs = variants_(pid);
  const ci = CATS.indexOf(String(p['Категорія']));
  const rows = [];
  if (vs.length) {
    vs.forEach(v => rows.push([b_(variantLabel_(v) + ' — ' + money_(priceOf_(ctx.client, p, v)), 'pv:' + pid + ':' + v['ID варіанту'])]));
  } else if (avail_(p, null, 1).ok) {
    rows.push([b_('➕ У кошик', 'add:' + pid + ':')]);
  }
  rows.push([b_('⬅️ ' + (CATS[ci] || 'Каталог'), ci >= 0 ? 'c:' + ci : 'cat'), b_('🧺 Кошик', 'cart')]);
  const text = productText_(ctx, p, null) + (vs.length ? '\n\nОберіть варіант:' : '');
  sendProduct_(ctx, p, text, rows);
}

function variantCard_(ctx, pid, vid) {
  const p = product_(pid), v = variant_(vid);
  if (!p || !v) return answer_(ctx, 'Варіант не знайдено');
  const rows = [];
  if (avail_(p, v, 1).ok) rows.push([b_('➕ У кошик', 'add:' + pid + ':' + vid)]);
  rows.push([b_('⬅️ Інші варіанти', 'p:' + pid), b_('🧺 Кошик', 'cart')]);
  show_(ctx, productText_(ctx, p, v), rows);
}

function sendProduct_(ctx, p, text, rows) {
  const ph = photos_(p);
  if (ctx.cb && ctx.cb.message) del_(ctx.chat, ctx.cb.message.message_id);
  if (ph.length === 1 && text.length <= 1000) return photo_(ctx.chat, ph[0], text, rows);
  if (ph.length > 1) tg_('sendMediaGroup', { chat_id: ctx.chat, media: ph.map(x => ({ type: 'photo', media: x })) });
  return send_(ctx.chat, text, rows);
}

function attachProductPhoto_(ctx, m) {
  const id = m.caption.trim().split(/\s+/)[1];
  const p = product_(id);
  if (!p) return send_(ctx.chat, 'Товар ' + esc_(id) + ' не знайдено в аркуші «Товари».');
  const fileId = m.photo[m.photo.length - 1].file_id;
  const list = photos_(p).concat([fileId]).slice(-3);
  update_('Товари', p._row, { 'Фото': list.join(';') });
  log_('INFO', staffName_(ctx), 'фото товару', id);
  return send_(ctx.chat, '✅ Фото додано до «' + esc_(p['Назва']) + '» (' + list.length + '/3).');
}

/* ============================ КОШИК ============================ */

function cartGet_(client) { try { return JSON.parse(client['Кошик'] || '[]') || []; } catch (e) { return []; } }
function cartSave_(ctx, cart) {
  const c = find_('Клієнти', 'TG_ID', ctx.from.id);
  update_('Клієнти', c._row, { 'Кошик': cart.length ? JSON.stringify(cart) : '', 'Кошик оновлено': cart.length ? new Date() : '', 'Етап нагадування': 0 });
  ctx.client = find_('Клієнти', 'TG_ID', ctx.from.id);
}

function addToCart_(ctx, item) {
  const cart = cartGet_(ctx.client);
  const same = cart.find(x => !x.s && x.p === item.p && (x.v || '') === (item.v || ''));
  if (same) same.q += item.q; else cart.push(item);
  cartSave_(ctx, cart);
  answer_(ctx, '✅ Додано в кошик');
  return send_(ctx.chat, '✅ Додано в кошик.', [[b_('🧺 Перейти в кошик', 'cart'), b_('🛍 Продовжити покупки', 'cat')]]);
}

/** Перетворює кошик на рядки з актуальними цінами й наявністю. */
function cartLines_(client) {
  const disc = N_('Знижка на набір, %');
  const lines = [];
  cartGet_(client).forEach((it, i) => {
    const q = Math.max(1, Math.round(it.q || 1));
    if (it.s) {
      const cp = product_(it.c[0]), cv = variant_(it.c[1]), hp = product_(it.h[0]), hv = variant_(it.h[1]);
      if (!cp || !hp) return;
      const ca = avail_(cp, cv, q), ha = avail_(hp, hv, q);
      const base = priceOf_(client, cp, cv) + priceOf_(client, hp, hv);
      const d = Math.round(base * disc / 100);
      const pk = PACKS.indexOf(it.pk) >= 0 ? it.pk : PACKS[0];
      const packPrice = N_('Пакування ' + pk + ', грн');
      lines.push({
        i: i, set: true, q: q, it: it, name: 'Набір: ' + itemName_(cp, cv) + ' + ' + itemName_(hp, hv) + ' · ' + pk,
        unit: base - d + packPrice, setDisc: d * q, ok: ca.ok && ha.ok, mto: !!ca.mto || !!ha.mto, days: Math.max(ca.days || 0, ha.days || 0),
        parts: [{ p: cp, v: cv, a: ca, price: priceOf_(client, cp, cv) }, { p: hp, v: hv, a: ha, price: priceOf_(client, hp, hv) }], pack: pk
      });
    } else {
      const p = product_(it.p), v = variant_(it.v);
      if (!p) return;
      const a = avail_(p, v, q);
      lines.push({ i: i, set: false, q: q, it: it, p: p, v: v, a: a, name: itemName_(p, v), unit: priceOf_(client, p, v), setDisc: 0, ok: a.ok, mto: !!a.mto, days: a.days || 0 });
    }
  });
  lines.forEach(l => { l.sum = l.unit * l.q; });
  return lines;
}

function showCart_(ctx) {
  const lines = cartLines_(ctx.client);
  if (!lines.length) return show_(ctx, '🧺 Кошик порожній.', [[b_('🛍 До каталогу', 'cat'), b_('🎁 Зібрати набір', 'set')]]);
  let total = 0;
  const txt = ['<b>🧺 Ваш кошик</b>', ''];
  const rows = [];
  lines.forEach((l, n) => {
    total += l.ok ? l.sum : 0;
    txt.push((n + 1) + '. ' + esc_(l.name) + '\n   ' + l.q + ' × ' + money_(l.unit) + ' = <b>' + money_(l.sum) + '</b>' +
      (l.ok ? (l.mto ? '  🕯 під замовлення ' + l.days + ' дн.' : '') : '  ❌ недоступно'));
    rows.push([b_('➖', 'ci:' + l.i + ':-1'), b_((n + 1) + '. ' + l.q + ' шт', 'cart'), b_('➕', 'ci:' + l.i + ':1'), b_('🗑', 'ci:' + l.i + ':0')]);
  });
  txt.push('', 'Разом: <b>' + money_(total) + '</b>');
  if (lines.some(l => l.set)) txt.push('🎁 Знижка на набори вже врахована.');
  rows.push([b_('✅ Оформити замовлення', 'co')]);
  rows.push([b_('🛍 Продовжити покупки', 'cat'), b_('🧹 Очистити', 'cclr')]);
  return show_(ctx, txt.join('\n'), rows);
}

function cartQty_(ctx, i, d) {
  const cart = cartGet_(ctx.client);
  if (!cart[i]) return showCart_(ctx);
  if (d === 0) cart.splice(i, 1);
  else { cart[i].q = Math.max(0, (cart[i].q || 1) + d); if (!cart[i].q) cart.splice(i, 1); }
  cartSave_(ctx, cart);
  return showCart_(ctx);
}
function cartClear_(ctx) { cartSave_(ctx, []); return showCart_(ctx); }

/* ============================ КОНСТРУКТОР НАБОРУ ============================ */

function setStart_(ctx) {
  const candles = products_().filter(p => (p['Категорія'] === 'Свічки' || p['Категорія'] === 'Сезонна колекція'));
  const rows = candles.filter(p => variants_(p['ID']).length || avail_(p, null, 1).ok)
    .map(p => [b_('🕯 ' + p['Назва'], 'scp:' + p['ID'])]);
  if (!rows.length) return show_(ctx, 'Зараз немає свічок для набору.', [[b_('⬅️ Каталог', 'cat')]]);
  rows.push([b_('⬅️ Каталог', 'cat')]);
  tmpPut_('set' + ctx.chat, {});
  return show_(ctx, '<b>🎁 Конструктор набору</b>\nКрок 1 з 3: оберіть свічку.\n\nНа свічку + підсвічник діє знижка <b>' + N_('Знижка на набір, %') + '%</b>.', rows);
}
function setCandleVariants_(ctx, pid) {
  const p = product_(pid); const vs = variants_(pid);
  if (!vs.length) return setPickCandle_(ctx, pid, '');
  const rows = vs.filter(v => avail_(p, v, 1).ok).map(v => [b_(variantLabel_(v) + ' — ' + money_(priceOf_(ctx.client, p, v)), 'sc:' + pid + ':' + v['ID варіанту'])]);
  rows.push([b_('⬅️ Назад', 'set')]);
  return show_(ctx, '<b>' + esc_(p['Назва']) + '</b>\nОберіть варіант:', rows);
}
function setPickCandle_(ctx, pid, vid) {
  const s = tmpGet_('set' + ctx.chat) || {};
  s.c = [pid, vid];
  tmpPut_('set' + ctx.chat, s);
  const holders = products_().filter(p => p['Категорія'] === 'Підсвічники' && (variants_(p['ID']).length || avail_(p, null, 1).ok));
  const rows = holders.map(p => [b_('🏺 ' + p['Назва'] + ' — ' + money_(priceOf_(ctx.client, p, null)), 'shp:' + p['ID'])]);
  if (!rows.length) return show_(ctx, 'На жаль, підсвічників зараз немає в наявності.', [[b_('⬅️ Каталог', 'cat')]]);
  rows.push([b_('⬅️ Назад', 'set')]);
  return show_(ctx, 'Крок 2 з 3: оберіть підсвічник.', rows);
}
function setHolderVariants_(ctx, pid) {
  const p = product_(pid); const vs = variants_(pid);
  if (!vs.length) return setPickHolder_(ctx, pid, '');
  const rows = vs.filter(v => avail_(p, v, 1).ok).map(v => [b_(variantLabel_(v) + ' — ' + money_(priceOf_(ctx.client, p, v)), 'sh:' + pid + ':' + v['ID варіанту'])]);
  rows.push([b_('⬅️ Назад', 'set')]);
  return show_(ctx, '<b>' + esc_(p['Назва']) + '</b>\nОберіть варіант:', rows);
}
function setPickHolder_(ctx, pid, vid) {
  const s = tmpGet_('set' + ctx.chat) || {};
  if (!s.c) return setStart_(ctx);
  s.h = [pid, vid];
  tmpPut_('set' + ctx.chat, s);
  const rows = PACKS.map((pk, i) => [b_(pk + ' — ' + (N_('Пакування ' + pk + ', грн') ? money_(N_('Пакування ' + pk + ', грн')) : 'безкоштовно'), 'sp:' + i)]);
  return show_(ctx, 'Крок 3 з 3: оберіть пакування набору.', rows);
}
function setPickPack_(ctx, i) {
  const s = tmpGet_('set' + ctx.chat) || {};
  if (!s.c || !s.h) return setStart_(ctx);
  const item = { s: 1, c: s.c, h: s.h, pk: PACKS[i] || PACKS[0], q: 1 };
  const cart = cartGet_(ctx.client);
  cart.push(item);
  cartSave_(ctx, cart);
  const line = cartLines_(ctx.client).slice(-1)[0];
  return show_(ctx, '✅ Набір додано в кошик:\n' + esc_(line.name) + '\n\nЦіна набору: <b>' + money_(line.unit) + '</b> (економія ' + money_(line.setDisc) + ')',
    [[b_('🧺 Кошик', 'cart'), b_('🎁 Ще набір', 'set')]]);
}

/* ============================ ДІАЛОГИ (ТЕКСТ) ============================ */

function onState_(ctx, st, m) {
  const text = (m.text || '').trim();
  if (text === '/cancel' || text === 'Скасувати') { clearState_(ctx.chat); return send_(ctx.chat, 'Скасовано.', mainKeyboard_(ctx)); }
  const staffStates = ['packphoto', 'ttn', 'rawqty', 'probtext'];
  const ownerStates = ['bc', 'promo', 'team', 'setval', 'priceval', 'ptsval', 'reply'];
  if (staffStates.indexOf(st.s) >= 0 && !ctx.role) { clearState_(ctx.chat); return send_(ctx.chat, 'Немає доступу'); }
  if (ownerStates.indexOf(st.s) >= 0 && ctx.role !== 'owner') { clearState_(ctx.chat); return send_(ctx.chat, 'Немає доступу'); }
  switch (st.s) {
    case 'co': return checkoutText_(ctx, st, m);
    case 'ws': return wholesaleText_(ctx, st, m);
    case 'dt_name': case 'dt_date': case 'dt_me': return datesText_(ctx, st, text);
    case 'rv': return reviewText_(ctx, st, m);
    case 'contact': return contactText_(ctx, m);
    case 'packphoto': return packPhoto_(ctx, st, m);
    case 'ttn': return ttnManual_(ctx, st, text);
    case 'rawqty': return rawQty_(ctx, st, text);
    case 'probtext': return problemText_(ctx, text);
    case 'bc': return broadcastCollect_(ctx, st, m);
    case 'promo': return promoText_(ctx, st, text);
    case 'team': return teamText_(ctx, st, text);
    case 'setval': return settingText_(ctx, st, text);
    case 'priceval': return priceText_(ctx, st, text);
    case 'ptsval': return pointsAdjText_(ctx, st, text);
    case 'reply': return replyText_(ctx, st, m);
  }
  clearState_(ctx.chat);
  return send_(ctx.chat, 'Оберіть дію в меню 👇', mainKeyboard_(ctx));
}

/* ============================ ОФОРМЛЕННЯ ============================ */

function checkoutStart_(ctx) {
  const lines = cartLines_(ctx.client);
  if (!lines.length) return showCart_(ctx);
  if (lines.some(l => !l.ok)) return show_(ctx, 'У кошику є товари, яких зараз немає. Видаліть їх (🗑) і спробуйте ще раз.', [[b_('🧺 Кошик', 'cart')]]);
  setState_(ctx.chat, { s: 'co', step: 'dl', d: {} });
  return show_(ctx, '<b>Оформлення</b>\nЯк отримати замовлення?', [
    [b_('🚚 Нова Пошта', 'k:dl:np')],
    [b_('🏠 Самовивіз — ' + S_('Місто самовивозу'), 'k:dl:pk')],
    [b_('❌ Скасувати', 'k:x')]
  ]);
}

function co_(ctx) { const st = getState_(ctx.chat); return st && st.s === 'co' ? st : null; }
function coSave_(ctx, st) { setState_(ctx.chat, st); }

function checkoutCb_(ctx, p) {
  const st = co_(ctx);
  if (!st && p[0] !== 'x') return show_(ctx, 'Оформлення застаріло. Відкрийте кошик ще раз.', [[b_('🧺 Кошик', 'cart')]]);
  const d = st ? st.d : {};
  switch (p[0]) {
    case 'x': clearState_(ctx.chat); return show_(ctx, 'Оформлення скасовано. Кошик збережено.', [[b_('🧺 Кошик', 'cart')]]);
    case 'dl':
      if (p[1] === 'np') {
        if (!prop_('NP_API_KEY')) { d.delivery = 'Нова Пошта'; st.step = 'npman'; coSave_(ctx, st); return show_(ctx, 'Напишіть місто і номер відділення Нової Пошти (наприклад: Львів, 12):'); }
        d.delivery = 'Нова Пошта'; st.step = 'city'; coSave_(ctx, st);
        return show_(ctx, '🏙 Напишіть назву міста (наприклад, <i>Львів</i>):');
      }
      d.delivery = 'Самовивіз'; coSave_(ctx, st);
      return askGift_(ctx, st);
    case 'city': {
      const c = (d.cities || [])[+p[1]];
      if (!c) return show_(ctx, 'Оберіть місто ще раз.');
      d.city = c.name; d.cityRef = c.ref; st.step = 'wh'; coSave_(ctx, st);
      return show_(ctx, '📍 ' + esc_(c.name) + '\nНапишіть номер відділення або поштомату (або вулицю):');
    }
    case 'wh': {
      const w = (d.whs || [])[+p[1]];
      if (!w) return show_(ctx, 'Оберіть відділення ще раз.');
      d.wh = w.name; d.whRef = w.ref; coSave_(ctx, st);
      return askGift_(ctx, st);
    }
    case 'gift':
      d.gift = p[1] === '1'; coSave_(ctx, st);
      return askPack_(ctx);
    case 'pk':
      d.pack = +p[1] < PACKS.length ? PACKS[+p[1]] : 'Без пакування'; coSave_(ctx, st);
      if (d.gift) { st.step = 'card'; coSave_(ctx, st); return show_(ctx, '💌 Напишіть текст для листівки (до 300 символів):', [[b_('Без листівки', 'k:card:-')]]); }
      return askRecipient_(ctx, st);
    case 'card':
      d.card = ''; coSave_(ctx, st);
      return askNoReceipt_(ctx);
    case 'nr':
      d.noReceipt = p[1] === '1'; coSave_(ctx, st);
      return show_(ctx, 'Кому доставити?', [[b_('Мені', 'k:rc:me')], [b_('Одразу отримувачу (інші ПІБ і телефон)', 'k:rc:other')]]);
    case 'rc':
      if (p[1] === 'other') { d.other = true; st.step = 'rname'; coSave_(ctx, st); return show_(ctx, 'Прізвище та імʼя отримувача:'); }
      if (p[1] === 'saved') { d.name = String(ctx.client['ПІБ']); d.phone = String(ctx.client['Телефон']); coSave_(ctx, st); return askNeed_(ctx, st); }
      if (p[1] === 'new') { st.step = 'name'; coSave_(ctx, st); return show_(ctx, '👤 Ваші прізвище та імʼя (як у паспорті — для Нової Пошти):'); }
      d.other = false; coSave_(ctx, st);
      return askRecipient_(ctx, st);
    case 'need':
      d.need = ''; coSave_(ctx, st);
      return askPromo_(ctx, st);
    case 'needok': return askPromo_(ctx, st);
    case 'needre': st.step = 'need'; coSave_(ctx, st); return show_(ctx, 'Напишіть іншу дату ДД.ММ:', [[b_('Не важливо', 'k:need:-')]]);
    case 'promo':
      d.promo = ''; coSave_(ctx, st);
      return askPoints_(ctx, st);
    case 'pts':
      d.usePts = p[1] === '1'; coSave_(ctx, st);
      return askPay_(ctx, st);
    case 'pay':
      d.pay = p[1]; coSave_(ctx, st);
      return summary_(ctx, st);
    case 'ok': return createOrder_(ctx, st);
  }
}

function askGift_(ctx, st) {
  st.step = 'gift'; coSave_(ctx, st);
  return show_(ctx, '🎁 Це подарунок?', [[b_('Так, подарунок', 'k:gift:1'), b_('Ні, для себе', 'k:gift:0')]]);
}
function askPack_(ctx) {
  const rows = PACKS.map((pk, i) => [b_(pk + ' — ' + (N_('Пакування ' + pk + ', грн') ? money_(N_('Пакування ' + pk + ', грн')) : 'безкоштовно'), 'k:pk:' + i)]);
  rows.push([b_('Без пакування', 'k:pk:' + PACKS.length)]);
  return show_(ctx, '📦 Оберіть пакування замовлення:', rows);
}
function askNoReceipt_(ctx) {
  return show_(ctx, '🧾 Вкласти чек у посилку?', [[b_('Не вкладати чек', 'k:nr:1'), b_('Вкласти', 'k:nr:0')]]);
}
function askRecipient_(ctx, st) {
  if (ctx.client['ПІБ'] && ctx.client['Телефон']) {
    st.step = 'rcsaved'; coSave_(ctx, st);
    return show_(ctx, 'Отримувач: <b>' + esc_(ctx.client['ПІБ']) + '</b>, ' + esc_(ctx.client['Телефон']) + '?',
      [[b_('✅ Так, це я', 'k:rc:saved')], [b_('✏️ Ввести інші дані', 'k:rc:new')]]);
  }
  st.step = 'name'; coSave_(ctx, st);
  return show_(ctx, '👤 Ваші прізвище та імʼя (як у паспорті — для Нової Пошти):');
}
function askNeed_(ctx, st) {
  st.step = 'need'; coSave_(ctx, st);
  restoreKb_(ctx);
  return send_(ctx.chat, '📅 Потрібно до певної дати? Напишіть дату ДД.ММ (наприклад, 24.12) або пропустіть.', [[b_('Не важливо', 'k:need:-')]]);
}
function askPromo_(ctx, st) {
  st.step = 'promo'; coSave_(ctx, st);
  return show_(ctx, '🎟 Є промокод? Напишіть його або пропустіть.', [[b_('Без промокоду', 'k:promo:-')]]);
}
function askPoints_(ctx, st) {
  const t = totals_(ctx.client, st.d);
  const bal = Math.floor(num_(ctx.client['Бали']));
  if (bal > 0 && t.maxPts > 0) {
    st.step = 'pts'; coSave_(ctx, st);
    return show_(ctx, '⭐ У вас ' + bal + ' балів. Можна списати до <b>' + t.maxPts + '</b> (1 бал = 1 ₴).',
      [[b_('Списати ' + t.maxPts, 'k:pts:1'), b_('Не списувати', 'k:pts:0')]]);
  }
  st.d.usePts = false; coSave_(ctx, st);
  return askPay_(ctx, st);
}
function payOptions_(t, d) {
  const mono = !!prop_('MONO_TOKEN');
  const opts = [];
  if (t.hasMto) {
    if (mono) {
      opts.push(['mono', '💳 Оплатити повністю — ' + money_(t.due)]);
      opts.push(['adv', '💳 Аванс ' + N_('Аванс під замовлення, %') + '% — ' + money_(advance_(t.due))]);
    } else {
      opts.push(['man', '💳 Передоплата (реквізити надішле менеджер)']);
    }
  } else {
    if (mono) opts.push(['mono', '💳 Карткою / Apple Pay / Google Pay — ' + money_(t.due)]);
    if (yes_('Накладений платіж')) opts.push(['cod', d.delivery === 'Самовивіз' ? '💵 Оплата при самовивозі' : '💵 Накладений платіж (оплата у відділенні)']);
    if (!opts.length) opts.push(['man', '💳 Передоплата (реквізити надішле менеджер)']);
  }
  return opts;
}
function advance_(due) { return Math.ceil(due * N_('Аванс під замовлення, %') / 100); }
function askPay_(ctx, st) {
  const t = totals_(ctx.client, st.d);
  st.step = 'pay'; coSave_(ctx, st);
  const rows = payOptions_(t, st.d).map(o => [b_(o[1], 'k:pay:' + o[0])]);
  const note = t.hasMto ? '\n\nУ замовленні є вироби під замовлення — для них потрібна передоплата або аванс.' : '';
  return show_(ctx, '💳 Як оплатити?' + note, rows);
}
function restoreKb_(ctx) { /* повертає звичайну клавіатуру після кнопки «надіслати номер» */
  if (ctx.msg && ctx.msg.contact) send_(ctx.chat, '👍', mainKeyboard_(ctx));
}

function checkoutText_(ctx, st, m) {
  const d = st.d;
  const text = (m.text || '').trim();
  switch (st.step) {
    case 'npman': {
      d.city = text; d.cityRef = ''; d.wh = text; d.whRef = ''; coSave_(ctx, st);
      return askGift_(ctx, st);
    }
    case 'city': {
      if (text.length < 2) return send_(ctx.chat, 'Напишіть назву міста.');
      let list = [];
      try { list = npCities_(text); } catch (e) { logErr_('НП пошук міста', e); }
      if (!list.length) return send_(ctx.chat, 'Не знайшли таке місто. Спробуйте інакше (без «м.»).');
      d.cities = list; coSave_(ctx, st);
      return send_(ctx.chat, 'Оберіть місто:', list.map((c, i) => [b_(c.name, 'k:city:' + i)]));
    }
    case 'wh': {
      let list = [];
      try { list = npWarehouses_(d.cityRef, text); } catch (e) { logErr_('НП відділення', e); }
      if (!list.length) return send_(ctx.chat, 'Не знайшли відділення. Напишіть лише номер, наприклад <b>12</b>.');
      d.whs = list; coSave_(ctx, st);
      return send_(ctx.chat, 'Оберіть відділення:', list.map((w, i) => [b_(w.name.slice(0, 60), 'k:wh:' + i)]));
    }
    case 'card': {
      d.card = text.slice(0, 300); coSave_(ctx, st);
      return askNoReceipt_(ctx);
    }
    case 'rname': {
      if (text.split(/\s+/).length < 2) return send_(ctx.chat, 'Напишіть прізвище та імʼя отримувача (два слова).');
      d.name = text; st.step = 'rphone'; coSave_(ctx, st);
      return send_(ctx.chat, '📱 Телефон отримувача (наприклад, 0671234567):');
    }
    case 'rphone': {
      const ph = phone_(text);
      if (!ph) return send_(ctx.chat, 'Номер не схожий на український. Приклад: 0671234567');
      d.phone = ph; coSave_(ctx, st);
      if (!ctx.client['Телефон']) { st.step = 'myphone'; coSave_(ctx, st); return askPhone_(ctx, 'А тепер ваш телефон для звʼязку:'); }
      return askNeed_(ctx, st);
    }
    case 'name': {
      if (text.split(/\s+/).length < 2) return send_(ctx.chat, 'Напишіть прізвище та імʼя (два слова).');
      d.name = text; st.step = 'phone'; coSave_(ctx, st);
      return askPhone_(ctx, '📱 Ваш телефон:');
    }
    case 'phone': case 'myphone': {
      const ph = phone_(m.contact ? m.contact.phone_number : text);
      if (!ph) return send_(ctx.chat, 'Номер не схожий на український. Приклад: 0671234567');
      if (st.step === 'phone') d.phone = ph;
      const c = find_('Клієнти', 'TG_ID', ctx.from.id);
      const upd = { 'Телефон': ph };
      if (st.step === 'phone') upd['ПІБ'] = d.name;
      update_('Клієнти', c._row, upd);
      ctx.client = find_('Клієнти', 'TG_ID', ctx.from.id);
      return askNeed_(ctx, st);
    }
    case 'need': {
      const dt = parseDate_(text);
      if (!dt) return send_(ctx.chat, 'Формат дати: ДД.ММ, наприклад 24.12', [[b_('Не важливо', 'k:need:-')]]);
      d.need = dt.getTime(); coSave_(ctx, st);
      const t = totals_(ctx.client, d);
      const earliest = earliest_(t, d);
      if (dayStart_(dt) < dayStart_(earliest)) {
        return send_(ctx.chat, '⚠️ Можемо не встигнути: найраніше замовлення буде у вас ≈ <b>' + fdate_(earliest) + '</b>' +
          (t.hasMto ? ' (є вироби під замовлення: ' + t.maxDays + ' дн. + визрівання)' : '') + '.\n\nПродовжити чи змінити дату?',
          [[b_('Продовжити', 'k:needok')], [b_('Ввести іншу дату', 'k:needre')]]);
      }
      return askPromo_(ctx, st);
    }
    case 'promo': {
      const t = totals_(ctx.client, Object.assign({}, d, { promo: text.toUpperCase() }));
      if (t.promoErr) return send_(ctx.chat, '❌ ' + t.promoErr, [[b_('Без промокоду', 'k:promo:-')]]);
      d.promo = text.toUpperCase(); coSave_(ctx, st);
      send_(ctx.chat, '✅ Промокод застосовано: −' + money_(t.promoDisc));
      return askPoints_(ctx, st);
    }
  }
  return send_(ctx.chat, 'Скористайтеся кнопками вище або напишіть /cancel');
}

function askPhone_(ctx, text) {
  return send_(ctx.chat, text, { keyboard: [[{ text: '📱 Надіслати мій номер', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
}

function earliest_(t, d) {
  let days = 0;
  if (t.hasMto) days += t.maxDays + Math.ceil(N_('Визрівання, год') / 24);
  if (d.delivery === 'Нова Пошта') days += Math.round(N_('Днів доставки НП'));
  return addDays_(dayStart_(new Date()), days);
}

/** Підрахунок суми замовлення. */
function totals_(client, d) {
  const lines = cartLines_(client).filter(l => l.ok);
  const goods = lines.reduce((s, l) => s + l.sum, 0);
  const setDisc = lines.reduce((s, l) => s + l.setDisc, 0);
  const hasMto = lines.some(l => l.mto);
  const maxDays = lines.reduce((s, l) => Math.max(s, l.mto ? l.days : 0), 0);
  let promoDisc = 0, promoErr = '';
  if (d.promo) {
    const pr = rows_('Промокоди').find(r => String(r['Код']).toUpperCase() === String(d.promo).toUpperCase());
    if (!pr || !bool_(pr['Активний'])) promoErr = 'Такого промокоду немає або він неактивний.';
    else if (pr['Діє до'] instanceof Date && dayStart_(new Date()) > dayStart_(pr['Діє до'])) promoErr = 'Термін дії промокоду минув.';
    else if (num_(pr['Ліміт']) && num_(pr['Використано']) >= num_(pr['Ліміт'])) promoErr = 'Ліміт використань промокоду вичерпано.';
    else if (num_(pr['Мін. сума']) && goods < num_(pr['Мін. сума'])) promoErr = 'Промокод діє від ' + money_(pr['Мін. сума']) + '.';
    else promoDisc = String(pr['Тип']) === '%' ? Math.round(goods * num_(pr['Значення']) / 100) : Math.min(goods, Math.round(num_(pr['Значення'])));
  }
  const after = goods - promoDisc;
  const maxPts = Math.max(0, Math.min(Math.floor(num_(client['Бали'])), Math.floor(after * N_('Оплата балами до, %') / 100)));
  const pts = d.usePts ? maxPts : 0;
  const pack = d.pack || 'Без пакування';
  const packPrice = PACKS.indexOf(pack) >= 0 ? N_('Пакування ' + pack + ', грн') : 0;
  const due = Math.max(0, after - pts + packPrice);
  return { lines: lines, goods: goods, setDisc: setDisc, hasMto: hasMto, maxDays: maxDays, promoDisc: promoDisc, promoErr: promoErr, maxPts: maxPts, pts: pts, pack: pack, packPrice: packPrice, due: due };
}

function summary_(ctx, st) {
  const d = st.d;
  const t = totals_(ctx.client, d);
  st.step = 'confirm'; coSave_(ctx, st);
  const L = ['<b>Перевірте замовлення</b>', ''];
  t.lines.forEach(l => L.push('• ' + esc_(l.name) + ' × ' + l.q + ' — ' + money_(l.sum) + (l.mto ? ' 🕯 ' + l.days + ' дн.' : '')));
  L.push('');
  L.push('🚚 ' + (d.delivery === 'Самовивіз' ? 'Самовивіз, ' + esc_(S_('Місто самовивозу')) : 'Нова Пошта: ' + esc_(d.city) + ', ' + esc_(d.wh)));
  L.push('👤 ' + esc_(d.name) + ', ' + esc_(d.phone));
  L.push('📦 Пакування: ' + esc_(t.pack) + (t.packPrice ? ' (' + money_(t.packPrice) + ')' : ''));
  if (d.gift) { L.push('🎁 Подарунок' + (d.noReceipt ? ', без чека' : '')); if (d.card) L.push('💌 Листівка: «' + esc_(d.card) + '»'); }
  if (d.need) L.push('📅 Потрібно до: ' + fdate_(new Date(d.need)));
  if (t.promoDisc) L.push('🎟 Промокод ' + esc_(d.promo) + ': −' + money_(t.promoDisc));
  if (t.pts) L.push('⭐ Бали: −' + money_(t.pts));
  L.push('', 'До сплати: <b>' + money_(t.due) + '</b>');
  if (d.pay === 'adv') L.push('Зараз аванс: <b>' + money_(advance_(t.due)) + '</b>, решта — накладеним платежем.');
  const payName = { mono: 'Картка / Apple Pay / Google Pay', adv: 'Аванс карткою', cod: d.delivery === 'Самовивіз' ? 'При самовивозі' : 'Накладений платіж', man: 'Передоплата за реквізитами' }[d.pay];
  L.push('💳 ' + payName);
  return show_(ctx, L.join('\n'), [[b_('✅ Підтвердити замовлення', 'k:ok')], [b_('❌ Скасувати', 'k:x')]]);
}

/* ============================ СТВОРЕННЯ ЗАМОВЛЕННЯ ============================ */

function createOrder_(ctx, st) {
  const d = st.d;
  if (!d.name || !d.phone || !d.pay) return show_(ctx, 'Бракує даних. Почніть оформлення ще раз.', [[b_('🧺 Кошик', 'cart')]]);
  let n, o, low = [];
  const lock = lock_();
  try {
    _memo = {}; _settings = null;
    ctx.client = find_('Клієнти', 'TG_ID', ctx.from.id);
    const t = totals_(ctx.client, d);
    if (!t.lines.length) { clearState_(ctx.chat); return show_(ctx, 'Кошик порожній.', [[b_('🛍 Каталог', 'cat')]]); }
    if (t.promoErr) d.promo = '';
    n = rows_('Замовлення').reduce((mx, r) => Math.max(mx, num_(r['№'])), 0) + 1;
    const pays = { mono: PAY.MONO, adv: PAY.ADV, cod: d.delivery === 'Самовивіз' ? PAY.PICKUP : PAY.COD, man: 'Передоплата' };
    const positions = [];
    let cost = 0, setNo = 0;
    t.lines.forEach(l => {
      if (l.set) {
        setNo++;
        const label = 'Н' + setNo + ' · ' + l.pack;
        const c = l.parts[0], h = l.parts[1];
        const cMto = takeStock_(c.p, c.v, l.q, low), hMto = takeStock_(h.p, h.v, l.q, low);
        const cCost = unitCost_(c.p, c.v) * l.q, hCost = (unitCost_(h.p, h.v) + N_('Собівартість ' + l.pack + ', грн')) * l.q;
        cost += cCost + hCost;
        positions.push(posRow_(n, 'Набір', c.p, c.v, l.q, l.unit, l.sum, cMto, label, cCost));
        positions.push(posRow_(n, 'Набір', h.p, h.v, l.q, 0, 0, hMto, label, hCost));
      } else {
        const mto = takeStock_(l.p, l.v, l.q, low);
        const c = unitCost_(l.p, l.v) * l.q;
        cost += c;
        positions.push(posRow_(n, 'Товар', l.p, l.v, l.q, l.unit, l.sum, mto, '', c));
      }
    });
    if (PACKS.indexOf(t.pack) >= 0) cost += N_('Собівартість ' + t.pack + ', грн');
    if (d.pay === 'mono' || d.pay === 'adv') cost += t.due * N_('Комісія еквайрингу, %') / 100;
    const now = new Date();
    o = {
      '№': n, 'Дата': now, 'TG_ID': String(ctx.from.id), 'Клієнт': String(ctx.client['Імʼя'] || ''), 'Телефон клієнта': String(ctx.client['Телефон'] || d.phone),
      'Статус': ST.NEW, 'Спосіб оплати': pays[d.pay], 'Статус оплати': (d.pay === 'cod') ? PAYST.COD : PAYST.WAIT,
      'Сума товарів': t.goods, 'Знижка набору': t.setDisc, 'Промокод': d.promo || '', 'Знижка промокоду': t.promoDisc, 'Бали списано': t.pts,
      'Пакування': t.pack, 'Ціна пакування': t.packPrice, 'Доставка': d.delivery, 'Отримувач': d.name, 'Телефон отримувача': d.phone,
      'Місто': d.city || '', 'Місто Ref': d.cityRef || '', 'Відділення': d.wh || '', 'Відділення Ref': d.whRef || '',
      'Потрібно до': d.need ? new Date(d.need) : '', 'Подарунок': d.gift ? 'Так' : 'Ні', 'Листівка': d.card || '', 'Без чека': d.noReceipt ? 'Так' : 'Ні',
      'До сплати': t.due, 'Сплачено': 0, 'Собівартість': Math.round(cost), 'Історія': fdt_(now) + ' — ' + ST.NEW + ' (клієнт)'
    };
    append_('Замовлення', o);
    positions.forEach(p => append_('Позиції', p));
    if (d.promo && t.promoDisc) {
      const pr = rows_('Промокоди').find(r => String(r['Код']).toUpperCase() === d.promo);
      if (pr) update_('Промокоди', pr._row, { 'Використано': num_(pr['Використано']) + 1 });
    }
    const c = find_('Клієнти', 'TG_ID', ctx.from.id);
    update_('Клієнти', c._row, { 'Бали': Math.max(0, num_(c['Бали']) - t.pts), 'Кошик': '', 'Кошик оновлено': '', 'Етап нагадування': 0 });
    const ab = rows_('Покинуті кошики').filter(r => String(r['TG_ID']) === String(ctx.from.id) && !r['Замовлення']).pop();
    if (ab) update_('Покинуті кошики', ab._row, { 'Замовлення': n });
  } finally {
    lock.releaseLock();
  }
  clearState_(ctx.chat);
  log_('INFO', ctx.from.id, 'нове замовлення', '№' + n + ' ' + money_(o['До сплати']));

  const order = orderByNo_(n);
  const rows = [[b_('📦 Мої замовлення', 'my')]];
  let payLine = '';
  if (o['Спосіб оплати'] === PAY.MONO || o['Спосіб оплати'] === PAY.ADV) {
    const amount = o['Спосіб оплати'] === PAY.ADV ? advance_(o['До сплати']) : o['До сплати'];
    const inv = invoiceFor_(order, amount);
    if (inv) { rows.unshift([u_('💳 Оплатити ' + money_(amount), inv.pageUrl)]); payLine = '\n\nОплатіть за посиланням нижче — після оплати прийде підтвердження.'; }
    else payLine = '\n\nПосилання на оплату надішлемо найближчим часом.';
  } else if (o['Спосіб оплати'] === 'Передоплата') {
    payLine = '\n\nМенеджер надішле реквізити для передоплати.';
  }
  show_(ctx, '✅ <b>Замовлення №' + n + ' прийнято!</b>\nСума: ' + money_(o['До сплати']) + payLine + '\n\nСтатус можна дивитися в «📦 Мої замовлення».', rows);
  send_(ctx.chat, 'Дякуємо! 🕯', mainKeyboard_(ctx));
  announceOrder_(orderByNo_(n));
  if (low.length) notifyOwners_('⚠️ <b>Низький залишок:</b>\n' + low.map(x => '• ' + esc_(x)).join('\n'));
}

function posRow_(n, type, p, v, q, unit, sum, mto, setLabel, cost) {
  return {
    '№ замовлення': n, 'Тип': type, 'ID товару': String(p['ID']), 'ID варіанту': v ? String(v['ID варіанту']) : '', 'Назва': itemName_(p, v),
    'Аромат': aromaOf_(p, v), 'Обʼєм': volumeOf_(p, v), 'Кількість': q, 'Ціна': unit, 'Сума': sum, 'Під замовлення': !!mto,
    'Набір': setLabel, 'Собівартість': Math.round(cost), 'Нагадано': false
  };
}

/** Списує готовий залишок. Повертає true, якщо позиція піде у виробництво. */
function takeStock_(p, v, q, low) {
  const a = avail_(p, v, q);
  if (a.mto) return true;
  const sheet = v ? 'Варіанти' : 'Товари';
  const row = v ? variant_(v['ID варіанту']) : product_(p['ID']);
  const stock = row['Залишок'];
  if (stock === '' || stock === null) return false; // безлімітний товар (сертифікат тощо)
  const left = num_(stock) - q;
  update_(sheet, row._row, { 'Залишок': left });
  if (left <= N_('Поріг залишку')) low.push(itemName_(p, v) + ': ' + left + ' шт.');
  return false;
}
function returnStock_(pid, vid, q) {
  const v = variant_(vid);
  const row = v || product_(pid);
  if (!row || row['Залишок'] === '' || row['Залишок'] === null) return;
  update_(v ? 'Варіанти' : 'Товари', row._row, { 'Залишок': num_(row['Залишок']) + q });
}

/** Собівартість одиниці: техкарта (варіанту або товару) × ціни сировини, або колонка «Собівартість». */
function techCard_(pid, vid) {
  let rows = vid ? rows_('Техкарти').filter(r => String(r['ID варіанту']) === String(vid)) : [];
  if (!rows.length) rows = rows_('Техкарти').filter(r => String(r['ID товару']) === String(pid) && !r['ID варіанту']);
  return rows;
}
function unitCost_(p, v) {
  const tc = techCard_(p['ID'], v ? v['ID варіанту'] : '');
  if (tc.length) {
    return tc.reduce((s, r) => {
      const raw = find_('Сировина', 'ID', r['ID сировини']);
      return s + (raw ? num_(raw['Ціна за одиницю']) * num_(r['Кількість']) : 0);
    }, 0);
  }
  return num_(p['Собівартість']);
}

function orderByNo_(n) { return find_('Замовлення', '№', n); }
function positionsOf_(n) { return rows_('Позиції').filter(r => String(r['№ замовлення']) === String(n)); }

/* ============================ MONOBANK ============================ */

function mono_(method, path, payload) {
  const opt = { method: method, headers: { 'X-Token': prop_('MONO_TOKEN') }, muteHttpExceptions: true, contentType: 'application/json' };
  if (payload) opt.payload = JSON.stringify(payload);
  const r = UrlFetchApp.fetch('https://api.monobank.ua' + path, opt);
  const j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300) throw new Error('monobank ' + r.getResponseCode() + ': ' + r.getContentText());
  return j;
}

function invoiceFor_(o, amount) {
  if (!prop_('MONO_TOKEN') || amount <= 0) return null;
  try {
    const url = prop_('WEBAPP_URL');
    const j = mono_('post', '/api/merchant/invoice/create', {
      amount: Math.round(amount * 100), ccy: 980,
      merchantPaymInfo: { reference: String(o['№']), destination: 'Замовлення №' + o['№'] + ' — ' + brand_() },
      redirectUrl: url + '?src=paid', webHookUrl: url + '?src=mono', validity: 86400
    });
    update_('Замовлення', o._row, { 'Invoice ID': j.invoiceId, 'Посилання оплати': j.pageUrl });
    return j;
  } catch (e) { logErr_('monobank інвойс №' + o['№'], e); return null; }
}

function monoWebhook_(body) {
  let j = {};
  try { j = JSON.parse(body || '{}'); } catch (e) { return; }
  if (!j.invoiceId) return;
  const o = find_('Замовлення', 'Invoice ID', j.invoiceId);
  if (!o) return log_('INFO', 'monobank', 'webhook', 'невідомий інвойс ' + j.invoiceId);
  let s;
  try { s = mono_('get', '/api/merchant/invoice/status?invoiceId=' + encodeURIComponent(j.invoiceId)); }
  catch (e) { return logErr_('monobank статус', e); }
  const lock = lock_();
  let changed = '';
  try {
    _memo = {};
    const cur = orderByNo_(o['№']);
    const done = PropertiesService.getScriptProperties().getProperty('inv_' + j.invoiceId);
    if (s.status === 'success' && !done && cur['Статус оплати'] !== PAYST.PAID) {
      const paid = num_(cur['Сплачено']) + (num_(s.finalAmount || s.amount) / 100);
      const st = paid >= num_(cur['До сплати']) - 0.01 ? PAYST.PAID : PAYST.ADV;
      if (!(st === PAYST.ADV && cur['Статус оплати'] === PAYST.ADV)) {
        update_('Замовлення', cur._row, { 'Сплачено': paid, 'Статус оплати': st });
        changed = st;
      }
    } else if ((s.status === 'failure' || s.status === 'expired') && cur['Статус оплати'] === PAYST.WAIT) {
      update_('Замовлення', cur._row, { 'Статус оплати': PAYST.FAIL });
      changed = PAYST.FAIL;
    }
  } finally { lock.releaseLock(); }
  if (!changed) return;
  if (changed !== PAYST.FAIL) PropertiesService.getScriptProperties().setProperty('inv_' + j.invoiceId, '1');
  const cur = orderByNo_(o['№']);
  log_('INFO', 'monobank', 'оплата №' + cur['№'], changed + ' ' + s.status);
  if (changed === PAYST.FAIL) {
    send_(cur['TG_ID'], '❗ Оплата замовлення №' + cur['№'] + ' не пройшла. Спробуйте ще раз:', [[b_('💳 Оплатити', 'pay:' + cur['№'])]]);
  } else {
    send_(cur['TG_ID'], '✅ Оплату замовлення №' + cur['№'] + ' отримано' + (changed === PAYST.ADV ? ' (аванс)' : '') + '. Дякуємо! 🕯');
    notifyOwners_('💳 Оплата №' + cur['№'] + ': <b>' + changed + '</b> — ' + money_(cur['Сплачено']), [[b_('Відкрити', 'a:o:' + cur['№'])]]);
    refreshCards_(cur['№']);
  }
}

function payAgain_(ctx, n) {
  const o = orderByNo_(n);
  if (!o || String(o['TG_ID']) !== String(ctx.from.id)) return answer_(ctx, 'Замовлення не знайдено');
  if (o['Статус оплати'] === PAYST.PAID || o['Статус'] === ST.CANC) return answer_(ctx, 'Оплата не потрібна');
  const amount = o['Спосіб оплати'] === PAY.ADV && !num_(o['Сплачено']) ? advance_(o['До сплати']) : num_(o['До сплати']) - num_(o['Сплачено']);
  const inv = invoiceFor_(o, amount);
  if (!inv) return send_(ctx.chat, 'Не вдалося створити оплату. Напишіть нам: ' + esc_(S_('Контакт для клієнтів')));
  update_('Замовлення', orderByNo_(n)._row, { 'Статус оплати': PAYST.WAIT });
  return send_(ctx.chat, 'Оплата замовлення №' + n + ':', [[u_('💳 Оплатити ' + money_(amount), inv.pageUrl)]]);
}

function monoRefund_(o) {
  if (!o['Invoice ID'] || !prop_('MONO_TOKEN')) return false;
  mono_('post', '/api/merchant/invoice/cancel', { invoiceId: String(o['Invoice ID']), amount: Math.round(num_(o['Сплачено']) * 100) });
  return true;
}

/* ============================ НОВА ПОШТА ============================ */

function np_(model, method, props) {
  const r = UrlFetchApp.fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ apiKey: prop_('NP_API_KEY'), modelName: model, calledMethod: method, methodProperties: props || {} })
  });
  const j = JSON.parse(r.getContentText() || '{}');
  if (!j.success) throw new Error('НП ' + method + ': ' + (j.errors || []).join('; '));
  return j.data || [];
}
function npCities_(q) {
  const d = np_('Address', 'searchSettlements', { CityName: q, Limit: '8', Page: '1' });
  return ((d[0] && d[0].Addresses) || []).filter(a => a.DeliveryCity).map(a => ({ name: a.Present, ref: a.DeliveryCity }));
}
function npWarehouses_(cityRef, q) {
  const d = np_('Address', 'getWarehouses', { CityRef: cityRef, FindByString: q, Limit: '10', Page: '1', Language: 'UA' });
  return d.map(w => ({ name: w.Description, ref: w.Ref }));
}

/** Запустіть вручну після заповнення «НП: місто/відділення/телефон відправника». */
function npSetupSender() {
  const s = np_('Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender', Page: '1' });
  if (!s.length) throw new Error('У кабінеті НП не знайдено відправника');
  const sender = s[0].Ref;
  const cp = np_('Counterparty', 'getCounterpartyContactPersons', { Ref: sender, Page: '1' });
  const city = npCities_(String(S_('НП: місто відправника')))[0];
  if (!city) throw new Error('Не знайдено місто відправника');
  const wh = npWarehouses_(city.ref, String(S_('НП: відділення відправника')))[0];
  if (!wh) throw new Error('Не знайдено відділення відправника');
  setSetting_('НП Ref: відправник', sender);
  setSetting_('НП Ref: контакт', cp[0] ? cp[0].Ref : '');
  setSetting_('НП Ref: місто', city.ref);
  setSetting_('НП Ref: адреса', wh.ref);
  if (cp[0] && cp[0].Phones && /380X+/.test(String(S_('НП: телефон відправника')))) setSetting_('НП: телефон відправника', phone_(cp[0].Phones));
  Logger.log('Готово: ' + city.name + ', ' + wh.name);
}

function npCreateTtn_(o) {
  if (!o['Місто Ref'] || !o['Відділення Ref']) throw new Error('немає кодів міста/відділення — введіть ТТН вручну');
  const names = String(o['Отримувач']).trim().split(/\s+/);
  const rc = np_('Counterparty', 'save', {
    FirstName: names[1] || names[0], MiddleName: names[2] || '', LastName: names[0], Phone: phone_(o['Телефон отримувача']), Email: '',
    CounterpartyType: 'PrivatePerson', CounterpartyProperty: 'Recipient'
  })[0];
  const contact = rc.ContactPerson && rc.ContactPerson.data && rc.ContactPerson.data[0] ? rc.ContactPerson.data[0].Ref : '';
  const rest = Math.max(0, num_(o['До сплати']) - num_(o['Сплачено']));
  const props = {
    PayerType: 'Recipient', PaymentMethod: 'Cash', DateTime: Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy'), CargoType: 'Parcel',
    Weight: String(N_('НП: вага посилки, кг') || 0.5), ServiceType: 'WarehouseWarehouse', SeatsAmount: '1',
    Description: String(S_('НП: опис вантажу')), Cost: String(Math.max(200, Math.round(num_(o['До сплати'])))),
    CitySender: S_('НП Ref: місто'), Sender: S_('НП Ref: відправник'), SenderAddress: S_('НП Ref: адреса'), ContactSender: S_('НП Ref: контакт'),
    SendersPhone: phone_(S_('НП: телефон відправника')),
    CityRecipient: o['Місто Ref'], Recipient: rc.Ref, RecipientAddress: o['Відділення Ref'], ContactRecipient: contact, RecipientsPhone: phone_(o['Телефон отримувача'])
  };
  if (!props.Sender || !props.SenderAddress) throw new Error('не налаштований відправник — запустіть npSetupSender');
  if (rest > 0 && o['Статус оплати'] !== PAYST.PAID) props.BackwardDeliveryData = [{ PayerType: 'Recipient', CargoType: 'Money', RedeliveryString: String(Math.round(rest)) }];
  const doc = np_('InternetDocument', 'save', props)[0];
  return doc.IntDocNumber;
}

function npTrack_(items) {
  const out = {};
  for (let i = 0; i < items.length; i += 90) {
    const docs = items.slice(i, i + 90).map(x => ({ DocumentNumber: String(x.ttn), Phone: phone_(x.phone) }));
    np_('TrackingDocument', 'getStatusDocuments', { Documents: docs }).forEach(d => { out[String(d.Number)] = { code: String(d.StatusCode), text: d.Status }; });
  }
  return out;
}
function trackUrl_(ttn) { return 'https://novaposhta.ua/tracking/?cargo_number=' + encodeURIComponent(ttn); }

/* ============================ МОЇ ЗАМОВЛЕННЯ ============================ */

const ST_ICON = {};
ST_ICON[ST.NEW] = '🆕'; ST_ICON[ST.CONF] = '✅'; ST_ICON[ST.PROD] = '🕯'; ST_ICON[ST.READY] = '📦';
ST_ICON[ST.SENT] = '🚚'; ST_ICON[ST.RECV] = '🏠'; ST_ICON[ST.DONE] = '🏁'; ST_ICON[ST.CANC] = '❌';

function myOrders_(ctx) {
  const list = rows_('Замовлення').filter(o => String(o['TG_ID']) === String(ctx.from.id)).sort((a, b) => num_(b['№']) - num_(a['№'])).slice(0, 10);
  if (!list.length) return show_(ctx, 'У вас ще немає замовлень.', [[b_('🛍 Каталог', 'cat')]]);
  const rows = list.map(o => [b_((ST_ICON[o['Статус']] || '') + ' №' + o['№'] + ' · ' + fdate_(o['Дата']) + ' · ' + money_(o['До сплати']), 'mo:' + o['№'])]);
  return show_(ctx, '<b>📦 Ваші замовлення</b>', rows);
}

function myOrder_(ctx, n) {
  const o = orderByNo_(n);
  if (!o || String(o['TG_ID']) !== String(ctx.from.id)) return answer_(ctx, 'Замовлення не знайдено');
  const L = ['<b>Замовлення №' + n + '</b> від ' + fdate_(o['Дата']), 'Статус: ' + (ST_ICON[o['Статус']] || '') + ' <b>' + esc_(o['Статус']) + '</b>', ''];
  positionsOf_(n).filter(p => num_(p['Ціна']) > 0 || !p['Набір']).forEach(p => L.push('• ' + esc_(p['Назва']) + ' × ' + num_(p['Кількість'])));
  positionsOf_(n).filter(p => p['Набір'] && !num_(p['Ціна'])).forEach(p => L.push('   + ' + esc_(p['Назва'])));
  L.push('', 'Сума: <b>' + money_(o['До сплати']) + '</b> · оплата: ' + esc_(o['Статус оплати']));
  L.push(o['Доставка'] === 'Самовивіз' ? '🏠 Самовивіз: ' + esc_(S_('Місто самовивозу')) : '🚚 ' + esc_(o['Місто']) + ', ' + esc_(o['Відділення']));
  const rows = [];
  if (o['ТТН']) { L.push('ТТН: <code>' + esc_(o['ТТН']) + '</code>' + (o['Статус НП'] ? ' — ' + esc_(o['Статус НП']) : '')); rows.push([u_('📍 Відстежити посилку', trackUrl_(o['ТТН']))]); }
  if ((o['Статус оплати'] === PAYST.WAIT || o['Статус оплати'] === PAYST.FAIL || (o['Статус оплати'] === PAYST.ADV && o['Доставка'] === 'Самовивіз'))
    && o['Статус'] !== ST.CANC && (o['Спосіб оплати'] === PAY.MONO || o['Спосіб оплати'] === PAY.ADV)) rows.push([b_('💳 Оплатити', 'pay:' + n)]);
  rows.push([b_('🔁 Повторити замовлення', 'rep:' + n)]);
  rows.push([b_('⬅️ Усі замовлення', 'my')]);
  return show_(ctx, L.join('\n'), rows);
}

function repeatOrder_(ctx, n) {
  const o = orderByNo_(n);
  if (!o || String(o['TG_ID']) !== String(ctx.from.id)) return answer_(ctx, 'Замовлення не знайдено');
  const cart = cartGet_(ctx.client);
  const sets = {};
  let added = 0, skipped = 0;
  positionsOf_(n).forEach(p => {
    const prod = product_(p['ID товару']), v = variant_(p['ID варіанту']);
    if (!p['Набір']) {
      if (prod && avail_(prod, v, 1).ok) { cart.push({ p: String(p['ID товару']), v: String(p['ID варіанту'] || ''), q: num_(p['Кількість']) || 1 }); added++; } else skipped++;
    } else {
      const k = String(p['Набір']);
      sets[k] = sets[k] || { q: num_(p['Кількість']) || 1, pk: k.split(' · ')[1] || PACKS[0] };
      if (num_(p['Ціна']) > 0) sets[k].c = [String(p['ID товару']), String(p['ID варіанту'] || '')]; else sets[k].h = [String(p['ID товару']), String(p['ID варіанту'] || '')];
    }
  });
  Object.keys(sets).forEach(k => {
    const s = sets[k];
    if (s.c && s.h && product_(s.c[0]) && product_(s.h[0]) && avail_(product_(s.c[0]), variant_(s.c[1]), 1).ok && avail_(product_(s.h[0]), variant_(s.h[1]), 1).ok) {
      cart.push({ s: 1, c: s.c, h: s.h, pk: s.pk, q: s.q }); added++;
    } else skipped++;
  });
  cartSave_(ctx, cart);
  answer_(ctx, added ? 'Додано в кошик' : 'Немає доступних товарів');
  if (skipped) send_(ctx.chat, 'Деяких товарів зараз немає — їх не додано.');
  return showCart_(ctx);
}

/* ============================ БАЛИ І ДРУЗІ ============================ */

function points_(ctx) {
  const c = find_('Клієнти', 'TG_ID', ctx.from.id);
  const link = 'https://t.me/' + botName_() + '?start=ref_' + ctx.from.id;
  const txt = ['<b>⭐ Ваші бали: ' + Math.floor(num_(c['Бали'])) + '</b>', '',
    '• Кешбек <b>' + N_('Кешбек, %') + '%</b> балами після отримання замовлення.',
    '• Балами можна оплатити до <b>' + N_('Оплата балами до, %') + '%</b> суми. 1 бал = 1 ₴.',
    '• За фото свічки в інтерʼєрі у відгуку — <b>+' + N_('Бонус за фото-відгук, балів') + '</b> балів.', '',
    '<b>👭 Запросіть друга</b>', 'Після першої покупки друга ви обоє отримаєте по <b>' + N_('Реферальний бонус, балів') + '</b> балів.',
    'Ваше посилання:', '<code>' + link + '</code>'];
  return show_(ctx, txt.join('\n'), [[u_('📤 Поділитися', 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Свічки ручної роботи ' + brand_() + ' 🕯'))]]);
}

/* ============================ ДАТИ БЛИЗЬКИХ ============================ */

const REASONS = ['День народження', 'Річниця', 'Іменини', 'Інше свято'];

function dates_(ctx) {
  const list = rows_('Дати клієнтів').filter(r => String(r['TG_ID']) === String(ctx.from.id));
  const c = find_('Клієнти', 'TG_ID', ctx.from.id);
  const L = ['<b>🎂 Дати близьких</b>', 'Нагадаємо за ' + N_('Нагадувати про дати за, днів') + ' днів і підберемо подарунок.', ''];
  if (!list.length) L.push('Поки немає жодної дати.');
  const rows = [];
  list.forEach(r => { L.push('• ' + esc_(r['Імʼя близького']) + ' — ' + esc_(r['Дата']) + ' (' + esc_(r['Привід']) + ')'); rows.push([b_('🗑 ' + r['Імʼя близького'] + ' ' + r['Дата'], 'dtdel:' + r._row)]); });
  L.push('', 'Ваш день народження: ' + (c['Мій день народження'] ? esc_(c['Мій день народження']) : 'не вказано'));
  rows.unshift([b_('➕ Додати дату', 'dtadd'), b_('🎈 Мій день народження', 'dtme')]);
  return show_(ctx, L.join('\n'), rows);
}
function dateAddStart_(ctx) {
  setState_(ctx.chat, { s: 'dt_name' });
  return send_(ctx.chat, 'Як звати людину? (наприклад, «Мама» або «Оля»)');
}
function datesText_(ctx, st, text) {
  if (st.s === 'dt_me') {
    const d = parseDate_(text);
    if (!d) return send_(ctx.chat, 'Формат: ДД.ММ, наприклад 14.03');
    const c = find_('Клієнти', 'TG_ID', ctx.from.id);
    update_('Клієнти', c._row, { 'Мій день народження': Utilities.formatDate(d, TZ, 'dd.MM') });
    clearState_(ctx.chat);
    send_(ctx.chat, '🎈 Збережено!');
    return dates_(ctx);
  }
  if (st.s === 'dt_name') {
    if (!text) return send_(ctx.chat, 'Напишіть імʼя.');
    setState_(ctx.chat, { s: 'dt_date', name: text.slice(0, 40) });
    return send_(ctx.chat, 'Дата у форматі ДД.ММ (наприклад, 05.09):');
  }
  if (st.s === 'dt_date') {
    const d = parseDate_(text);
    if (!d) return send_(ctx.chat, 'Формат: ДД.ММ, наприклад 05.09');
    tmpPut_('dt' + ctx.chat, { name: st.name, date: Utilities.formatDate(d, TZ, 'dd.MM') });
    clearState_(ctx.chat);
    return send_(ctx.chat, 'Який привід?', REASONS.map((r, i) => [b_(r, 'dtw:' + i)]));
  }
}
function dateReason_(ctx, i) {
  const t = tmpGet_('dt' + ctx.chat);
  if (!t) return dates_(ctx);
  append_('Дати клієнтів', { 'TG_ID': String(ctx.from.id), 'Імʼя близького': t.name, 'Дата': "'" + t.date, 'Привід': REASONS[i] || REASONS[0], 'Нагадано рік': '' });
  answer_(ctx, 'Збережено');
  return dates_(ctx);
}
function dateDelete_(ctx, row) {
  const r = rows_('Дати клієнтів').find(x => x._row === row && String(x['TG_ID']) === String(ctx.from.id));
  if (r) { tbl_('Дати клієнтів').sh.deleteRow(row); invalidate_('Дати клієнтів'); }
  return dates_(ctx);
}

/* ============================ ОПТ І КОРПОРАТИВ ============================ */

function wholesaleStart_(ctx) {
  const c = find_('Клієнти', 'TG_ID', ctx.from.id);
  const note = bool_(c['Опт погоджено']) ? '\n\n✅ Ваш оптовий доступ уже активний — у каталозі показуються оптові ціни.' : '';
  return show_(ctx, '<b>💼 Опт і корпоративні подарунки</b>\nДля кавʼярень, шоурумів, магазинів декору та компаній. Можемо зробити партію з вашим логотипом або власною етикеткою.' + note,
    [[b_('🏪 Опт для бізнесу', 'ws:opt')], [b_('🎁 Корпоративні подарунки', 'ws:corp')]]);
}
function wholesaleForm_(ctx, type) {
  setState_(ctx.chat, { s: 'ws', step: 'company', d: { type: type === 'corp' ? 'Корпоратив' : 'Опт' } });
  return send_(ctx.chat, 'Назва компанії або закладу:');
}
function wholesaleText_(ctx, st, m) {
  const d = st.d, text = (m.text || '').trim();
  const next = (step, q, rows) => { st.step = step; setState_(ctx.chat, st); return send_(ctx.chat, q, rows); };
  switch (st.step) {
    case 'company': d.company = text.slice(0, 100); return next('qty', 'Скільки свічок / наборів потрібно?');
    case 'qty': d.qty = text.slice(0, 60); return next('budget', 'Орієнтовний бюджет (грн)?');
    case 'budget': d.budget = text.slice(0, 60); return next('date', 'До якої дати потрібно? (ДД.ММ або «не терміново»)');
    case 'date': d.date = text.slice(0, 40); return next('logo', 'Потрібен ваш логотип або власна етикетка?', [[b_('Так', 'wsl:1'), b_('Ні', 'wsl:0')]]);
    case 'file': {
      let file = '';
      if (m.photo) file = 'photo:' + m.photo[m.photo.length - 1].file_id;
      else if (m.document) file = 'doc:' + m.document.file_id;
      if (!file) return send_(ctx.chat, 'Надішліть файл логотипу (фото або документ) або натисніть «Пропустити».', [[b_('Пропустити', 'wsskip')]]);
      d.file = file; st.step = 'contact'; setState_(ctx.chat, st);
      return askPhone_(ctx, 'Телефон для звʼязку:');
    }
    case 'contact': {
      const ph = phone_(m.contact ? m.contact.phone_number : text);
      if (!ph) return send_(ctx.chat, 'Приклад номера: 0671234567');
      d.contact = ph;
      return wholesaleSave_(ctx, d);
    }
  }
}
function wholesaleLogo_(ctx, yes) {
  const st = getState_(ctx.chat);
  if (!st || st.s !== 'ws') return wholesaleStart_(ctx);
  st.d.logo = yes ? 'Так' : 'Ні';
  st.step = yes ? 'file' : 'contact';
  setState_(ctx.chat, st);
  if (yes) return send_(ctx.chat, 'Надішліть файл логотипу (фото або документ PNG/PDF/SVG):', [[b_('Пропустити', 'wsskip')]]);
  return askPhone_(ctx, 'Телефон для звʼязку:');
}
function wholesaleSkipFile_(ctx) {
  const st = getState_(ctx.chat);
  if (!st || st.s !== 'ws') return wholesaleStart_(ctx);
  st.step = 'contact'; setState_(ctx.chat, st);
  return askPhone_(ctx, 'Телефон для звʼязку:');
}
function wholesaleSave_(ctx, d) {
  clearState_(ctx.chat);
  const row = append_('Заявки', {
    'Дата': new Date(), 'TG_ID': String(ctx.from.id), 'Тип': d.type, 'Компанія': d.company, 'Кількість': d.qty, 'Бюджет': d.budget,
    'Дата потреби': d.date, 'Логотип/етикетка': d.logo || 'Ні', 'Файл': d.file || '', 'Контакт': d.contact, 'Статус': 'Нова'
  });
  const c = find_('Клієнти', 'TG_ID', ctx.from.id);
  if (!c['Телефон']) update_('Клієнти', c._row, { 'Телефон': d.contact });
  log_('INFO', ctx.from.id, 'заявка ' + d.type, d.company);
  send_(ctx.chat, '✅ Дякуємо! Заявку отримали, звʼяжемося найближчим часом.', mainKeyboard_(ctx));
  const txt = '💼 <b>Нова заявка: ' + esc_(d.type) + '</b>\n' + esc_(d.company) + '\nКількість: ' + esc_(d.qty) + '\nБюджет: ' + esc_(d.budget) +
    '\nДо: ' + esc_(d.date) + '\nЛоготип/етикетка: ' + esc_(d.logo || 'Ні') + '\nКонтакт: ' + esc_(d.contact) + ' · <a href="tg://user?id=' + ctx.from.id + '">написати</a>';
  team_('owner').forEach(o => {
    send_(o.id, txt, [[b_('✅ Погодити опт-ціни', 'a:wsok:' + row), b_('❌ Відхилити', 'a:wsno:' + row)]]);
    if (d.file) {
      const f = d.file.split(':');
      tg_(f[0] === 'photo' ? 'sendPhoto' : 'sendDocument', f[0] === 'photo' ? { chat_id: o.id, photo: f[1], caption: 'Логотип: ' + d.company } : { chat_id: o.id, document: f[1], caption: 'Логотип: ' + d.company });
    }
  });
}

/* ============================ ВІДГУКИ ============================ */

function askReview_(o) {
  send_(o['TG_ID'], '🕯 Як вам замовлення №' + o['№'] + '? Оцініть, будь ласка:',
    [[1, 2, 3, 4, 5].map(i => b_('⭐'.repeat(1) + i, 'rv:' + o['№'] + ':' + i))]);
  update_('Замовлення', o._row, { 'Відгук': 'Запитано' });
}
function reviewScore_(ctx, n, score) {
  const o = orderByNo_(n);
  if (!o || String(o['TG_ID']) !== String(ctx.from.id)) return answer_(ctx, 'Замовлення не знайдено');
  if (o['Відгук'] && o['Відгук'] !== 'Запитано') return answer_(ctx, 'Відгук уже є, дякуємо!');
  const row = append_('Відгуки', { 'Дата': new Date(), '№ замовлення': n, 'TG_ID': String(ctx.from.id), 'Оцінка': score, 'Бали': 0 });
  update_('Замовлення', o._row, { 'Відгук': score });
  if (score <= 3) notifyOwners_('⚠️ <b>Низька оцінка ' + score + '/5</b> за замовлення №' + n + ' від ' + esc_(ctx.client['Імʼя']) + ' · <a href="tg://user?id=' + ctx.from.id + '">написати</a>', [[b_('Відкрити замовлення', 'a:o:' + n)]]);
  setState_(ctx.chat, { s: 'rv', n: n, row: row });
  return show_(ctx, 'Дякуємо за ' + score + '/5! 💛\nНадішліть фото свічки в інтерʼєрі (+' + N_('Бонус за фото-відгук, балів') + ' балів) або напишіть кілька слів.',
    [[b_('Пропустити', 'rvskip:' + n)]]);
}
function reviewText_(ctx, st, m) {
  const r = rows_('Відгуки').find(x => x._row === st.row);
  if (!r) { clearState_(ctx.chat); return; }
  const upd = {};
  if (m.text) upd['Текст'] = m.text.slice(0, 1000);
  if (m.caption) upd['Текст'] = m.caption.slice(0, 1000);
  let bonus = 0;
  if (m.photo) {
    upd['Фото'] = m.photo[m.photo.length - 1].file_id;
    if (!num_(r['Бали'])) { bonus = N_('Бонус за фото-відгук, балів'); upd['Бали'] = bonus; }
  }
  update_('Відгуки', r._row, upd);
  if (bonus) addPoints_(ctx.from.id, bonus, 'фото-відгук №' + st.n);
  if (num_(r['Оцінка']) <= 3 && (upd['Текст'] || upd['Фото'])) {
    notifyOwners_('Коментар до оцінки ' + num_(r['Оцінка']) + '/5 (№' + st.n + '): ' + esc_(upd['Текст'] || 'фото'));
    if (upd['Фото']) team_('owner').forEach(o => photo_(o.id, upd['Фото'], 'Фото до відгуку №' + st.n));
  }
  return reviewFinish_(ctx, st.n, bonus ? '📸 Дякуємо за фото! Нараховано +' + bonus + ' балів.' : 'Дякуємо за відгук! 💛');
}
function reviewFinish_(ctx, n, msg) {
  clearState_(ctx.chat);
  const o = orderByNo_(n);
  if (o && o['Статус'] === ST.RECV) setStatus_(o, ST.DONE, 'клієнт', true);
  return send_(ctx.chat, msg, mainKeyboard_(ctx));
}
function addPoints_(tgId, pts, why) {
  const c = find_('Клієнти', 'TG_ID', tgId);
  if (!c) return;
  update_('Клієнти', c._row, { 'Бали': Math.max(0, num_(c['Бали']) + pts) });
  log_('INFO', 'система', 'бали ' + (pts > 0 ? '+' : '') + pts, tgId + ' · ' + why);
}

/* ============================ ЗВʼЯЗОК ============================ */

function contactStart_(ctx) {
  setState_(ctx.chat, { s: 'contact' });
  return send_(ctx.chat, '💬 Напишіть ваше питання одним повідомленням — ми відповімо тут, у боті.\nТермінові питання: ' + esc_(S_('Контакт для клієнтів')));
}
function contactText_(ctx, m) {
  clearState_(ctx.chat);
  const head = '💬 <b>Питання від клієнта</b> ' + esc_(ctx.client['Імʼя']) + ' ' + esc_(ctx.client['Username'] || '') + ' (ID ' + ctx.from.id + ')';
  team_('owner').forEach(o => {
    send_(o.id, head, [[b_('↩️ Відповісти', 'a:reply:' + ctx.from.id)]]);
    tg_('copyMessage', { chat_id: o.id, from_chat_id: ctx.chat, message_id: m.message_id });
  });
  log_('INFO', ctx.from.id, 'питання клієнта', (m.text || m.caption || '[медіа]').slice(0, 300));
  return send_(ctx.chat, '✅ Передали команді. Відповімо найближчим часом.', mainKeyboard_(ctx));
}
function replyText_(ctx, st, m) {
  clearState_(ctx.chat);
  send_(st.to, '💬 <b>Відповідь від ' + esc_(brand_()) + ':</b>');
  tg_('copyMessage', { chat_id: st.to, from_chat_id: ctx.chat, message_id: m.message_id });
  log_('INFO', staffName_(ctx), 'відповідь клієнту', st.to + ': ' + (m.text || '[медіа]').slice(0, 300));
  return send_(ctx.chat, '✅ Відповідь надіслано.');
}

/* ============================ МЕНЮ КОМАНДИ ============================ */

function staffMenu_(ctx) {
  if (ctx.role === 'owner') {
    const cnt = rows_('Замовлення').filter(o => o['Статус'] === ST.NEW).length;
    return show_(ctx, '<b>⚙️ Керування · ' + esc_(ctx.staff.name) + '</b>', [
      [b_('🆕 Нові' + (cnt ? ' (' + cnt + ')' : ''), 'a:ol:new'), b_('📂 Активні', 'a:ol:act')],
      [b_('💳 Неоплачені', 'a:ol:unpaid'), b_('🙋 Мої', 'a:ol:mine')],
      [b_('🏭 Виробництво', 'a:pq'), b_('📦 Пакування і відправка', 'a:pk')],
      [b_('🧪 Склад', 'a:stk'), b_('⚠️ Проблема', 'a:prob')],
      [b_('📊 Звіт', 'a:rep:0'), b_('📣 Розсилка', 'a:bc')],
      [b_('🎟 Промокоди', 'a:promo'), b_('💼 Заявки опт', 'a:ws')],
      [b_('💰 Ціни', 'a:price'), b_('👥 Команда', 'a:team')],
      [b_('🔧 Налаштування', 'a:set')]
    ]);
  }
  return show_(ctx, '<b>⚙️ Робочі задачі · ' + esc_(ctx.staff.name) + '</b>', [
    [b_('🏭 Виробництво', 'a:pq')], [b_('📦 Пакування і відправка', 'a:pk')], [b_('🧪 Склад', 'a:stk')], [b_('⚠️ Повідомити про проблему', 'a:prob')]
  ]);
}

function staffAction_(ctx, act, p) {
  switch (act) {
    case 'menu': return staffMenu_(ctx);
    case 'ol': return orderList_(ctx, p[0]);
    case 'o': return showOrder_(ctx, p[0]);
    case 'take': return takeOrder_(ctx, p[0]);
    case 'conf': return confirmOrder_(ctx, p[0]);
    case 'canc': return show_(ctx, 'Скасувати замовлення №' + p[0] + '? Товари повернуться на склад, бали — клієнту.', [[b_('Так, скасувати', 'a:canc2:' + p[0]), b_('Ні', 'a:o:' + p[0])]]);
    case 'canc2': return cancelOrder_(ctx, p[0]);
    case 'ref': return show_(ctx, 'Повернути клієнту ' + money_(orderByNo_(p[0])['Сплачено']) + ' за №' + p[0] + '?', [[b_('Так, повернути', 'a:ref2:' + p[0]), b_('Ні', 'a:o:' + p[0])]]);
    case 'ref2': return refundOrder_(ctx, p[0]);
    case 'paid': return markPaid_(ctx, p[0]);
    case 'pack': setState_(ctx.chat, { s: 'packphoto', n: p[0] }); return send_(ctx.chat, '📸 Надішліть фото запакованої посилки №' + p[0] + ' (обовʼязково).');
    case 'ttn': return createTtn_(ctx, p[0]);
    case 'ttnm': setState_(ctx.chat, { s: 'ttn', n: p[0] }); return send_(ctx.chat, 'Введіть номер ТТН (14 цифр) для №' + p[0] + ':');
    case 'sent': return markSent_(ctx, p[0]);
    case 'issued': return markIssued_(ctx, p[0]);
    case 'recv': { const o = orderByNo_(p[0]); onReceived_(o, staffName_(ctx)); return showOrder_(ctx, p[0]); }
    case 'trk': return trackOne_(ctx, p[0]);
    case 'done': { setStatus_(orderByNo_(p[0]), ST.DONE, staffName_(ctx), true); return showOrder_(ctx, p[0]); }
    case 'cli': return clientCard_(ctx, p[0]);
    case 'pts': setState_(ctx.chat, { s: 'ptsval', tg: p[0] }); return send_(ctx.chat, 'Скільки балів додати чи зняти? Напр.: <b>+50 подарунок</b> або <b>-30 помилка</b>');
    case 'pq': return productionQueue_(ctx);
    case 'cast': return castGroup_(ctx, +p[0]);
    case 'ready': return markCastReady_(ctx, p[0]);
    case 'pk': return packingList_(ctx);
    case 'stk': return stock_(ctx);
    case 'rawsel': return rawSelect_(ctx, p[0]);
    case 'raw': setState_(ctx.chat, { s: 'rawqty', id: p[0], dir: p[1] }); { const r = find_('Сировина', 'ID', p[0]); return send_(ctx.chat, (p[1] === 'in' ? '➕ Оприбуткувати' : '➖ Списати') + ' «' + esc_(r ? r['Назва'] : p[0]) + '».\nНапишіть кількість (' + esc_(r ? r['Одиниця'] : '') + ') і коментар, напр.: <b>500 закупівля</b>'); }
    case 'prob': return problem_(ctx, p[0]);
    case 'rep': return report_(ctx, +p[0] || 0);
    case 'bc': return broadcastStart_(ctx);
    case 'bca': return broadcastAroma_(ctx, p[0]);
    case 'bcp': return broadcastPreview_(ctx);
    case 'bcs': return broadcastSend_(ctx);
    case 'bcx': clearState_(ctx.chat); return show_(ctx, 'Розсилку скасовано.');
    case 'promo': return promoList_(ctx);
    case 'promoadd': setState_(ctx.chat, { s: 'promo', step: 'code', d: {} }); return send_(ctx.chat, 'Новий промокод. Напишіть код (латиницею, без пробілів):');
    case 'promot': return promoType_(ctx, p[0]);
    case 'promooff': return promoToggle_(ctx, p[0]);
    case 'team': return teamList_(ctx);
    case 'teamadd': setState_(ctx.chat, { s: 'team', step: 'id', d: {} }); return send_(ctx.chat, 'Telegram ID нової людини (вона може дізнатися його командою /id у боті):');
    case 'teamrole': return teamRole_(ctx, p[0]);
    case 'teamtog': return teamToggle_(ctx, +p[0]);
    case 'set': return settingsList_(ctx);
    case 'sete': return settingEdit_(ctx, +p[0]);
    case 'price': return priceList_(ctx);
    case 'pricep': return pricePick_(ctx, p[0]);
    case 'pricev': return priceAsk_(ctx, 'Варіанти', p[0]);
    case 'ws': return wsList_(ctx);
    case 'wsok': return wsDecide_(ctx, +p[0], true);
    case 'wsno': return wsDecide_(ctx, +p[0], false);
    case 'reply': setState_(ctx.chat, { s: 'reply', to: p[0] }); return send_(ctx.chat, 'Напишіть відповідь клієнту (текст або фото):');
  }
  return answer_(ctx, 'Кнопка застаріла');
}

/* ============================ КАРТКА ЗАМОВЛЕННЯ ============================ */

function orderText_(o, role) {
  const n = o['№'];
  const pos = positionsOf_(n);
  const L = [];
  L.push((ST_ICON[o['Статус']] || '') + ' <b>Замовлення №' + n + '</b> · ' + esc_(o['Статус']));
  if (role === 'owner') {
    L.push(fdt_(o['Дата']) + (o['Відповідальний'] ? ' · веде <b>' + esc_(o['Відповідальний']) + '</b>' : ' · ще ніхто не взяв'));
    const c = find_('Клієнти', 'TG_ID', o['TG_ID']);
    L.push('👤 ' + esc_(o['Клієнт']) + ' ' + esc_(c ? c['Username'] : '') + ' · ' + esc_(o['Телефон клієнта']) + ' · <a href="tg://user?id=' + o['TG_ID'] + '">чат</a>' + (c && bool_(c['Опт погоджено']) ? ' · 💼 опт' : ''));
  }
  L.push('');
  pos.forEach(p => {
    const sub = p['Набір'] && !num_(p['Ціна']) ? '   + ' : '• ';
    L.push(sub + esc_(p['Назва']) + ' × ' + num_(p['Кількість']) + (bool_(p['Під замовлення']) ? ' 🕯 під замовлення' : '') +
      (role === 'owner' && num_(p['Сума']) ? ' — ' + money_(p['Сума']) : '') + (p['Набір'] ? ' [' + esc_(String(p['Набір']).split(' · ')[0]) + ']' : ''));
  });
  const sets = [];
  pos.forEach(p => { if (p['Набір'] && sets.indexOf(p['Набір']) < 0) sets.push(p['Набір']); });
  sets.forEach(s => L.push('   🎁 ' + esc_(s)));
  L.push('');
  L.push('📦 Пакування: <b>' + esc_(o['Пакування']) + '</b>' + (o['Без чека'] === 'Так' ? ' · 🧾 БЕЗ ЧЕКА' : ''));
  if (o['Подарунок'] === 'Так') L.push('🎁 Подарунок');
  if (o['Листівка']) L.push('💌 Листівка:\n<b>«' + esc_(o['Листівка']).toUpperCase() + '»</b>');
  if (o['Потрібно до']) L.push('📅 Потрібно до: <b>' + fdate_(o['Потрібно до']) + '</b>');
  L.push(o['Доставка'] === 'Самовивіз' ? '🏠 Самовивіз' : '🚚 НП: ' + esc_(o['Місто']) + ', ' + esc_(o['Відділення']));
  L.push('Отримувач: ' + esc_(o['Отримувач']) + ', ' + esc_(o['Телефон отримувача']));
  if (o['ТТН']) L.push('ТТН: <code>' + esc_(o['ТТН']) + '</code>' + (o['Статус НП'] ? ' · ' + esc_(o['Статус НП']) : ''));
  if (o['Запаковано']) L.push('✅ Запаковано: ' + esc_(o['Запаковано']));
  if (role === 'owner') {
    L.push('');
    L.push('Товари: ' + money_(o['Сума товарів']) + (num_(o['Знижка набору']) ? ' (знижка наборів ' + money_(o['Знижка набору']) + ')' : ''));
    if (num_(o['Знижка промокоду'])) L.push('Промокод ' + esc_(o['Промокод']) + ': −' + money_(o['Знижка промокоду']));
    if (num_(o['Бали списано'])) L.push('Бали: −' + money_(o['Бали списано']));
    if (num_(o['Ціна пакування'])) L.push('Пакування: +' + money_(o['Ціна пакування']));
    L.push('До сплати: <b>' + money_(o['До сплати']) + '</b> · сплачено ' + money_(o['Сплачено']));
    L.push('💳 ' + esc_(o['Спосіб оплати']) + ' · <b>' + esc_(o['Статус оплати']) + '</b>');
    const cost = num_(o['Собівартість']);
    L.push('Собівартість ' + money_(cost) + ' · маржа <b>' + money_(num_(o['До сплати']) - cost) + '</b>');
    const hist = String(o['Історія'] || '').split('\n').slice(-4);
    if (hist.length && hist[0]) L.push('', '<i>' + hist.map(esc_).join('\n') + '</i>');
  }
  return L.join('\n');
}

function orderKb_(o, role) {
  const n = o['№'], s = o['Статус'], rows = [];
  const np = o['Доставка'] !== 'Самовивіз';
  if (role === 'owner') {
    if (!o['Відповідальний'] && s !== ST.CANC && s !== ST.DONE) rows.push([b_('🙋 Беру', 'a:take:' + n)]);
    if (s === ST.NEW) rows.push([b_('✅ Підтвердити', 'a:conf:' + n), b_('❌ Скасувати', 'a:canc:' + n)]);
    if (s === ST.CONF || s === ST.PROD) rows.push([b_('🏭 Черга виробництва', 'a:pq'), b_('❌ Скасувати', 'a:canc:' + n)]);
  }
  if (s === ST.READY) {
    if (!o['Запаковано']) rows.push([b_('📸 Запаковано', 'a:pack:' + n)]);
    else if (np && !o['ТТН']) rows.push([b_('🧾 Створити ТТН', 'a:ttn:' + n), b_('✍️ Ввести ТТН', 'a:ttnm:' + n)]);
    else if (np) rows.push([b_('🚚 Відправлено', 'a:sent:' + n)]);
    else rows.push([b_('🤝 Видано клієнту', 'a:issued:' + n)]);
    if (role === 'owner' && s === ST.READY) rows.push([b_('❌ Скасувати', 'a:canc:' + n)]);
  }
  if (s === ST.SENT) rows.push([b_('📍 Оновити трекінг', 'a:trk:' + n)].concat(role === 'owner' ? [b_('🏠 Отримано', 'a:recv:' + n)] : []));
  if (role === 'owner') {
    if (s === ST.RECV) rows.push([b_('🏁 Завершити', 'a:done:' + n)]);
    if ([PAYST.WAIT, PAYST.COD, PAYST.ADV, PAYST.FAIL].indexOf(o['Статус оплати']) >= 0 && s !== ST.CANC) rows.push([b_('💵 Позначити оплаченим', 'a:paid:' + n)]);
    if (num_(o['Сплачено']) > 0 && o['Статус оплати'] !== PAYST.REF && (s === ST.CANC || s === ST.RECV || s === ST.DONE || s === ST.NEW)) rows.push([b_('↩️ Повернути кошти', 'a:ref:' + n)]);
    rows.push([b_('👤 Клієнт', 'a:cli:' + n), b_('🔄 Оновити', 'a:o:' + n)]);
  } else {
    rows.push([b_('🔄 Оновити', 'a:o:' + n), b_('📦 Список', 'a:pk')]);
  }
  return rows;
}

function showOrder_(ctx, n) {
  const o = orderByNo_(n);
  if (!o) return answer_(ctx, 'Замовлення не знайдено');
  return show_(ctx, orderText_(o, ctx.role), orderKb_(o, ctx.role));
}

/** Нове замовлення → картка обом власникам, зберігаємо id повідомлень, щоб оновлювати «хто веде». */
function announceOrder_(o) {
  const ids = {};
  team_('owner').forEach(w => {
    const r = send_(w.id, '🔔 <b>Нове замовлення!</b>\n\n' + orderText_(o, 'owner'), orderKb_(o, 'owner'));
    if (r.ok) ids[w.id] = r.result.message_id;
  });
  update_('Замовлення', o._row, { 'Повідомлення команді': JSON.stringify(ids) });
}
function refreshCards_(n) {
  const o = orderByNo_(n);
  if (!o || !o['Повідомлення команді']) return;
  let ids = {};
  try { ids = JSON.parse(o['Повідомлення команді']); } catch (e) { return; }
  Object.keys(ids).forEach(id => edit_(id, ids[id], orderText_(o, 'owner'), orderKb_(o, 'owner')));
}

function takeOrder_(ctx, n) {
  const lock = lock_();
  let who;
  try {
    _memo = {};
    const o = orderByNo_(n);
    who = o['Відповідальний'];
    if (!who) { update_('Замовлення', o._row, { 'Відповідальний': ctx.staff.name }); who = ''; }
  } finally { lock.releaseLock(); }
  if (who) { answer_(ctx, 'Вже веде ' + who, true); return refreshCards_(n); }
  log_('INFO', ctx.staff.name, 'взяв замовлення', '№' + n);
  answer_(ctx, 'Ви ведете №' + n);
  refreshCards_(n);
  if (!(ctx.cb && orderMsgIds_(n)[ctx.chat] === ctx.cb.message.message_id)) showOrder_(ctx, n);
}
function orderMsgIds_(n) { try { return JSON.parse(orderByNo_(n)['Повідомлення команді'] || '{}'); } catch (e) { return {}; } }

/* ============================ СТАТУСИ ============================ */

function setStatus_(o, status, who, silent) {
  if (!o || o['Статус'] === status) return;
  const hist = (o['Історія'] ? o['Історія'] + '\n' : '') + fdt_(new Date()) + ' — ' + status + ' (' + who + ')';
  update_('Замовлення', o._row, { 'Статус': status, 'Історія': hist });
  log_('INFO', who, 'статус №' + o['№'], o['Статус'] + ' → ' + status);
  const n = o['№'];
  const cur = orderByNo_(n);
  if (!silent) {
    const pickup = cur['Доставка'] === 'Самовивіз';
    const msg = {};
    msg[ST.CONF] = '✅ Замовлення №' + n + ' підтверджено.';
    msg[ST.PROD] = '🕯 Ми почали виготовлення замовлення №' + n + '. Повідомимо, щойно все буде готово.';
    msg[ST.READY] = pickup ? '📦 Замовлення №' + n + ' готове до видачі!\n' + esc_(S_('Місто самовивозу')) + ', ' + esc_(S_('Адреса самовивозу')) : '📦 Замовлення №' + n + ' зібрано і готується до відправки.';
    msg[ST.SENT] = '🚚 Замовлення №' + n + ' відправлено!\nТТН: <code>' + esc_(cur['ТТН']) + '</code>';
    msg[ST.CANC] = '❌ Замовлення №' + n + ' скасовано. Якщо це помилка — напишіть нам.';
    if (msg[status]) send_(cur['TG_ID'], msg[status], status === ST.SENT && cur['ТТН'] ? [[u_('📍 Відстежити', trackUrl_(cur['ТТН']))]] : null, true);
  }
  refreshCards_(n);
}

function confirmOrder_(ctx, n) {
  const o = orderByNo_(n);
  if (o['Статус'] !== ST.NEW) return answer_(ctx, 'Вже ' + o['Статус'], true);
  if (!o['Відповідальний']) update_('Замовлення', o._row, { 'Відповідальний': ctx.staff.name });
  setStatus_(orderByNo_(n), ST.CONF, ctx.staff.name);
  const mto = positionsOf_(n).filter(p => bool_(p['Під замовлення']));
  if (mto.length) {
    const today = dayStart_(new Date());
    mto.forEach(p => {
      const prod = product_(p['ID товару']);
      let days = Math.round(num_(prod && prod['Днів виготовлення'])) || Math.round(N_('Днів виготовлення за замовчуванням'));
      let dl = addDays_(today, days);
      if (prod && prod['Старт продажу'] instanceof Date && dl < prod['Старт продажу']) dl = addDays_(prod['Старт продажу'], days);
      append_('Виробництво', {
        'ID': uid_(), '№ замовлення': n, 'ID товару': p['ID товару'], 'ID варіанту': p['ID варіанту'], 'Назва': p['Назва'], 'Аромат': p['Аромат'],
        'Обʼєм': p['Обʼєм'], 'Кількість': num_(p['Кількість']), 'Дедлайн': dl, 'Статус': 'Чекає'
      });
    });
    setStatus_(orderByNo_(n), ST.PROD, ctx.staff.name);
    notifyHelpers_('🏭 Нове у виробництві: №' + n + ' — ' + mto.map(p => esc_(p['Назва']) + ' × ' + num_(p['Кількість'])).join(', '), [[b_('Черга виробництва', 'a:pq')]]);
  } else {
    setStatus_(orderByNo_(n), ST.READY, ctx.staff.name);
    notifyHelpers_('📦 Нове на пакування: №' + n, [[b_('Відкрити', 'a:o:' + n)]]);
  }
  answer_(ctx, 'Підтверджено');
  return showOrder_(ctx, n);
}

function cancelOrder_(ctx, n) {
  const lock = lock_();
  let o;
  try {
    _memo = {};
    o = orderByNo_(n);
    if (o['Статус'] === ST.CANC) { answer_(ctx, 'Вже скасовано'); return; }
    positionsOf_(n).forEach(p => {
      if (!bool_(p['Під замовлення'])) returnStock_(p['ID товару'], p['ID варіанту'], num_(p['Кількість']));
    });
    rows_('Виробництво').filter(r => String(r['№ замовлення']) === String(n)).forEach(r => {
      if (r['Статус'] === 'Чекає') update_('Виробництво', r._row, { 'Статус': 'Скасовано' });
      else if (r['Статус'] === 'Відлито' || r['Статус'] === 'Готово') { returnStock_(r['ID товару'], r['ID варіанту'], num_(r['Кількість'])); update_('Виробництво', r._row, { 'Статус': 'Скасовано' }); }
    });
    if (num_(o['Бали списано'])) addPoints_(o['TG_ID'], num_(o['Бали списано']), 'скасування №' + n);
    if (o['Промокод'] && num_(o['Знижка промокоду'])) {
      const pr = rows_('Промокоди').find(r => String(r['Код']).toUpperCase() === String(o['Промокод']).toUpperCase());
      if (pr) update_('Промокоди', pr._row, { 'Використано': Math.max(0, num_(pr['Використано']) - 1) });
    }
  } finally { lock.releaseLock(); }
  if (!o || o['Статус'] === ST.CANC) return showOrder_(ctx, n);
  setStatus_(orderByNo_(n), ST.CANC, ctx.staff.name);
  if (num_(o['Сплачено']) > 0) send_(ctx.chat, '⚠️ Клієнт уже сплатив ' + money_(o['Сплачено']) + '. Поверніть кошти кнопкою «↩️ Повернути кошти».');
  return showOrder_(ctx, n);
}

function refundOrder_(ctx, n) {
  const o = orderByNo_(n);
  let auto = false;
  try { auto = monoRefund_(o); } catch (e) { logErr_('monobank повернення №' + n, e); return send_(ctx.chat, '❗ monobank не прийняв повернення: ' + esc_(e.message) + '\nПоверніть вручну в кабінеті monobank.'); }
  update_('Замовлення', o._row, { 'Статус оплати': PAYST.REF, 'Історія': (o['Історія'] || '') + '\n' + fdt_(new Date()) + ' — повернення ' + money_(o['Сплачено']) + ' (' + ctx.staff.name + ')' });
  log_('INFO', ctx.staff.name, 'повернення №' + n, money_(o['Сплачено']) + (auto ? ' через monobank' : ' вручну'));
  send_(o['TG_ID'], '↩️ Кошти за замовлення №' + n + ' (' + money_(o['Сплачено']) + ') повернуто. Зарахування — до кількох робочих днів.', null, true);
  if (!auto) send_(ctx.chat, 'Позначено як повернено. Переказ зробіть вручну.');
  refreshCards_(n);
  return showOrder_(ctx, n);
}

function markPaid_(ctx, n) {
  const o = orderByNo_(n);
  update_('Замовлення', o._row, { 'Статус оплати': PAYST.PAID, 'Сплачено': num_(o['До сплати']) });
  log_('INFO', ctx.staff.name, 'оплата вручну №' + n, money_(o['До сплати']));
  refreshCards_(n);
  return showOrder_(ctx, n);
}

function onReceived_(o, who) {
  if (!o || [ST.RECV, ST.DONE, ST.CANC].indexOf(o['Статус']) >= 0) return;
  const n = o['№'];
  const upd = { 'Отримано': new Date() };
  if (o['Статус оплати'] === PAYST.COD || o['Статус оплати'] === PAYST.ADV) { upd['Статус оплати'] = PAYST.PAID; upd['Сплачено'] = num_(o['До сплати']); }
  if (Object.keys(upd).length) update_('Замовлення', o._row, upd);
  setStatus_(orderByNo_(n), ST.RECV, who, true);
  const cur = orderByNo_(n);
  // кешбек
  if (!cur['Кешбек нараховано']) {
    const base = num_(cur['Сплачено']) || num_(cur['До сплати']);
    const pts = Math.floor(base * N_('Кешбек, %') / 100);
    if (pts > 0) addPoints_(cur['TG_ID'], pts, 'кешбек №' + n);
    update_('Замовлення', cur._row, { 'Кешбек нараховано': pts });
    if (pts > 0) send_(cur['TG_ID'], '⭐ Нараховано ' + pts + ' балів кешбеку за замовлення №' + n + '.', null, true);
  }
  // реферальний бонус після першої покупки друга
  const c = find_('Клієнти', 'TG_ID', cur['TG_ID']);
  if (c && c['Реферер'] && !c['Реф. бонус']) {
    const prev = rows_('Замовлення').filter(x => String(x['TG_ID']) === String(cur['TG_ID']) && x['№'] !== cur['№'] && (x['Статус'] === ST.RECV || x['Статус'] === ST.DONE));
    if (!prev.length) {
      const bonus = N_('Реферальний бонус, балів');
      addPoints_(cur['TG_ID'], bonus, 'реферал (друг)');
      addPoints_(c['Реферер'], bonus, 'реферал (запросив ' + cur['TG_ID'] + ')');
      update_('Клієнти', c._row, { 'Реф. бонус': new Date() });
      send_(cur['TG_ID'], '🎁 +' + bonus + ' балів за першу покупку за запрошенням!', null, true);
      send_(c['Реферер'], '🎁 Ваш друг зробив першу покупку — вам +' + bonus + ' балів!', null, true);
    }
  }
  // нагадування «свічка догорає»
  const perDay = N_('Горіння на день, год') || 2;
  positionsOf_(n).forEach(p => {
    const prod = product_(p['ID товару']);
    const h = prod ? num_(prod['Час горіння, год']) : 0;
    if (h > 0) update_('Позиції', p._row, { 'Нагадати догорає': addDays_(dayStart_(new Date()), Math.ceil(h / perDay)) });
  });
  send_(cur['TG_ID'], '🏠 Замовлення №' + n + ' отримано. Гарних і теплих вечорів! 🕯', null, true);
  askReview_(orderByNo_(n));
}

/* ============================ СПИСКИ ЗАМОВЛЕНЬ ============================ */

function orderList_(ctx, f) {
  const me = ctx.staff.name;
  const active = o => o['Статус'] !== ST.DONE && o['Статус'] !== ST.CANC;
  const filters = {
    new: o => o['Статус'] === ST.NEW,
    act: active,
    unpaid: o => o['Статус'] !== ST.CANC && (o['Статус оплати'] === PAYST.WAIT || o['Статус оплати'] === PAYST.FAIL),
    mine: o => active(o) && String(o['Відповідальний']) === me
  };
  const titles = { new: '🆕 Нові', act: '📂 Активні', unpaid: '💳 Неоплачені', mine: '🙋 Мої' };
  const list = rows_('Замовлення').filter(filters[f] || active).sort((a, b) => num_(b['№']) - num_(a['№'])).slice(0, 25);
  const rows = list.map(o => [b_((ST_ICON[o['Статус']] || '') + ' №' + o['№'] + ' · ' + String(o['Клієнт']).slice(0, 14) + ' · ' + money_(o['До сплати']) + (o['Відповідальний'] ? ' · ' + o['Відповідальний'] : ''), 'a:o:' + o['№'])]);
  rows.push([b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, '<b>' + (titles[f] || 'Замовлення') + '</b>' + (list.length ? '' : '\nПорожньо.'), rows);
}

function clientCard_(ctx, n) {
  const o = orderByNo_(n);
  const c = find_('Клієнти', 'TG_ID', o['TG_ID']);
  if (!c) return answer_(ctx, 'Клієнта не знайдено');
  const all = rows_('Замовлення').filter(x => String(x['TG_ID']) === String(c['TG_ID']) && x['Статус'] !== ST.CANC);
  const L = ['<b>👤 ' + esc_(c['Імʼя']) + '</b> ' + esc_(c['Username']), 'Телефон: ' + esc_(c['Телефон'] || '—'), 'Тип: ' + esc_(c['Тип']) + (bool_(c['Опт погоджено']) ? ' (опт погоджено)' : ''),
    'Бали: <b>' + Math.floor(num_(c['Бали'])) + '</b>', 'Замовлень: ' + all.length + ' на ' + money_(all.reduce((s, x) => s + num_(x['До сплати']), 0)),
    'З нами з ' + fdate_(c['Дата реєстрації']) + (c['Реферер'] ? ' · запросив ' + esc_(c['Реферер']) : '')];
  return show_(ctx, L.join('\n'), [[b_('± Бали', 'a:pts:' + c['TG_ID']), b_('💬 Написати', 'a:reply:' + c['TG_ID'])], [b_('⬅️ Замовлення', 'a:o:' + n)]]);
}
function pointsAdjText_(ctx, st, text) {
  const m = text.match(/^([+-]?\d+)\s*(.*)$/);
  if (!m) return send_(ctx.chat, 'Формат: +50 коментар або -30 коментар');
  clearState_(ctx.chat);
  addPoints_(st.tg, parseInt(m[1], 10), (m[2] || 'вручну') + ' (' + ctx.staff.name + ')');
  log_('INFO', ctx.staff.name, 'бали вручну', st.tg + ' ' + m[1] + ' ' + (m[2] || ''));
  return send_(ctx.chat, '✅ Бали змінено: ' + m[1]);
}

/* ============================ ВИРОБНИЦТВО ============================ */

function productionQueue_(ctx) {
  const rows = rows_('Виробництво');
  const wait = rows.filter(r => r['Статус'] === 'Чекає');
  const cast = rows.filter(r => r['Статус'] === 'Відлито');
  const groups = {};
  wait.forEach(r => {
    const k = (r['Аромат'] || '—') + ' · ' + (r['Обʼєм'] || '—') + ' · ' + r['ID товару'] + (r['ID варіанту'] ? '/' + r['ID варіанту'] : '');
    groups[k] = groups[k] || { qty: 0, dl: null, orders: [], name: r['Назва'] };
    groups[k].qty += num_(r['Кількість']);
    if (!groups[k].dl || r['Дедлайн'] < groups[k].dl) groups[k].dl = r['Дедлайн'];
    if (groups[k].orders.indexOf(r['№ замовлення']) < 0) groups[k].orders.push(r['№ замовлення']);
  });
  const keys = Object.keys(groups).sort((a, b) => (groups[a].dl || 0) - (groups[b].dl || 0));
  tmpPut_('pq' + ctx.chat, keys);
  const L = ['<b>🏭 Черга виробництва</b>', '', '<b>Відлити (партіями):</b>'];
  const kb = [];
  if (!keys.length) L.push('— нічого');
  keys.forEach((k, i) => {
    const g = groups[k];
    const late = g.dl instanceof Date && dayStart_(g.dl) <= dayStart_(new Date());
    L.push((late ? '🔴 ' : '• ') + esc_(g.name) + ' — <b>' + g.qty + ' шт</b>\n   ' + esc_(k.split(' · ').slice(0, 2).join(' · ')) + ' · до ' + fdate_(g.dl) + ' · №' + g.orders.join(', №'));
    kb.push([b_('🫗 Відлито: ' + String(g.name).slice(0, 22) + ' (' + g.qty + ')', 'a:cast:' + i)]);
  });
  L.push('', '<b>Застигають:</b>');
  if (!cast.length) L.push('— нічого');
  const mat = N_('Визрівання, год') * 3600000;
  cast.forEach(r => {
    const readyAt = r['Відлито'] instanceof Date ? new Date(r['Відлито'].getTime() + mat) : new Date();
    const ok = new Date() >= readyAt;
    L.push('• ' + esc_(r['Назва']) + ' × ' + num_(r['Кількість']) + ' (№' + r['№ замовлення'] + ') — ' + (ok ? '✅ можна' : 'готова з ' + fdt_(readyAt)));
    if (ok) kb.push([b_('✅ Готово: ' + String(r['Назва']).slice(0, 22) + ' №' + r['№ замовлення'], 'a:ready:' + r['ID'])]);
  });
  kb.push([b_('🔄 Оновити', 'a:pq'), b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, L.join('\n'), kb);
}

function castGroup_(ctx, i) {
  const keys = tmpGet_('pq' + ctx.chat) || [];
  const key = keys[i];
  if (!key) return productionQueue_(ctx);
  const lock = lock_();
  const lowRaw = [];
  let done = 0;
  try {
    _memo = {};
    rows_('Виробництво').filter(r => r['Статус'] === 'Чекає' &&
      ((r['Аромат'] || '—') + ' · ' + (r['Обʼєм'] || '—') + ' · ' + r['ID товару'] + (r['ID варіанту'] ? '/' + r['ID варіанту'] : '')) === key).forEach(r => {
      update_('Виробництво', r._row, { 'Статус': 'Відлито', 'Відлито': new Date(), 'Хто': ctx.staff.name });
      writeOffRaw_(r['ID товару'], r['ID варіанту'], num_(r['Кількість']), lowRaw, 'відлито №' + r['№ замовлення'] + ' (' + ctx.staff.name + ')');
      done += num_(r['Кількість']);
    });
  } finally { lock.releaseLock(); }
  log_('INFO', ctx.staff.name, 'відлито', key + ' × ' + done);
  if (lowRaw.length) notifyOwners_('🛒 <b>Час закупити сировину:</b>\n' + lowRaw.map(x => '• ' + esc_(x)).join('\n'));
  answer_(ctx, 'Відлито ' + done + ' шт. Сировину списано.');
  return productionQueue_(ctx);
}

function writeOffRaw_(pid, vid, qty, lowRaw, why) {
  techCard_(pid, vid).forEach(t => {
    const raw = find_('Сировина', 'ID', t['ID сировини']);
    if (!raw) return;
    const left = num_(raw['Залишок']) - num_(t['Кількість']) * qty;
    update_('Сировина', raw._row, { 'Залишок': left });
    if (left <= num_(raw['Мін. залишок']) && lowRaw.indexOf(raw['Назва']) < 0) lowRaw.push(raw['Назва'] + ': ' + left + ' ' + raw['Одиниця']);
  });
  log_('INFO', 'склад', 'автосписання', pid + (vid ? '/' + vid : '') + ' × ' + qty + ' · ' + why);
}

function markCastReady_(ctx, id) {
  const r = find_('Виробництво', 'ID', id);
  if (!r || r['Статус'] !== 'Відлито') return productionQueue_(ctx);
  const readyAt = r['Відлито'] instanceof Date ? r['Відлито'].getTime() + N_('Визрівання, год') * 3600000 : 0;
  if (Date.now() < readyAt) return answer_(ctx, 'Ще визріває до ' + fdt_(new Date(readyAt)), true);
  update_('Виробництво', r._row, { 'Статус': 'Готово', 'Готово': new Date(), 'Хто': ctx.staff.name });
  log_('INFO', ctx.staff.name, 'готово', r['Назва'] + ' №' + r['№ замовлення']);
  const n = r['№ замовлення'];
  const left = rows_('Виробництво').filter(x => String(x['№ замовлення']) === String(n) && (x['Статус'] === 'Чекає' || x['Статус'] === 'Відлито'));
  const o = orderByNo_(n);
  if (!left.length && o && o['Статус'] === ST.PROD) {
    setStatus_(o, ST.READY, ctx.staff.name);
    notifyHelpers_('📦 Готово до пакування: №' + n, [[b_('Відкрити', 'a:o:' + n)]]);
    if (ctx.role !== 'owner') notifyOwners_('📦 №' + n + ' виготовлено і готове до пакування.');
  }
  answer_(ctx, 'Готово');
  return productionQueue_(ctx);
}

/* ============================ ПАКУВАННЯ І ВІДПРАВКА ============================ */

function packingList_(ctx) {
  const ready = rows_('Замовлення').filter(o => o['Статус'] === ST.READY).sort((a, b) => (a['Потрібно до'] || 9e15) - (b['Потрібно до'] || 9e15));
  const toPack = ready.filter(o => !o['Запаковано']);
  const toShip = ready.filter(o => o['Запаковано'] && o['Доставка'] !== 'Самовивіз');
  const toGive = ready.filter(o => o['Запаковано'] && o['Доставка'] === 'Самовивіз');
  const L = ['<b>📦 Сьогодні</b>', '', '<b>Запакувати (' + toPack.length + '):</b>'];
  const kb = [];
  const line = o => '№' + o['№'] + ' · ' + esc_(o['Пакування']) + (o['Листівка'] ? ' · 💌' : '') + (o['Без чека'] === 'Так' ? ' · без чека' : '') + (o['Потрібно до'] ? ' · до ' + fdate_(o['Потрібно до']) : '');
  toPack.forEach(o => { L.push('• ' + line(o)); kb.push([b_('📸 №' + o['№'] + ' пакувати', 'a:o:' + o['№'])]); });
  L.push('', '<b>Відправити НП (' + toShip.length + '):</b>');
  toShip.forEach(o => { L.push('• №' + o['№'] + ' · ' + (o['ТТН'] ? 'ТТН ' + esc_(o['ТТН']) : 'потрібна ТТН')); kb.push([b_('🚚 №' + o['№'], 'a:o:' + o['№'])]); });
  if (toGive.length) { L.push('', '<b>Видати (самовивіз):</b>'); toGive.forEach(o => { L.push('• №' + o['№'] + ' · ' + esc_(o['Отримувач'])); kb.push([b_('🤝 №' + o['№'], 'a:o:' + o['№'])]); }); }
  kb.push([b_('🔄 Оновити', 'a:pk'), b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, L.join('\n'), kb);
}

function packPhoto_(ctx, st, m) {
  if (!m.photo) return send_(ctx.chat, 'Потрібне саме фото посилки 📸 (або /cancel).');
  const o = orderByNo_(st.n);
  if (!o) { clearState_(ctx.chat); return; }
  update_('Замовлення', o._row, { 'Запаковано': fdt_(new Date()) + ' ' + ctx.staff.name, 'Фото пакування': m.photo[m.photo.length - 1].file_id });
  clearState_(ctx.chat);
  log_('INFO', ctx.staff.name, 'запаковано №' + st.n, '');
  refreshCards_(st.n);
  send_(ctx.chat, '✅ №' + st.n + ' запаковано.');
  return send_(ctx.chat, orderText_(orderByNo_(st.n), ctx.role), orderKb_(orderByNo_(st.n), ctx.role));
}

function createTtn_(ctx, n) {
  const o = orderByNo_(n);
  if (o['ТТН']) return answer_(ctx, 'ТТН вже є');
  try {
    const ttn = npCreateTtn_(o);
    update_('Замовлення', o._row, { 'ТТН': ttn });
    log_('INFO', staffName_(ctx), 'ТТН створено №' + n, ttn);
    answer_(ctx, 'ТТН ' + ttn);
  } catch (e) {
    logErr_('ТТН №' + n, e);
    return send_(ctx.chat, '❗ Не вдалося створити ТТН: ' + esc_(e.message) + '\nМожна ввести номер вручну.', [[b_('✍️ Ввести ТТН', 'a:ttnm:' + n)]]);
  }
  refreshCards_(n);
  return showOrder_(ctx, n);
}
function ttnManual_(ctx, st, text) {
  const ttn = text.replace(/\s/g, '');
  if (!/^\d{14}$/.test(ttn)) return send_(ctx.chat, 'ТТН має складатися з 14 цифр. Спробуйте ще раз або /cancel');
  const o = orderByNo_(st.n);
  update_('Замовлення', o._row, { 'ТТН': ttn });
  clearState_(ctx.chat);
  log_('INFO', ctx.staff.name, 'ТТН вручну №' + st.n, ttn);
  refreshCards_(st.n);
  return send_(ctx.chat, orderText_(orderByNo_(st.n), ctx.role), orderKb_(orderByNo_(st.n), ctx.role));
}
function markSent_(ctx, n) {
  const o = orderByNo_(n);
  if (!o['Запаковано']) return answer_(ctx, 'Спочатку «Запаковано» з фото', true);
  if (!o['ТТН']) return answer_(ctx, 'Спочатку створіть або введіть ТТН', true);
  setStatus_(o, ST.SENT, staffName_(ctx));
  return showOrder_(ctx, n);
}
function markIssued_(ctx, n) {
  const o = orderByNo_(n);
  if (!o['Запаковано']) return answer_(ctx, 'Спочатку «Запаковано» з фото', true);
  onReceived_(o, staffName_(ctx));
  return showOrder_(ctx, n);
}
function trackOne_(ctx, n) {
  const o = orderByNo_(n);
  if (!o['ТТН']) return answer_(ctx, 'Немає ТТН');
  try { trackOrders_([o]); } catch (e) { logErr_('трекінг №' + n, e); return answer_(ctx, 'НП не відповідає, спробуйте пізніше', true); }
  return showOrder_(ctx, n);
}

/* ============================ СКЛАД ============================ */

function stock_(ctx) {
  const thr = N_('Поріг залишку');
  const L = ['<b>🧪 Склад</b>', '', '<b>Готові вироби і підсвічники:</b>'];
  rows_('Товари').filter(p => bool_(p['Активний'])).forEach(p => {
    const vs = variants_(p['ID']);
    if (vs.length) vs.forEach(v => { if (v['Залишок'] !== '') L.push((num_(v['Залишок']) <= thr ? '⚠️ ' : '• ') + esc_(itemName_(p, v)) + ': <b>' + num_(v['Залишок']) + '</b>'); });
    else if (p['Залишок'] !== '') L.push((num_(p['Залишок']) <= thr ? '⚠️ ' : '• ') + esc_(p['Назва']) + ': <b>' + num_(p['Залишок']) + '</b>');
  });
  L.push('', '<b>Сировина:</b>');
  rows_('Сировина').forEach(r => L.push((num_(r['Залишок']) <= num_(r['Мін. залишок']) ? '⚠️ ' : '• ') + esc_(r['Назва']) + ': <b>' + num_(r['Залишок']) + '</b> ' + esc_(r['Одиниця'])));
  return show_(ctx, L.join('\n').slice(0, 4000), [[b_('➕ Оприбуткувати', 'a:rawsel:in'), b_('➖ Списати', 'a:rawsel:out')], [b_('⬅️ Меню', 'a:menu')]]);
}
function rawSelect_(ctx, dir) {
  const kb = rows_('Сировина').map(r => [b_(r['Назва'] + ' (' + num_(r['Залишок']) + ' ' + r['Одиниця'] + ')', 'a:raw:' + r['ID'] + ':' + dir)]);
  kb.push([b_('⬅️ Склад', 'a:stk')]);
  return show_(ctx, dir === 'in' ? '➕ Що оприбуткувати?' : '➖ Що списати?', kb);
}
function rawQty_(ctx, st, text) {
  const m = text.replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return send_(ctx.chat, 'Формат: кількість і коментар, напр. 500 закупівля');
  const raw = find_('Сировина', 'ID', st.id);
  if (!raw) { clearState_(ctx.chat); return send_(ctx.chat, 'Сировину не знайдено'); }
  if (st.dir === 'out' && !m[2]) return send_(ctx.chat, 'Для списання потрібен коментар, напр.: 200 брак партії');
  const q = parseFloat(m[1]) * (st.dir === 'in' ? 1 : -1);
  const left = num_(raw['Залишок']) + q;
  update_('Сировина', raw._row, { 'Залишок': left });
  clearState_(ctx.chat);
  log_('INFO', ctx.staff.name, st.dir === 'in' ? 'оприбутковано' : 'списано', raw['Назва'] + ' ' + q + ' ' + raw['Одиниця'] + ' · ' + (m[2] || ''));
  if (left <= num_(raw['Мін. залишок'])) notifyOwners_('🛒 Час закупити: ' + esc_(raw['Назва']) + ' — залишок ' + left + ' ' + esc_(raw['Одиниця']));
  return send_(ctx.chat, '✅ ' + esc_(raw['Назва']) + ': тепер ' + left + ' ' + esc_(raw['Одиниця']), [[b_('🧪 Склад', 'a:stk')]]);
}

/* ============================ ПРОБЛЕМИ ============================ */

const PROBLEMS = ['Немає воску', 'Бракований підсвічник', 'Закінчується пакування', 'Закінчуються ґноти', 'Інше (написати)'];
function problem_(ctx, i) {
  if (i === undefined || i === '') return show_(ctx, '⚠️ Що сталося?', PROBLEMS.map((t, k) => [b_(t, 'a:prob:' + k)]).concat([[b_('⬅️ Меню', 'a:menu')]]));
  if (+i === PROBLEMS.length - 1) { setState_(ctx.chat, { s: 'probtext' }); return send_(ctx.chat, 'Опишіть проблему одним повідомленням:'); }
  return problemText_(ctx, PROBLEMS[+i]);
}
function problemText_(ctx, text) {
  clearState_(ctx.chat);
  notifyOwners_('⚠️ <b>Проблема</b> від ' + esc_(ctx.staff.name) + ':\n' + esc_(text));
  log_('WARN', ctx.staff.name, 'проблема', text);
  return send_(ctx.chat, '✅ Власникам повідомлено.');
}

/* ============================ ЗВІТ ============================ */

function report_(ctx, off) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - off, 1);
  const to = new Date(now.getFullYear(), now.getMonth() - off + 1, 1);
  const inMonth = d => d instanceof Date && d >= from && d < to;
  const all = rows_('Замовлення');
  const orders = all.filter(o => inMonth(o['Дата']) && o['Статус'] !== ST.CANC);
  const revenue = orders.reduce((s, o) => s + num_(o['До сплати']), 0);
  const cost = orders.reduce((s, o) => s + num_(o['Собівартість']), 0);
  const margin = revenue - cost;
  const avg = orders.length ? revenue / orders.length : 0;
  const gifts = orders.filter(o => o['Подарунок'] === 'Так').length;
  const nums = orders.map(o => String(o['№']));
  const pos = rows_('Позиції').filter(p => nums.indexOf(String(p['№ замовлення'])) >= 0);
  const aromas = {}, prods = {};
  pos.forEach(p => {
    const q = num_(p['Кількість']);
    if (p['Аромат']) aromas[p['Аромат']] = (aromas[p['Аромат']] || 0) + q;
    prods[p['Назва']] = (prods[p['Назва']] || 0) + q;
  });
  const top = (obj) => Object.keys(obj).sort((a, b) => obj[b] - obj[a]).slice(0, 5).map((k, i) => (i + 1) + '. ' + esc_(k) + ' — ' + obj[k] + ' шт').join('\n') || '—';
  const carts = rows_('Покинуті кошики').filter(r => inMonth(r['Дата']));
  const conv = carts.filter(r => r['Замовлення']).length;
  const repeat = orders.filter(o => all.some(x => String(x['TG_ID']) === String(o['TG_ID']) && num_(x['№']) < num_(o['№']) && x['Статус'] !== ST.CANC)).length;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const title = Utilities.formatDate(from, TZ, 'MM.yyyy');
  const L = ['<b>📊 Звіт за ' + title + '</b>', '',
    'Замовлень: <b>' + orders.length + '</b>',
    'Виручка: <b>' + money_(revenue) + '</b>',
    'Собівартість: ' + money_(cost),
    'Маржа: <b>' + money_(margin) + '</b> (' + pct(margin, revenue) + ')',
    'Середній чек: ' + money_(avg),
    'Подарунки: ' + gifts + ' (' + pct(gifts, orders.length) + ')',
    'Повторні покупки: ' + repeat + ' (' + pct(repeat, orders.length) + ')',
    'Покинуті кошики: ' + carts.length + ', повернулись ' + conv + ' (' + pct(conv, carts.length) + ')', '',
    '<b>Топ ароматів:</b>', top(aromas), '', '<b>Топ товарів:</b>', top(prods)];
  return show_(ctx, L.join('\n'), [[b_('⬅️ Попередній місяць', 'a:rep:' + (off + 1)), b_('Поточний', 'a:rep:0')], [b_('⬅️ Меню', 'a:menu')]]);
}

/* ============================ РОЗСИЛКИ ============================ */

function broadcastStart_(ctx) {
  return show_(ctx, '<b>📣 Розсилка</b>\nКому надсилаємо?', [
    [b_('👥 Усім підписаним', 'a:bca:all')], [b_('🌿 Хто купував аромат…', 'a:bca:aroma')], [b_('💼 Оптові клієнти', 'a:bca:opt')],
    [b_('😴 Неактивні ' + N_('Неактивні, днів') + '+ днів', 'a:bca:inactive')], [b_('🎂 Іменинники місяця', 'a:bca:bday')], [b_('⬅️ Меню', 'a:menu')]
  ]);
}
function broadcastAroma_(ctx, seg) {
  if (seg === 'aroma') {
    const list = [];
    rows_('Позиції').forEach(p => { if (p['Аромат'] && list.indexOf(String(p['Аромат'])) < 0) list.push(String(p['Аромат'])); });
    if (!list.length) return show_(ctx, 'Ще немає продажів з ароматами.', [[b_('⬅️ Назад', 'a:bc')]]);
    tmpPut_('bca' + ctx.chat, list);
    return show_(ctx, 'Оберіть аромат:', list.slice(0, 40).map((a, i) => [b_(a, 'a:bca:ar' + i)]));
  }
  let aroma = '';
  if (/^ar\d+$/.test(seg)) { aroma = (tmpGet_('bca' + ctx.chat) || [])[+seg.slice(2)] || ''; seg = 'aroma'; }
  setState_(ctx.chat, { s: 'bc', seg: seg, aroma: aroma, items: [] });
  const n = audience_(seg, aroma).length;
  return show_(ctx, 'Отримувачів: <b>' + n + '</b>' + (aroma ? ' (аромат «' + esc_(aroma) + '»)' : '') +
    '\n\nНадішліть текст або фото з підписом. Кілька фото — буде альбом. Потім натисніть «Переглянути».', [[b_('❌ Скасувати', 'a:bcx')]]);
}
function audience_(seg, aroma) {
  const clients = rows_('Клієнти').filter(c => c['TG_ID'] && bool_(c['Підписка']));
  if (seg === 'opt') return clients.filter(c => bool_(c['Опт погоджено']));
  if (seg === 'bday') {
    const mm = Utilities.formatDate(new Date(), TZ, 'MM');
    return clients.filter(c => String(c['Мій день народження'] || '').split('.')[1] === mm);
  }
  const orders = rows_('Замовлення').filter(o => o['Статус'] !== ST.CANC);
  if (seg === 'aroma') {
    const nums = rows_('Позиції').filter(p => String(p['Аромат']) === aroma).map(p => String(p['№ замовлення']));
    const ids = orders.filter(o => nums.indexOf(String(o['№'])) >= 0).map(o => String(o['TG_ID']));
    return clients.filter(c => ids.indexOf(String(c['TG_ID'])) >= 0);
  }
  if (seg === 'inactive') {
    const limit = addDays_(new Date(), -N_('Неактивні, днів'));
    const last = {};
    orders.forEach(o => { const id = String(o['TG_ID']); if (o['Дата'] instanceof Date && (!last[id] || o['Дата'] > last[id])) last[id] = o['Дата']; });
    return clients.filter(c => { const d = last[String(c['TG_ID'])] || c['Дата реєстрації']; return d instanceof Date && d < limit; });
  }
  return clients;
}
function broadcastCollect_(ctx, st, m) {
  if (m.photo) st.items.push({ t: 'photo', f: m.photo[m.photo.length - 1].file_id, c: m.caption || '' });
  else if (m.text) st.items.push({ t: 'text', x: m.text });
  else return send_(ctx.chat, 'Підтримуються текст і фото.');
  setState_(ctx.chat, st);
  return send_(ctx.chat, 'Додано (' + st.items.length + '). Можна додати ще або:', [[b_('👀 Переглянути', 'a:bcp'), b_('❌ Скасувати', 'a:bcx')]]);
}
function deliver_(chat, items) {
  const photos = items.filter(i => i.t === 'photo');
  const texts = items.filter(i => i.t === 'text');
  let r = { ok: true };
  if (photos.length > 1) r = tg_('sendMediaGroup', { chat_id: chat, media: photos.slice(0, 10).map((p, k) => ({ type: 'photo', media: p.f, caption: k === 0 ? p.c : '' })) }, true);
  else if (photos.length === 1) r = tg_('sendPhoto', { chat_id: chat, photo: photos[0].f, caption: photos[0].c }, true);
  if (r.ok) texts.forEach(t => { const x = tg_('sendMessage', { chat_id: chat, text: t.x }, true); if (!x.ok) r = x; });
  return r;
}
function broadcastPreview_(ctx) {
  const st = getState_(ctx.chat);
  if (!st || st.s !== 'bc' || !st.items.length) return answer_(ctx, 'Спочатку надішліть текст або фото', true);
  send_(ctx.chat, '👀 <b>Так побачать клієнти:</b>');
  deliver_(ctx.chat, st.items);
  const n = audience_(st.seg, st.aroma).length;
  return send_(ctx.chat, 'Надіслати <b>' + n + '</b> отримувачам?', [[b_('✅ Надіслати', 'a:bcs'), b_('❌ Скасувати', 'a:bcx')]]);
}
function broadcastSend_(ctx) {
  const st = getState_(ctx.chat);
  if (!st || st.s !== 'bc' || !st.items.length) return answer_(ctx, 'Розсилка застаріла', true);
  clearState_(ctx.chat);
  const list = audience_(st.seg, st.aroma);
  answer_(ctx, 'Надсилаю…');
  let ok = 0, fail = 0, blocked = 0;
  list.forEach(c => {
    const r = deliver_(c['TG_ID'], st.items);
    if (r.ok) ok++;
    else {
      fail++;
      if (r.error_code === 403) { blocked++; update_('Клієнти', c._row, { 'Підписка': false }); }
    }
    Utilities.sleep(40);
  });
  log_('INFO', ctx.staff.name, 'розсилка', 'сегмент ' + st.seg + (st.aroma ? ' ' + st.aroma : '') + ': доставлено ' + ok + ', помилок ' + fail + ', заблокували ' + blocked);
  return send_(ctx.chat, '📣 Розсилку завершено.\nДоставлено: <b>' + ok + '</b>\nНе доставлено: ' + fail + (blocked ? ' (заблокували бота: ' + blocked + ')' : ''));
}

/* ============================ ПРОМОКОДИ ============================ */

function promoList_(ctx) {
  const list = rows_('Промокоди');
  const L = ['<b>🎟 Промокоди</b>', ''];
  const kb = [];
  list.forEach(r => {
    L.push((bool_(r['Активний']) ? '✅ ' : '⛔ ') + '<code>' + esc_(r['Код']) + '</code> — ' + (r['Тип'] === '%' ? num_(r['Значення']) + '%' : money_(r['Значення'])) +
      (num_(r['Мін. сума']) ? ', від ' + money_(r['Мін. сума']) : '') + (r['Діє до'] ? ', до ' + fdate_(r['Діє до']) : '') + ', використано ' + num_(r['Використано']) + (num_(r['Ліміт']) ? '/' + num_(r['Ліміт']) : ''));
    kb.push([b_((bool_(r['Активний']) ? '⛔ Вимкнути ' : '✅ Увімкнути ') + r['Код'], 'a:promooff:' + r['Код'])]);
  });
  kb.unshift([b_('➕ Новий промокод', 'a:promoadd')]);
  kb.push([b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, L.join('\n'), kb);
}
function promoToggle_(ctx, code) {
  const r = find_('Промокоди', 'Код', code);
  if (r) { update_('Промокоди', r._row, { 'Активний': !bool_(r['Активний']) }); log_('INFO', ctx.staff.name, 'промокод ' + code, bool_(r['Активний']) ? 'вимкнено' : 'увімкнено'); }
  return promoList_(ctx);
}
function promoType_(ctx, t) {
  const st = getState_(ctx.chat);
  if (!st || st.s !== 'promo') return promoList_(ctx);
  st.d.type = t === 'pct' ? '%' : 'Сума'; st.step = 'val'; setState_(ctx.chat, st);
  return send_(ctx.chat, t === 'pct' ? 'Скільки відсотків знижки?' : 'Сума знижки, грн?');
}
function promoText_(ctx, st, text) {
  const d = st.d;
  const next = (step, q, kb) => { st.step = step; setState_(ctx.chat, st); return send_(ctx.chat, q, kb); };
  switch (st.step) {
    case 'code': {
      const code = text.toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return send_(ctx.chat, 'Код: 3–20 латинських літер/цифр.');
      if (find_('Промокоди', 'Код', code)) return send_(ctx.chat, 'Такий код уже є.');
      d.code = code;
      return next('type', 'Тип знижки?', [[b_('% відсоток', 'a:promot:pct'), b_('₴ сума', 'a:promot:sum')]]);
    }
    case 'val': { const v = num_(text); if (v <= 0) return send_(ctx.chat, 'Введіть число.'); d.val = v; return next('min', 'Мінімальна сума замовлення (0 — без обмеження):'); }
    case 'min': d.min = num_(text); return next('until', 'Діє до (ДД.ММ.РРРР) або «-» без терміну:');
    case 'until': { if (text !== '-') { const dt = parseDate_(text); if (!dt) return send_(ctx.chat, 'Формат: 31.12.2026 або «-»'); d.until = dt.getTime(); } return next('limit', 'Ліміт використань або «-» без ліміту:'); }
    case 'limit': {
      d.limit = text === '-' ? '' : Math.round(num_(text));
      clearState_(ctx.chat);
      append_('Промокоди', { 'Код': d.code, 'Тип': d.type, 'Значення': d.val, 'Мін. сума': d.min || 0, 'Діє до': d.until ? new Date(d.until) : '', 'Ліміт': d.limit, 'Використано': 0, 'Активний': true });
      log_('INFO', ctx.staff.name, 'новий промокод', d.code);
      send_(ctx.chat, '✅ Промокод <code>' + d.code + '</code> створено.');
      return promoList_(ctx);
    }
  }
}

/* ============================ КОМАНДА ============================ */

function teamList_(ctx) {
  const L = ['<b>👥 Команда</b>', ''];
  const kb = [];
  rows_('Команда').forEach(r => {
    L.push((bool_(r['Активний']) ? '🟢 ' : '⚪️ ') + esc_(r['Імʼя']) + ' — ' + esc_(r['Роль']) + ' · ID ' + esc_(r['TG_ID'] || '—'));
    if (String(r['TG_ID']) !== String(ctx.from.id)) kb.push([b_((bool_(r['Активний']) ? 'Вимкнути ' : 'Увімкнути ') + r['Імʼя'], 'a:teamtog:' + r._row)]);
  });
  kb.unshift([b_('➕ Додати людину', 'a:teamadd')]);
  kb.push([b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, L.join('\n'), kb);
}
function teamText_(ctx, st, text) {
  if (st.step === 'id') {
    if (!/^\d{5,15}$/.test(text)) return send_(ctx.chat, 'ID — це лише цифри. Людина може дізнатися його командою /id.');
    st.d.id = text; st.step = 'name'; setState_(ctx.chat, st);
    return send_(ctx.chat, 'Імʼя:');
  }
  if (st.step === 'name') {
    st.d.name = text.slice(0, 30); st.step = 'role'; setState_(ctx.chat, st);
    return send_(ctx.chat, 'Роль:', [[b_('👑 Власник', 'a:teamrole:owner'), b_('🧰 Помічник', 'a:teamrole:helper')]]);
  }
}
function teamRole_(ctx, role) {
  const st = getState_(ctx.chat);
  if (!st || st.s !== 'team' || !st.d.id) return teamList_(ctx);
  clearState_(ctx.chat);
  const roleName = role === 'owner' ? 'Власник' : 'Помічник';
  const ex = find_('Команда', 'TG_ID', st.d.id);
  if (ex) update_('Команда', ex._row, { 'Імʼя': st.d.name, 'Роль': roleName, 'Активний': true });
  else append_('Команда', { 'TG_ID': st.d.id, 'Імʼя': st.d.name, 'Роль': roleName, 'Активний': true });
  log_('INFO', ctx.staff.name, 'команда +', st.d.name + ' (' + roleName + ')');
  send_(st.d.id, '👋 Вас додано до команди ' + esc_(brand_()) + ' як «' + roleName + '». Натисніть /admin.', null, true);
  return teamList_(ctx);
}
function teamToggle_(ctx, row) {
  const r = rows_('Команда').find(x => x._row === row);
  if (!r) return teamList_(ctx);
  update_('Команда', row, { 'Активний': !bool_(r['Активний']) });
  log_('INFO', ctx.staff.name, 'команда', r['Імʼя'] + (bool_(r['Активний']) ? ' вимкнено' : ' увімкнено'));
  return teamList_(ctx);
}

/* ============================ НАЛАШТУВАННЯ ============================ */

function settingsList_(ctx) {
  const list = rows_('Налаштування');
  const L = ['<b>🔧 Налаштування</b>', 'Натисніть, щоб змінити. Повний список — в аркуші «Налаштування».', ''];
  list.forEach((r, i) => L.push((i + 1) + '. ' + esc_(r['Ключ']) + ': <b>' + esc_(String(r['Значення']).slice(0, 40)) + '</b>'));
  const kb = [];
  for (let i = 0; i < list.length; i += 4) kb.push(list.slice(i, i + 4).map((r, k) => b_(String(i + k + 1), 'a:sete:' + (i + k))));
  kb.push([b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, L.join('\n').slice(0, 4000), kb);
}
function settingEdit_(ctx, i) {
  const r = rows_('Налаштування')[i];
  if (!r) return settingsList_(ctx);
  setState_(ctx.chat, { s: 'setval', key: String(r['Ключ']) });
  return send_(ctx.chat, '<b>' + esc_(r['Ключ']) + '</b>\n' + esc_(r['Опис']) + '\nЗараз: <code>' + esc_(r['Значення']) + '</code>\n\nНапишіть нове значення:');
}
function settingText_(ctx, st, text) {
  clearState_(ctx.chat);
  setSetting_(st.key, text);
  log_('INFO', ctx.staff.name, 'налаштування', st.key + ' = ' + text);
  if (st.key === 'Ранкове зведення, година') installTriggers_();
  return send_(ctx.chat, '✅ «' + esc_(st.key) + '» = ' + esc_(text));
}

/* ============================ ЦІНИ ============================ */

function priceList_(ctx) {
  const kb = rows_('Товари').filter(p => p['ID']).map(p => [b_(p['ID'] + ' · ' + String(p['Назва']).slice(0, 28) + ' · ' + money_(p['Ціна']), 'a:pricep:' + p['ID'])]);
  kb.push([b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, '<b>💰 Ціни</b>\nОберіть товар:', kb);
}
function pricePick_(ctx, pid) {
  const vs = rows_('Варіанти').filter(v => String(v['ID товару']) === String(pid));
  if (!vs.length) return priceAsk_(ctx, 'Товари', pid);
  const kb = vs.map(v => [b_(variantLabel_(v) + ' · ' + money_(v['Ціна']), 'a:pricev:' + v['ID варіанту'])]);
  kb.push([b_('⬅️ Товари', 'a:price')]);
  return show_(ctx, 'Оберіть варіант:', kb);
}
function priceAsk_(ctx, sheet, id) {
  const r = sheet === 'Товари' ? product_(id) : variant_(id);
  if (!r) return priceList_(ctx);
  setState_(ctx.chat, { s: 'priceval', sheet: sheet, id: id });
  return send_(ctx.chat, 'Зараз: роздріб <b>' + money_(r['Ціна']) + '</b>, опт ' + money_(r['Оптова ціна']) + '\nНапишіть нову ціну або дві ціни через пробіл — роздріб і опт (напр. <b>450 340</b>):');
}
function priceText_(ctx, st, text) {
  const m = text.match(/^(\d+(?:[.,]\d+)?)(?:\s+(\d+(?:[.,]\d+)?))?$/);
  if (!m) return send_(ctx.chat, 'Формат: 450 або 450 340');
  clearState_(ctx.chat);
  const r = st.sheet === 'Товари' ? product_(st.id) : variant_(st.id);
  const upd = { 'Ціна': num_(m[1]) };
  if (m[2]) upd['Оптова ціна'] = num_(m[2]);
  update_(st.sheet, r._row, upd);
  log_('INFO', ctx.staff.name, 'ціна ' + st.id, JSON.stringify(upd));
  return send_(ctx.chat, '✅ Ціну оновлено.', [[b_('💰 Ціни', 'a:price')]]);
}

/* ============================ ЗАЯВКИ ОПТ ============================ */

function wsList_(ctx) {
  const list = rows_('Заявки').filter(r => r['Статус'] === 'Нова').slice(-15);
  if (!list.length) return show_(ctx, 'Нових заявок немає.', [[b_('⬅️ Меню', 'a:menu')]]);
  const L = ['<b>💼 Нові заявки</b>', ''];
  const kb = [];
  list.forEach(r => {
    L.push('• ' + fdate_(r['Дата']) + ' · ' + esc_(r['Тип']) + ' · <b>' + esc_(r['Компанія']) + '</b> · ' + esc_(r['Кількість']) + ' · ' + esc_(r['Бюджет']) + ' · ' + esc_(r['Контакт']));
    kb.push([b_('✅ ' + String(r['Компанія']).slice(0, 20), 'a:wsok:' + r._row), b_('❌', 'a:wsno:' + r._row)]);
  });
  kb.push([b_('⬅️ Меню', 'a:menu')]);
  return show_(ctx, L.join('\n'), kb);
}
function wsDecide_(ctx, row, ok) {
  const r = rows_('Заявки').find(x => x._row === row);
  if (!r) return answer_(ctx, 'Заявку не знайдено');
  if (r['Статус'] !== 'Нова') return answer_(ctx, 'Вже: ' + r['Статус'], true);
  update_('Заявки', row, { 'Статус': ok ? 'Погоджено' : 'Відхилено' });
  const c = find_('Клієнти', 'TG_ID', r['TG_ID']);
  if (ok && c) {
    update_('Клієнти', c._row, { 'Тип': r['Тип'] === 'Корпоратив' ? 'Корпоратив' : 'Опт', 'Опт погоджено': true });
    send_(r['TG_ID'], '✅ Вашу заявку погоджено! Тепер у каталозі ви бачите оптові ціни. Менеджер звʼяжеться щодо деталей.', null, true);
  } else if (c) {
    send_(r['TG_ID'], 'Дякуємо за заявку! Зараз не можемо запропонувати оптові умови, але менеджер звʼяжеться з вами щодо інших варіантів.', null, true);
  }
  log_('INFO', ctx.staff.name, 'заявка ' + (ok ? 'погоджена' : 'відхилена'), r['Компанія']);
  answer_(ctx, ok ? 'Погоджено' : 'Відхилено');
  if (ctx.cb && ctx.cb.message && ctx.cb.message.text && /Нова заявка/.test(ctx.cb.message.text)) {
    return edit_(ctx.chat, ctx.cb.message.message_id, esc_(ctx.cb.message.text) + '\n\n' + (ok ? '✅ Погоджено' : '❌ Відхилено') + ' (' + esc_(ctx.staff.name) + ')');
  }
  return wsList_(ctx);
}

/* ============================ ФОНОВІ ЗАВДАННЯ ============================ */

/** Щогодини: покинуті кошики. */
function hourlyJob() {
  try { abandonedCarts_(); } catch (e) { logErr_('hourlyJob', e); }
}

/** Кожні 2 години: трекінг Нової Пошти. */
function trackingJob() {
  try {
    if (!prop_('NP_API_KEY')) return;
    const list = rows_('Замовлення').filter(o => o['Статус'] === ST.SENT && o['ТТН']);
    if (list.length) trackOrders_(list);
  } catch (e) { logErr_('trackingJob', e); }
}

/** Щоранку: автозавершення, «свічка догорає», дати близьких, зведення команді. */
function morningJob() {
  [autoComplete_, burnReminders_, dateReminders_, morningSummary_].forEach(fn => {
    try { fn(); } catch (e) { logErr_('morningJob ' + fn.name, e); }
  });
}

/* ---------- покинуті кошики ---------- */

function abandonedCarts_() {
  const h1 = N_('Кошик: нагадування 1, год'), h2 = N_('Кошик: нагадування 2, год');
  const now = Date.now();
  rows_('Клієнти').slice().forEach(c => {
    if (!c['Кошик'] || !(c['Кошик оновлено'] instanceof Date) || !bool_(c['Підписка'])) return;
    const hrs = (now - c['Кошик оновлено'].getTime()) / 3600000;
    const stage = num_(c['Етап нагадування']);
    const lines = cartLines_(c).filter(l => l.ok);
    if (!lines.length) return;
    const sum = lines.reduce((s, l) => s + l.sum, 0);
    const list = lines.slice(0, 3).map(l => '• ' + esc_(l.name)).join('\n');
    if (stage < 1 && hrs >= h1 && hrs < h2) {
      send_(c['TG_ID'], '🕯 Ви залишили в кошику:\n' + list + '\n\nРазом: <b>' + money_(sum) + '</b>. Оформимо?', [[b_('🧺 Перейти в кошик', 'cart')]], true);
      update_('Клієнти', c._row, { 'Етап нагадування': 1 });
      append_('Покинуті кошики', { 'TG_ID': String(c['TG_ID']), 'Дата': new Date(), 'Сума': sum, 'Нагадування 1': new Date() });
    } else if (stage < 2 && hrs >= h2) {
      const code = String(S_('Кошик: промокод')).toUpperCase();
      const pr = rows_('Промокоди').find(r => String(r['Код']).toUpperCase() === code && bool_(r['Активний']));
      const promo = pr ? '\n\n🎟 Промокод <code>' + esc_(code) + '</code> — ' + (pr['Тип'] === '%' ? num_(pr['Значення']) + '%' : money_(pr['Значення'])) + ' знижки' + (num_(pr['Мін. сума']) ? ' від ' + money_(pr['Мін. сума']) : '') + '.' : '';
      send_(c['TG_ID'], '🕯 Ваш кошик ще чекає:\n' + list + promo, [[b_('🧺 Оформити', 'cart')]], true);
      update_('Клієнти', c._row, { 'Етап нагадування': 2 });
      const ab = rows_('Покинуті кошики').filter(r => String(r['TG_ID']) === String(c['TG_ID']) && !r['Замовлення']).pop();
      if (ab) update_('Покинуті кошики', ab._row, { 'Нагадування 2': new Date() });
      else append_('Покинуті кошики', { 'TG_ID': String(c['TG_ID']), 'Дата': new Date(), 'Сума': sum, 'Нагадування 2': new Date() });
    }
  });
}

/* ---------- трекінг ---------- */

const NP_RECEIVED = ['9', '10', '11', '106'];
const NP_ARRIVED = ['7', '8'];
const NP_REFUSED = ['102', '103', '108', '105', '111'];

function trackOrders_(orders) {
  const res = npTrack_(orders.map(o => ({ ttn: o['ТТН'], phone: o['Телефон отримувача'] })));
  const waitDays = N_('Посилка лежить, днів');
  orders.forEach(o0 => {
    const o = orderByNo_(o0['№']);
    const st = res[String(o['ТТН'])];
    if (!st) return;
    const changed = st.text && st.text !== o['Статус НП'];
    if (changed) update_('Замовлення', o._row, { 'Статус НП': st.text });
    if (NP_RECEIVED.indexOf(st.code) >= 0) return onReceived_(orderByNo_(o['№']), 'Нова Пошта');
    if (NP_ARRIVED.indexOf(st.code) >= 0) {
      const cur = orderByNo_(o['№']);
      if (!cur['Прибуло']) {
        update_('Замовлення', cur._row, { 'Прибуло': new Date() });
        send_(cur['TG_ID'], '📬 Замовлення №' + cur['№'] + ' вже у відділенні: ' + esc_(cur['Відділення']) + '.', [[u_('📍 Деталі', trackUrl_(cur['ТТН']))]], true);
      } else if (!cur['Нагадано про посилку'] && cur['Прибуло'] instanceof Date && daysBetween_(cur['Прибуло'], new Date()) >= waitDays) {
        send_(cur['TG_ID'], '⏰ Нагадуємо: посилка №' + cur['№'] + ' чекає у відділенні ' + esc_(cur['Відділення']) + '. Заберіть її, будь ласка, щоб не повернулась 🕯', null, true);
        update_('Замовлення', cur._row, { 'Нагадано про посилку': new Date() });
      }
    }
    if (NP_REFUSED.indexOf(st.code) >= 0 && changed) {
      notifyOwners_('↩️ <b>Відмова / повернення</b> №' + o['№'] + ': ' + esc_(st.text), [[b_('Відкрити', 'a:o:' + o['№'])]]);
    }
    if (changed) refreshCards_(o['№']);
  });
}

/* ---------- автозавершення ---------- */

function autoComplete_() {
  const days = N_('Автозавершення через, днів') || 7;
  rows_('Замовлення').slice().forEach(o => {
    if (o['Статус'] === ST.RECV && o['Отримано'] instanceof Date && daysBetween_(o['Отримано'], new Date()) >= days) {
      setStatus_(orderByNo_(o['№']), ST.DONE, 'система', true);
    }
  });
}

/* ---------- свічка догорає ---------- */

function burnReminders_() {
  const today = dayStart_(new Date());
  rows_('Позиції').slice().forEach(p => {
    if (!(p['Нагадати догорає'] instanceof Date) || bool_(p['Нагадано']) || dayStart_(p['Нагадати догорає']) > today) return;
    const o = orderByNo_(p['№ замовлення']);
    update_('Позиції', p._row, { 'Нагадано': true });
    if (!o || o['Статус'] === ST.CANC) return;
    const prod = product_(p['ID товару']);
    const v = variant_(p['ID варіанту']);
    const can = prod && avail_(prod, v, 1).ok;
    send_(o['TG_ID'], '🕯 Схоже, ваша свічка «' + esc_(p['Назва']) + '» скоро догорить.' + (p['Аромат'] ? '\nЗамовити ще раз аромат «' + esc_(p['Аромат']) + '»?' : ''),
      can ? [[b_('🔁 Дозамовити', 'ro:' + p['ID товару'] + ':' + (p['ID варіанту'] || ''))], [b_('🛍 Каталог', 'cat')]] : [[b_('🛍 Каталог', 'cat')]], true);
  });
}

/* ---------- дати близьких ---------- */

function giftPicks_() {
  const ps = products_().filter(p => p['Категорія'] === 'Набори' || p['Категорія'] === 'Свічки' || p['Категорія'] === 'Подарункові сертифікати');
  const scored = ps.map(p => {
    const vs = variants_(p['ID']);
    const ok = vs.length ? vs.some(v => avail_(p, v, 1).ok && !avail_(p, v, 1).mto) : (avail_(p, null, 1).ok && !avail_(p, null, 1).mto);
    return { p: p, s: (p['Категорія'] === 'Набори' ? 2 : 0) + (ok ? 1 : 0) };
  }).sort((a, b) => b.s - a.s);
  return scored.slice(0, 3).map(x => x.p);
}

function dateReminders_() {
  const before = N_('Нагадувати про дати за, днів') || 7;
  const today = dayStart_(new Date());
  rows_('Дати клієнтів').slice().forEach(r => {
    const m = String(r['Дата']).replace("'", '').match(/^(\d{1,2})\.(\d{1,2})/);
    if (!m) return;
    let next = new Date(today.getFullYear(), +m[2] - 1, +m[1]);
    if (next < today) next = new Date(today.getFullYear() + 1, +m[2] - 1, +m[1]);
    if (daysBetween_(today, next) !== before) return;
    if (String(r['Нагадано рік']) === String(next.getFullYear())) return;
    const picks = giftPicks_();
    const kb = picks.map(p => [b_('🎁 ' + p['Назва'], 'p:' + p['ID'])]);
    kb.push([b_('🎁 Зібрати свій набір', 'set')]);
    send_(r['TG_ID'], '🎂 Через ' + before + ' днів — ' + esc_(r['Привід']).toLowerCase() + ' у <b>' + esc_(r['Імʼя близького']) + '</b> (' + esc_(String(r['Дата']).replace("'", '')) + ').\n' +
      'Встигнемо з подарунком — ось кілька ідей. Можна доставити одразу отримувачу з листівкою 💌', kb, true);
    update_('Дати клієнтів', r._row, { 'Нагадано рік': next.getFullYear() });
  });
}

/* ---------- ранкове зведення ---------- */

function morningSummary_() {
  const orders = rows_('Замовлення');
  const today = dayStart_(new Date());
  const yest = addDays_(today, -1);
  const active = o => o['Статус'] !== ST.DONE && o['Статус'] !== ST.CANC;
  const newO = orders.filter(o => o['Статус'] === ST.NEW);
  const prodWait = rows_('Виробництво').filter(r => r['Статус'] === 'Чекає');
  const castQty = prodWait.reduce((s, r) => s + num_(r['Кількість']), 0);
  const ready = orders.filter(o => o['Статус'] === ST.READY);
  const toPack = ready.filter(o => !o['Запаковано']);
  const toShip = ready.filter(o => o['Запаковано']);
  const thr = N_('Поріг залишку');
  const lowGoods = [];
  rows_('Товари').filter(p => bool_(p['Активний'])).forEach(p => {
    const vs = variants_(p['ID']);
    if (vs.length) vs.forEach(v => { if (v['Залишок'] !== '' && num_(v['Залишок']) <= thr) lowGoods.push(itemName_(p, v) + ': ' + num_(v['Залишок'])); });
    else if (p['Залишок'] !== '' && num_(p['Залишок']) <= thr) lowGoods.push(p['Назва'] + ': ' + num_(p['Залишок']));
  });
  const lowRaw = rows_('Сировина').filter(r => num_(r['Залишок']) <= num_(r['Мін. залишок'])).map(r => r['Назва'] + ': ' + num_(r['Залишок']) + ' ' + r['Одиниця']);
  const unpaid = orders.filter(o => o['Статус'] !== ST.CANC && (o['Статус оплати'] === PAYST.WAIT || o['Статус оплати'] === PAYST.FAIL));
  const reviews = rows_('Відгуки').filter(r => r['Дата'] instanceof Date && r['Дата'] >= yest);
  const yOrders = orders.filter(o => o['Дата'] instanceof Date && o['Дата'] >= yest && o['Дата'] < today && o['Статус'] !== ST.CANC);
  const revenue = yOrders.reduce((s, o) => s + num_(o['До сплати']), 0);
  const groups = {};
  prodWait.forEach(r => { const k = (r['Аромат'] || r['Назва']) + ' · ' + (r['Обʼєм'] || ''); groups[k] = (groups[k] || 0) + num_(r['Кількість']); });
  const castList = Object.keys(groups).map(k => '• ' + esc_(k) + ' — ' + groups[k] + ' шт').join('\n');
  const nums = list => list.map(o => '№' + o['№']).join(', ');

  team_().forEach(m => {
    let L;
    if (m.role === 'owner') {
      const mine = orders.filter(o => active(o) && String(o['Відповідальний']) === m.name);
      L = ['☀️ <b>Доброго ранку, ' + esc_(m.name) + '!</b>', '',
        '🆕 Нові: <b>' + newO.length + '</b>' + (newO.length ? ' (' + nums(newO) + ')' : ''),
        '🫗 Відлити: <b>' + castQty + ' шт</b>' + (castList ? '\n' + castList : ''),
        '📦 Запакувати: <b>' + toPack.length + '</b>' + (toPack.length ? ' (' + nums(toPack) + ')' : ''),
        '🚚 Відправити/видати: <b>' + toShip.length + '</b>' + (toShip.length ? ' (' + nums(toShip) + ')' : ''),
        '💳 Неоплачені: <b>' + unpaid.length + '</b>' + (unpaid.length ? ' (' + nums(unpaid) + ')' : ''),
        '⭐ Відгуки за добу: <b>' + reviews.length + '</b>' + (reviews.length ? ' (середня ' + (reviews.reduce((s, r) => s + num_(r['Оцінка']), 0) / reviews.length).toFixed(1) + ')' : ''),
        '💰 Виручка вчора: <b>' + money_(revenue) + '</b> (' + yOrders.length + ' замовл.)'];
      if (lowGoods.length) L.push('', '⚠️ <b>Мало готових:</b>\n' + lowGoods.map(x => '• ' + esc_(x)).join('\n'));
      if (lowRaw.length) L.push('', '🛒 <b>Закупити:</b>\n' + lowRaw.map(x => '• ' + esc_(x)).join('\n'));
      L.push('', '🙋 <b>Що на тобі:</b> ' + (mine.length ? mine.map(o => '№' + o['№'] + ' (' + o['Статус'] + ')').join(', ') : 'нічого'));
    } else {
      L = ['☀️ <b>Доброго ранку, ' + esc_(m.name) + '!</b>', '',
        '🫗 Відлити: <b>' + castQty + ' шт</b>' + (castList ? '\n' + castList : ''),
        '📦 Запакувати: <b>' + toPack.length + '</b>' + (toPack.length ? ' (' + nums(toPack) + ')' : ''),
        '🚚 Відправити/видати: <b>' + toShip.length + '</b>' + (toShip.length ? ' (' + nums(toShip) + ')' : '')];
      if (lowRaw.length) L.push('', '🛒 <b>Бракує на складі:</b>\n' + lowRaw.map(x => '• ' + esc_(x)).join('\n'));
    }
    send_(m.id, L.join('\n'), [[b_('🏭 Виробництво', 'a:pq'), b_('📦 Пакування', 'a:pk')]].concat(m.role === 'owner' ? [[b_('⚙️ Керування', 'a:menu')]] : []), true);
  });
}
