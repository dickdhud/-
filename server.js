/* =====================================================================
   آتلیه نُوار — سرور فروشگاه (Node خالص، بدون هیچ پکیج اضافی)
   ----------------------------------------------------------------------
   • سرو فایل‌های استاتیک سایت
   • API محصولات (CRUD) — فقط با توکن ادمین
   • API سفارش‌ها (ثبت عمومی + مدیریت ادمین)
   • آپلود تصویر محصول روی سرور
   • رمز ادمین از متغیر محیطی ADMIN_PASS خوانده می‌شود (پیش‌فرض noir123)

   اجرا:  node server.js        (پورت پیش‌فرض 8080 — با PORT قابل تغییر)
   ===================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const UP_DIR = path.join(ROOT, 'assets', 'uploads');
const PORT = process.env.PORT || 8080;
const ADMIN_PASS = process.env.ADMIN_PASS || 'noir123';

/* ---------- درگاه پرداخت زرین‌پال ----------
   برای فعال‌سازی واقعی، این متغیرهای محیطی را روی هاست تنظیم کنید:
   ZP_MERCHANT = شناسه پذیرنده (از zarinpal.com)
   BASE_URL    = آدرس عمومی سایت مثل https://noir-shop.onrender.com
   ZP_MODE     = 'live' (پیش‌فرض) یا 'sandbox' برای تست               */
const ZP_MERCHANT = process.env.ZP_MERCHANT || '';
const BASE_URL = (process.env.BASE_URL || ('http://localhost:' + PORT)).replace(/\/+$/, '');
const ZP_MODE = process.env.ZP_MODE || 'live';
const ZP_BASE = ZP_MODE === 'sandbox' ? 'https://sandbox.zarinpal.com/pg/v4/payment' : 'https://payment.zarinpal.com/pg/v4/payment';
const ZP_START = ZP_MODE === 'sandbox' ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://payment.zarinpal.com/pg/StartPay/';

const { DEFAULT_PRODUCTS } = require('./js/data.js');

/* ------------------------ بارگذاری / ذخیره دیتابیس ------------------------ */
let DB = { products: null, orders: [] };
try { DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { }
if (!Array.isArray(DB.products) || !DB.products.length) {
  DB.products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
}
if (!Array.isArray(DB.orders)) DB.orders = [];

/* نظرات نمونه برای شروع */
const SEED_REVIEWS = [
  { id: 'r1', productId: 'coat', name: 'نگار', rating: 5, text: 'کیفیت پارچه فوق‌العاده‌ست؛ دقیقاً همون چیزیه که توی عکس‌ها می‌بینید. بسته‌بندی هم واقعاً شیک بود.', date: 'شهریور ۱۴۰۵', created: Date.now() - 86400000 * 3 },
  { id: 'r2', productId: 'coat', name: 'سارا م.', rating: 5, text: 'برای عقدم خریدم؛ همه‌جا می‌پرسن از کجاست!', date: 'شهریور ۱۴۰۵', created: Date.now() - 86400000 * 6 },
  { id: 'r3', productId: 'bag', name: 'مونا', rating: 4, text: 'چرم واقعی بودنش محرزه. کاش رنگ‌بندی بیشتری هم داشت.', date: 'مرداد ۱۴۰۵', created: Date.now() - 86400000 * 20 }
];

if (!Array.isArray(DB.reviews)) DB.reviews = SEED_REVIEWS.slice();

/* کدهای تخفیف نمونه برای شروع */
const SEED_DISCOUNTS = [
  { code: 'NOIR10', percent: 10, active: true },
  { code: 'WELCOME15', percent: 15, active: true }
];
if (!Array.isArray(DB.discounts)) DB.discounts = SEED_DISCOUNTS.map(d => ({ ...d }));
/* تنظیمات لبه سایت (اوررایدهای ادمین روی config.js) */
if (!DB.settings || typeof DB.settings !== 'object') DB.settings = {};
/* رمز فعلی ادمین: اولی محیطی است تا بعداً از پنل تعیین شود (null = از env) */
if (DB.adminPass === undefined) DB.adminPass = null;
const effPass = () => DB.adminPass || ADMIN_PASS;
/* کارمندان (مدیران فروشگاه) — هرکدام نام کاربری/رمز/سطح دسترسی جدا */
if (!Array.isArray(DB.managers)) DB.managers = [];
/* DB.managers: [{ id, name, user, pass, perms:['products','orders','discounts'], created }] */
saveDB();

function saveDB() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(DB));
  } catch (e) { console.error('⚠ DB save failed:', e.message); }
}

/* ------------------------ نشست‌های ادمین (توکن) ------------------------ */
const sessions = new Map();
function newToken(role = 'owner', mgrId = null) {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, { exp: Date.now() + 12 * 3600 * 1000, role, mgrId });
  return t;
}
function authSession(req) {
  const t = req.headers['x-admin-token'];
  if (!t || !sessions.has(t)) return null;
  const s = sessions.get(t);
  if (s.exp < Date.now()) { sessions.delete(t); return null; }
  return s;                                          // { role, mgrId, exp }
}
function authOK(req) { return authSession(req) !== null; }
function ownerOK(req) { const s = authSession(req); return !!s && s.role === 'owner'; }
const ALL_PERMS = ['products', 'orders', 'discounts'];
function permOK(req, perm) {
  const s = authSession(req);
  if (!s) return false;
  if (s.role === 'owner') return true;               // مالک همه کاره است
  if (s.role !== 'manager') return false;
  const m = DB.managers.find(x => x.id === s.mgrId); // تازه از دیتابیس — حذف مدیر بلافاصله اثر می‌کند
  return !!m && Array.isArray(m.perms) && m.perms.includes(perm);
}

/* ------------------------ ابزار ------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function send(res, code, bodyObj, headers = {}) {
  const isJSON = typeof bodyObj === 'object' && bodyObj !== null && !Buffer.isBuffer(bodyObj);
  const body = isJSON ? JSON.stringify(bodyObj) : String(bodyObj);
  res.writeHead(code, { 'Content-Type': isJSON ? 'application/json; charset=utf-8' : (headers['Content-Type'] || 'text/plain; charset=utf-8'), ...headers });
  res.end(body);
}

function readBody(req, limitMB = 20) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limitMB * 1024 * 1024) { reject(new Error('body too large')); try { req.destroy(); } catch (e) { } }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function cleanProduct(p) {
  p = p || {};
  return {
    id: String(p.id || ('p' + Date.now().toString(36))).slice(0, 40),
    name: String(p.name || '').slice(0, 120),
    en: String(p.en || '').slice(0, 80),
    cat: ['women', 'men', 'acc'].includes(p.cat) ? p.cat : 'acc',
    price: Math.max(0, Math.round(Number(p.price) || 0)),
    old: Math.max(0, Math.round(Number(p.old) || 0)),
    tag: String(p.tag || '').slice(0, 20),
    img: String(p.img || '').slice(0, 400),
    sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes.map(String).slice(0, 10) : ['تک‌سایز'],
    colors: Array.isArray(p.colors) ? p.colors.slice(0, 10).map(c => ({ n: String((c || {}).n || ''), c: String((c || {}).c || '#171512').slice(0, 9) })) : [],
    desc: String(p.desc || '').slice(0, 2000),
    fabric: String(p.fabric || '').slice(0, 1200),
    care: String(p.care || '').slice(0, 1200),
    hidden: !!p.hidden
  };
}

/* ------------------------ ضد اسپم لاگین ------------------------ */
const loginAttempts = new Map();
function rateBlock(ip) {
  const rec = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - rec.t > 10 * 60 * 1000) { rec.n = 0; rec.t = Date.now(); }
  if (rec.n >= 15) return true;
  rec.n++; loginAttempts.set(ip, rec);
  return false;
}

/* ------------------------ API ------------------------ */
async function handleApi(req, res, pathn) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  /* سلامت */
  if (pathn === '/api/health') return send(res, 200, { ok: true, mode: 'server', products: DB.products.length });

  /* ورود: مالک فقط با رمز — مدیران فروشگاه با نام کاربری + رمز */
  if (pathn === '/api/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'x';
    if (rateBlock(ip)) return send(res, 429, { error: 'تعداد تلاش‌ها بیش از حد است؛ کمی بعد تلاش کنید' });
    let body = {};
    try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { }
    const user = String(body.user || '').trim();
    if (!user && body.pass === effPass()) { loginAttempts.delete(ip); return send(res, 200, { token: newToken('owner'), role: 'owner' }); }
    if (user) {
      const m = DB.managers.find(x => x.user.toLowerCase() === user.toLowerCase() && x.pass === String(body.pass || ''));
      if (m) { loginAttempts.delete(ip); return send(res, 200, { token: newToken('manager', m.id), role: 'manager', perms: m.perms, name: m.name || m.user, user: m.user }); }
    }
    return send(res, 401, { error: 'نام کاربری یا رمز اشتباه است' });
  }

  /* ---------- مدیریت مدیران فروشگاه — فقط مالک ---------- */
  if (pathn === '/api/managers' && req.method === 'GET') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    return send(res, 200, DB.managers.map(m => ({ id: m.id, user: m.user, name: m.name, perms: m.perms, created: m.created })));
  }
  if (pathn === '/api/managers' && req.method === 'POST') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'بدنه نامعتبر' }); }
    const user = String(b.user || '').trim();
    const pass = String(b.pass || '');
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(user)) return send(res, 400, { error: 'نام کاربری باید ۳ تا ۴۰ کاراکتر لاتین/عدد باشد' });
    if (user.toLowerCase() === 'owner' || user.toLowerCase() === 'admin') return send(res, 400, { error: 'این نام کاربری مجاز نیست' });
    if (DB.managers.some(m => m.user.toLowerCase() === user.toLowerCase())) return send(res, 400, { error: 'این نام کاربری قبلاً تعریف شده است' });
    if (pass.length < 4 || pass.length > 60) return send(res, 400, { error: 'رمز باید ۴ تا ۶۰ کاراکتر باشد' });
    const perms = (Array.isArray(b.perms) ? b.perms : []).filter(p => ALL_PERMS.includes(p));
    const m = { id: crypto.randomBytes(6).toString('hex'), user, pass, name: String(b.name || '').slice(0, 60), perms, created: new Date().toISOString() };
    DB.managers.push(m); saveDB();
    return send(res, 200, { id: m.id, user: m.user, name: m.name, perms: m.perms, created: m.created });
  }
  let mm = pathn.match(/^\/api\/managers\/([^\/]+)$/);
  if (mm && req.method === 'PUT') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    const m = DB.managers.find(x => x.id === mm[1]);
    if (!m) return send(res, 404, { error: 'مدیر پیدا نشد' });
    let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'بدنه نامعتبر' }); }
    if (b.perms !== undefined) m.perms = (Array.isArray(b.perms) ? b.perms : []).filter(p => ALL_PERMS.includes(p));
    if (b.name !== undefined) m.name = String(b.name || '').slice(0, 60);
    if (b.pass) {
      const np = String(b.pass);
      if (np.length < 4 || np.length > 60) return send(res, 400, { error: 'رمز باید ۴ تا ۶۰ کاراکتر باشد' });
      m.pass = np;
      for (const [t, s] of sessions) if (s.mgrId === m.id) sessions.delete(t);   // نشست‌های قدیمی باطل
    }
    saveDB();
    return send(res, 200, { id: m.id, user: m.user, name: m.name, perms: m.perms, created: m.created });
  }
  if (mm && req.method === 'DELETE') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    const before = DB.managers.length;
    DB.managers = DB.managers.filter(x => x.id !== mm[1]);
    for (const [t, s] of sessions) if (s.mgrId === mm[1]) sessions.delete(t);      // نشست‌های او باطل می‌شود
    saveDB();
    return send(res, 200, { ok: true, removed: before - DB.managers.length });
  }

  /* لیست محصولات — عمومی */
  if (pathn === '/api/products' && req.method === 'GET') return send(res, 200, DB.products);

  /* افزودن محصول */
  if (pathn === '/api/products' && req.method === 'POST') {
    if (!(permOK(req, 'products'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    let p; try { p = cleanProduct(JSON.parse(await readBody(req))); } catch (e) { return send(res, 400, { error: 'bad json' }); }
    if (!p.name) return send(res, 400, { error: 'نام محصول الزامی است' });
    if (DB.products.some(x => x.id === p.id)) p.id += '-' + Math.floor(Math.random() * 999);
    DB.products.unshift(p); saveDB();
    return send(res, 201, p);
  }

  /* ویرایش محصول */
  let m = pathn.match(/^\/api\/products\/([^\/]+)$/);
  if (m && req.method === 'PUT') {
    if (!(permOK(req, 'products'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    const i = DB.products.findIndex(x => x.id === m[1]);
    if (i === -1) return send(res, 404, { error: 'محصول پیدا نشد' });
    let p; try { p = cleanProduct(JSON.parse(await readBody(req))); } catch (e) { return send(res, 400, { error: 'bad json' }); }
    p.id = DB.products[i].id;
    DB.products[i] = p; saveDB();
    return send(res, 200, p);
  }

  /* حذف محصول */
  if (m && req.method === 'DELETE') {
    if (!(permOK(req, 'products'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    const before = DB.products.length;
    DB.products = DB.products.filter(x => x.id !== m[1]);
    saveDB();
    return send(res, 200, { ok: true, removed: before - DB.products.length });
  }

  /* آپلود تصویر (base64 → فایل روی سرور) */
  if (pathn === '/api/upload' && req.method === 'POST') {
    if (!authOK(req)) return send(res, 401, { error: 'unauthorized' });
    let body = {}; try { body = JSON.parse(await readBody(req, 25)); } catch (e) { return send(res, 400, { error: 'bad json' }); }
    const mm = String(body.data || '').match(/^data:image\/(jpeg|png|jpg|webp);base64,(.+)$/s);
    if (!mm) return send(res, 400, { error: 'فرمت تصویر معتبر نیست' });
    const buf = Buffer.from(mm[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return send(res, 413, { error: 'حجم تصویر زیاد است' });
    fs.mkdirSync(UP_DIR, { recursive: true });
    const name = 'u_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex') + (mm[1] === 'png' ? '.png' : mm[1] === 'webp' ? '.webp' : '.jpg');
    fs.writeFileSync(path.join(UP_DIR, name), buf);
    return send(res, 201, { path: 'assets/uploads/' + name });
  }

  /* لیست سفارش‌ها — ادمین */
  if (pathn === '/api/orders' && req.method === 'GET') {
    if (!(permOK(req, 'orders'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    return send(res, 200, DB.orders);
  }

  /* ثبت سفارش — عمومی */
  if (pathn === '/api/orders' && req.method === 'POST') {
    let o; try { o = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'bad json' }); }
    o = o || {};
    const b = o.buyer || {};
    const pids = new Set(DB.products.map(p => p.id));
    const order = {
      no: String(o.no || ('NOIR-' + (10000 + Math.floor(Math.random() * 89999)))).slice(0, 24),
      date: String(o.date || new Date().toLocaleDateString('fa-IR')),
      items: (Array.isArray(o.items) ? o.items : []).filter(it => pids.has(it.id)).slice(0, 50),
      sub: Math.max(0, Math.round(+o.sub || 0)),
      disc: Math.max(0, Math.round(+o.disc || 0)),
      fee: Math.max(0, Math.round(+o.fee || 0)),
      total: Math.max(0, Math.round(+o.total || 0)),
      ship: String(o.ship || '').slice(0, 60),
      pay: String(o.pay || '').slice(0, 60),
      couponCode: String(o.couponCode || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24),
      buyer: {
        name: String(b.name || '').slice(0, 90),
        mobile: String(b.mobile || '').slice(0, 20),
        city: String(b.city || '').slice(0, 140),
        addr: String(b.addr || '').slice(0, 400)
      },
      status: 'در حال پردازش',
      created: Date.now()
    };
    if (!order.items.length) return send(res, 400, { error: 'سبد خرید نامعتبر است' });
    DB.orders.unshift(order); saveDB();
    return send(res, 201, { ok: true, no: order.no });
  }

  /* تغییر وضعیت سفارش */
  m = pathn.match(/^\/api\/orders\/([^\/]+)$/);
  if (m && req.method === 'PATCH') {
    if (!(permOK(req, 'orders'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { }
    const o = DB.orders.find(x => x.no === decodeURIComponent(m[1]));
    if (!o) return send(res, 404, { error: 'سفارش پیدا نشد' });
    o.status = String(b.status || o.status).slice(0, 40);
    saveDB();
    return send(res, 200, { ok: true, status: o.status });
  }

  /* ---------- تنظیمات سایت ---------- */

  /* دریافت تنظیمات لبه سایت — عمومی (بدون رمز ادمین!) */
  if (pathn === '/api/settings' && req.method === 'GET') {
    const { adminPass, ...safe } = DB.settings || {};
    return send(res, 200, safe);
  }

  /* ذخیره تنظیمات — ادمین */
  if (pathn === '/api/settings' && req.method === 'POST') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'بدنه نامعتبر' }); }
    /* فقط کلیدهای مجاز — هر رشته با سقف طول */
    const ALLOW = {
      brandFa: 60, brandEn: 60, announce: 300, phone: 40, email: 80, address: 200, hours: 80,
      'hero.kick': 80, 'hero.t1': 80, 'hero.t2': 40, 'hero.t3': 40, 'hero.sub': 300,
      'imgs.hero': 400, 'imgs.lookbook': 400, 'imgs.catWomen': 400, 'imgs.catMen': 400, 'imgs.catAcc': 400
    };
    const next = { ...(DB.settings || {}) };
    for (const [k, max] of Object.entries(ALLOW)) {
      let val;
      if (k.startsWith('hero.')) val = b.hero && b.hero[k.slice(5)];
      else if (k.startsWith('imgs.')) val = b.imgs && b.imgs[k.slice(5)];
      else val = b[k];
      if (typeof val === 'string' && val.trim()) {
        const clean = val.slice(0, max);
        if (val.startsWith('data:')) continue;                    // مسیر لازم است، نه دیتای خام
        if (k.startsWith('hero.')) { next.hero = next.hero || {}; next.hero[k.slice(5)] = clean; }
        else if (k.startsWith('imgs.')) { next.imgs = next.imgs || {}; next.imgs[k.slice(5)] = clean; }
        else next[k] = clean;
      }
    }
    if (typeof b.freeShippingAt === 'number' && b.freeShippingAt >= 0 && b.freeShippingAt <= 1e10)
      next.freeShippingAt = Math.round(b.freeShippingAt);
    DB.settings = next;
    saveDB();
    return send(res, 200, { ok: true });
  }

  /* تغییر رمز عبور مالک (یا رمز مدیر فروشگاه با mgr:true) — فقط مالک */
  if (pathn === '/api/settings/pass' && req.method === 'POST') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'بدنه نامعتبر' }); }
    if (String(b.current || '') !== effPass()) return send(res, 403, { error: 'رمز فعلی اشتباه است' });
    const np = String(b.next || '');
    if (np.length < 4 || np.length > 60) return send(res, 400, { error: 'رمز جدید باید ۴ تا ۶۰ کاراکتر باشد' });
    DB.adminPass = np;
    saveDB();
    return send(res, 200, { ok: true });
  }

  /* ---------- کدهای تخفیف ---------- */

  /* اعتبارسنجی کد تخفیف — عمومی (فقط کدهای فعال) */
  if (pathn === '/api/discounts/validate' && req.method === 'GET') {
    const code = String(new URL(req.url, 'http://x').searchParams.get('code') || '').trim().toUpperCase();
    const d = DB.discounts.find(x => x.active && x.code.toUpperCase() === code);
    if (!d) return send(res, 404, { ok: false, error: 'کد معتبر نیست یا غیرفعال شده' });
    return send(res, 200, { ok: true, code: d.code, percent: d.percent });
  }

  /* لیست همه کدها — ادمین */
  if (pathn === '/api/discounts' && req.method === 'GET') {
    if (!(permOK(req, 'discounts'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    return send(res, 200, DB.discounts);
  }

  /* افزودن کد — ادمین */
  if (pathn === '/api/discounts' && req.method === 'POST') {
    if (!(permOK(req, 'discounts'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    let b = {}; try { b = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'بدنه نامعتبر' }); }
    const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
    const percent = Math.min(90, Math.max(1, Math.round(Math.abs(+b.percent || 0))));
    if (!code) return send(res, 400, { error: 'متن کد لازم است (حروف/عدد انگلیسی)' });
    if (!percent) return send(res, 400, { error: 'درصد باید بین ۱ تا ۹۰ باشد' });
    if (DB.discounts.some(x => x.code.toUpperCase() === code)) return send(res, 409, { error: 'این کد از قبل وجود دارد' });
    if (DB.discounts.length >= 200) return send(res, 400, { error: 'حداکثر تعداد کدها پر شده است' });
    DB.discounts.push({ code, percent, active: true });
    saveDB();
    return send(res, 201, { ok: true, code });
  }

  /* فعال/غیرفعال کردن یا حذف کد — ادمین */
  {
    const dm = pathn.match(/^\/api\/discounts\/([^\/]+)$/);
    if (dm && dm[1] !== 'validate') {
      if (!(permOK(req, 'discounts'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
      const code = decodeURIComponent(dm[1]).toUpperCase();
      const d = DB.discounts.find(x => x.code.toUpperCase() === code);
      if (!d) return send(res, 404, { error: 'کد پیدا نشد' });
      if (req.method === 'PATCH') {
        d.active = !d.active;
        saveDB();
        return send(res, 200, { ok: true, active: d.active });
      }
      if (req.method === 'DELETE') {
        DB.discounts = DB.discounts.filter(x => x.code.toUpperCase() !== code);
        saveDB();
        return send(res, 200, { ok: true, removed: 1 });
      }
      return send(res, 405, { error: 'method' });
    }
  }

  /* بازنشانی دیتا — ادمین */
  if (pathn === '/api/reset' && req.method === 'POST') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    DB.products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
    DB.orders = [];
    DB.reviews = SEED_REVIEWS.slice();
    DB.discounts = SEED_DISCOUNTS.map(d => ({ ...d }));
    DB.settings = {};
    DB.adminPass = null;
    saveDB();
    return send(res, 200, { ok: true });
  }

  /* پشتیبان‌گیری از دیتابیس — ادمین */
  if (pathn === '/api/backup' && req.method === 'GET') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    return send(res, 200, DB, { 'Content-Disposition': 'attachment; filename="noir-backup.json"' });
  }

  /* بازیابی نسخه پشتیبان — ادمین */
  if (pathn === '/api/restore' && req.method === 'POST') {
    if (!ownerOK(req)) return send(res, 403, { error: 'این بخش فقط برای مالک فروشگاه است' });
    let b; try { b = JSON.parse(await readBody(req, 30)); } catch (e) { return send(res, 400, { error: 'فایل پشتیبان معتبر نیست' }); }
    if (!b || !Array.isArray(b.products) || !Array.isArray(b.orders)) return send(res, 400, { error: 'ساختار فایل پشتیبان درست نیست' });
    DB.products = b.products.slice(0, 500).map(cleanProduct);
    DB.orders = b.orders.slice(0, 5000).map(o => {
      o = o || {}; const ob = o.buyer || {};
      return {
        no: String(o.no || '').slice(0, 24),
        date: String(o.date || ''),
        items: Array.isArray(o.items) ? o.items.slice(0, 50) : [],
        sub: Math.max(0, Math.round(+o.sub || 0)),
        disc: Math.max(0, Math.round(+o.disc || 0)),
        fee: Math.max(0, Math.round(+o.fee || 0)),
        total: Math.max(0, Math.round(+o.total || 0)),
        ship: String(o.ship || '').slice(0, 60),
        pay: String(o.pay || '').slice(0, 60),
        couponCode: String(o.couponCode || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24),
        buyer: {
          name: String(ob.name || '').slice(0, 90),
          mobile: String(ob.mobile || '').slice(0, 20),
          city: String(ob.city || '').slice(0, 140),
          addr: String(ob.addr || '').slice(0, 400)
        },
        status: String(o.status || 'در حال پردازش').slice(0, 40),
        created: +o.created || Date.now()
      };
    });
    if (Array.isArray(b.reviews)) DB.reviews = b.reviews.slice(0, 2000).map(r => {
      r = r || {};
      return {
        id: String(r.id || ('r' + Math.random().toString(36).slice(2, 9))).slice(0, 32),
        productId: String(r.productId || '').slice(0, 40),
        name: String(r.name || '').slice(0, 60),
        rating: Math.min(5, Math.max(1, Math.round(+r.rating || 5))),
        text: String(r.text || '').slice(0, 800),
        date: String(r.date || ''),
        created: +r.created || Date.now()
      };
    });
    if (Array.isArray(b.discounts)) DB.discounts = b.discounts.slice(0, 200).map(d => {
      d = d || {};
      const code = String(d.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
      return code ? { code, percent: Math.min(90, Math.max(1, Math.round(Math.abs(+d.percent || 10)))), active: d.active !== false } : null;
    }).filter(Boolean);
    if (b.settings && typeof b.settings === 'object') DB.settings = b.settings;
    if (typeof b.adminPass === 'string' && b.adminPass.length >= 4) DB.adminPass = b.adminPass.slice(0, 60);
    if (!DB.products.length) DB.products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
    saveDB();
    return send(res, 200, { ok: true, products: DB.products.length, orders: DB.orders.length });
  }

  /* نظرات محصول — دریافت (عمومی) */
  if (pathn === '/api/reviews' && req.method === 'GET') {
    const pid = new URL(req.url, 'http://x').searchParams.get('product');
    const list = pid ? DB.reviews.filter(r => r.productId === pid) : DB.reviews;
    return send(res, 200, list.slice(0, 200));
  }

  /* ثبت نظر — عمومی */
  if (pathn === '/api/reviews' && req.method === 'POST') {
    let b; try { b = JSON.parse(await readBody(req, 2)); } catch (e) { return send(res, 400, { error: 'bad json' }); }
    b = b || {};
    const p = DB.products.find(x => x.id === String(b.productId || ''));
    if (!p) return send(res, 400, { error: 'محصول نامعتبر است' });
    const rev = {
      id: 'r' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
      productId: p.id,
      name: String(b.name || 'کاربر ناشناس').slice(0, 60),
      rating: Math.min(5, Math.max(1, Math.round(+b.rating || 5))),
      text: String(b.text || '').slice(0, 800),
      date: new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' }),
      created: Date.now()
    };
    if (!rev.text.trim()) return send(res, 400, { error: 'متن نظر نمی‌تواند خالی باشد' });
    DB.reviews.unshift(rev);
    if (DB.reviews.length > 2000) DB.reviews = DB.reviews.slice(0, 2000);
    saveDB();
    return send(res, 201, rev);
  }

  /* حذف نظر — ادمین */
  m = pathn.match(/^\/api\/reviews\/([^\/]+)$/);
  if (m && req.method === 'DELETE') {
    if (!(permOK(req, 'products'))) return send(res, 403, { error: 'شما به این بخش دسترسی ندارید' });
    const before = DB.reviews.length;
    DB.reviews = DB.reviews.filter(x => x.id !== decodeURIComponent(m[1]));
    saveDB();
    return send(res, 200, { ok: true, removed: before - DB.reviews.length });
  }

  /* سفارش/پرداخت — ساخت لینک درگاه برای سفارش */
  if (pathn === '/api/payment/pay' && req.method === 'POST') {
    if (!ZP_MERCHANT) return send(res, 503, { error: 'درگاه پرداخت هنوز پیکربندی نشده است — لطفاً از روش‌های دیگر استفاده کنید', demo: true });
    let b = {}; try { b = JSON.parse(await readBody(req)); } catch (e) { }
    const o = DB.orders.find(x => x.no === String(b.no || ''));
    if (!o) return send(res, 404, { error: 'سفارش پیدا نشد' });
    if (o.paid) return send(res, 400, { error: 'این سفارش قبلاً پرداخت شده است' });
    try {
      const resp = await zpFetch(ZP_BASE + '/request.json', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: ZP_MERCHANT,
          amount: Math.max(1000, o.total) * 10,   /* تومان → ریال */
          callback_url: BASE_URL + '/payment/callback',
          description: ('پرداخت سفارش ' + o.no + ' آتلیه نُوار').slice(0, 100),
          metadata: { mobile: o.buyer.mobile || '' }
        })
      });
      const code = resp && resp.data && resp.data.code;
      if (code === 100) {
        o.authority = resp.data.authority;
        o.status = 'در انتظار پرداخت';
        saveDB();
        return send(res, 200, { url: ZP_START + resp.data.authority });
      }
      console.error('ZarinPal error:', resp);
      return send(res, 502, { error: 'پاسخ درگاه پرداخت نامعتبر بود' });
    } catch (e) {
      console.error('zarinpal fetch failed:', e);
      return send(res, 502, { error: 'ارتباط با درگاه پرداخت برقرار نشد' });
    }
  }

  return send(res, 404, { error: 'api not found' });
}

/* ------------------------ فایل‌های استاتیک ------------------------ */
function serveStatic(req, res, pathn) {
  if (pathn === '/') pathn = '/index.html';
  let fp;
  try { fp = path.normalize(path.join(ROOT, decodeURIComponent(pathn))); }
  catch (e) { return send(res, 400, 'bad path'); }
  if (!fp.startsWith(ROOT)) return send(res, 403, 'forbidden');
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return send(res, 404, 'not found');
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'public, ' + (ext === '.html' ? 'no-cache' : 'max-age=86400')
  });
  fs.createReadStream(fp).pipe(res);
}

/* ======================== درگاه زرین‌پال — ابزار ======================== */
async function zpFetch(url, opts) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', accept: 'application/json' } });
  return r.json();
}

function payFailHtml() {
  return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>پرداخت ناموفق</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0b08;color:#f0e9da;font-family:Tahoma,Arial,sans-serif;padding:20px}.c{max-width:440px;width:100%;text-align:center;border:1px solid #2c2519;padding:48px 34px;border-radius:4px;background:#17130d}h1{font-size:20px;color:#d0604f;margin:0 0 14px}p{font-size:13.5px;line-height:2.2;color:#cfc4ad}a{display:inline-block;margin-top:24px;padding:13px 30px;background:#c9a15f;color:#171106;text-decoration:none;font-weight:bold;font-size:14px;border-radius:3px}</style></head><body><div class="c"><h1>پرداخت ناموفق بود</h1><p>پرداخت انجام نشد یا توسط شما لغو شد. سفارش شما در وضعیت «در انتظار پرداخت» باقی مانده است و مبلغی کسر نشده — می‌توانید مجدداً تلاش کنید.</p><a href="/#/checkout">بازگشت به صفحه پرداخت</a></div></body></html>';
}

/* بررسی بازگشت کاربر از درگاه */
async function paymentCallback(req, res, url) {
  const authority = url.searchParams.get('Authority');
  const status = url.searchParams.get('Status');
  const o = DB.orders.find(x => x.authority === authority);
  if (status === 'OK' && o) {
    try {
      const vr = await zpFetch(ZP_BASE + '/verify.json', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: ZP_MERCHANT,
          amount: Math.max(1000, o.total) * 10,
          authority: authority
        })
      });
      const c = vr && vr.data && vr.data.code;
      if (c === 100 || c === 101) {   /* 100 موفق · 101 قبلاً تأیید شده */
        o.paid = true;
        o.status = 'پرداخت شده';
        o.ref_id = vr.data.ref_id;
        saveDB();
        res.writeHead(302, { Location: '/#/success' });
        return res.end();
      }
      console.error('ZarinPal verify error:', vr);
    } catch (e) { console.error('verify failed:', e); }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(payFailHtml());
}

/* ------------------------ سرور ------------------------ */
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const pathn = url.pathname;
    if (pathn.startsWith('/api/')) return await handleApi(req, res, pathn);
    if (pathn === '/payment/callback') return await paymentCallback(req, res, url);
    serveStatic(req, res, pathn);
  } catch (e) {
    console.error('server error:', e);
    try { send(res, 500, { error: 'server error' }); } catch (e2) { }
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`✦ آتلیه نُوار روی http://0.0.0.0:${PORT} در حال اجراست (API فعال)`);
  console.log('✦ درگاه پرداخت: ' + (ZP_MERCHANT ? 'فعال (' + ZP_MODE + ')' : 'پیکربندی نشده — حالت دمو'));
});
