/* =====================================================================
   آتلیه نُوار — ATELIER NOIR · Storefront Engine (Vanilla JS)
   ===================================================================== */
'use strict';

/* ============================== DATA ============================== */
/* دیتای پیش‌فرضی محصولات به js/data.js منتقل شد تا هم مرورگر و هم سرور از یک منبع استفاده کنند */

const CATS = { women: 'زنانه', men: 'مردانه', acc: 'اکسسوری' };
const FREE_AT = SETTINGS.freeShippingAt;   // ← از js/config.js
const FREE_SIZES = ['S', 'M', 'L', 'XL'];

/* روش‌های ارسال و پرداخت از js/config.js خوانده می‌شوند */
const SHIP = SETTINGS.shipping.map(s => ({ ...s, fee: sub => (s.freeAbove && sub >= SETTINGS.freeShippingAt) ? 0 : s.fee }));
const PAY = SETTINGS.payment.map(s => ({ ...s }));

const INFO = {
  track: {
    t: 'پیگیری سفارش',
    b: '<p>پس از ثبت سفارش، <b>کد رهگیری</b> در صفحه‌ی موفقیت نمایش داده می‌شود و از طریق پیامک برای شما ارسال خواهد شد.</p><ul><li>مرسوله‌های پستی: در سایت <span dir="ltr">post.ir</span> با کد رهگیری پیگیری کنید.</li><li>پیک تهران: واحد پشتیبانی لحظه‌ای، وضعیت را اطلاع‌رسانی می‌کند.</li><li>اگر ۲۴ ساعت پس از ثبت، پیامک نگرفتید با ۰۲۱-۲۶۲۲۸۴۶۰ تماس بگیرید.</li></ul>'
  },
  shipping: {
    t: 'شیوه ارسال و هزینه',
    b: '<ul><li><b>پست پیشتاز (سراسری):</b> ۱۲۰٬۰۰۰ تومان — برای سفارش‌های بالای ۵ میلیون تومان رایگان است.</li><li><b>پیک ویژه تهران:</b> ۱۸۰٬۰۰۰ تومان — تحویل همان روز.</li><li><b>تیپاکس:</b> ۲۲۰٬۰۰۰ تومان — ۲ تا ۴ روز کاری.</li></ul><p>همه سفارش‌ها در جعبه‌ی هدیه‌ی نُوار، با کاور پارچه‌ای و کاغذ کرافت دست‌دوز ارسال می‌شوند.</p>'
  },
  returns: {
    t: 'شرایط بازگشت کالا',
    b: '<ul><li>تا <b>۷ روز تقویمی</b> پس از تحویل، بدون قید و شرط قابل بازگشت است.</li><li>کالا باید استفاده‌نشده، با اتیکت و جعبه‌ی اصلی باشد.</li><li>مبلغ حداکثر ۴۸ ساعت پس از دریافت مرجوعی، به حساب شما برمی‌گردد.</li><li>هزینه‌ی ارسال مرجوعی در صورت ایراد کالا با ما، در غیر این‌صورت با مشتری است.</li></ul>'
  },
  privacy: {
    t: 'حریم خصوصی',
    b: '<p>اطلاعات شما (نام، تماس، آدرس) فقط برای پردازش و تحویل سفارش استفاده می‌شود و به هیچ شخص ثالثی واگذار نمی‌گردد. این یک فروشگاه نمایشی است و هیچ پرداخت واقعی انجام نمی‌شود.</p><ul><li>رکوکی‌ها صرفاً برای حفظ سبد خرید به کار می‌روند.</li><li>در هر لحظه می‌توانید درخواست حذف اطلاعات خود را اعلام کنید.</li></ul>'
  }
};

/* ============================== HELPERS ============================== */
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const faNum = n => Math.round(Number(n) || 0).toLocaleString('fa-IR');
const money = n => faNum(n) + ' ' + SETTINGS.currency;
const offPct = p => p.old ? Math.round((p.old - p.price) / p.old * 100) : 0;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PROD = id => PRODUCTS.find(p => p.id === id);
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

const I = {
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8V7a6 6 0 1 1 12 0v1"/><path d="M4 8h16l-1.2 12.1a1 1 0 0 1-1 .9H6.2a1 1 0 0 1-1-.9L4 8z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M12 20.4c-6.2-3.8-8.4-7-8.4-10.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.4 3.2c0 3.2-2.2 6.4-8.4 10.2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m4.5 12.5 5 5L19.5 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13.2a1 1 0 0 1-1 .8H8a1 1 0 0 1-1-.8L6 7"/><path d="M10 11v6M14 11v6"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>',
  truck: '<svg viewBox="0 0 24 24" stroke-width="1.4"><path d="M1 7h12v9H1zM13 10h4.5L21 13.5V16h-8"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" stroke-width="1.4"><path d="M12 2.5 20 6v6c0 5-3.6 8.4-8 9.5C7.6 20.4 4 17 4 12V6z"/><path d="m8.5 12 2.4 2.4 4.6-4.6"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" stroke-width="1.4"><path d="M3 12a9 9 0 1 0 2.6-6.3L3 8"/><path d="M3 3v5h5"/></svg>',
  gift: '<svg viewBox="0 0 24 24" stroke-width="1.4"><rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8s-1.5-4.5-4.5-4.5a2.2 2.2 0 0 0 0 4.5M12 8s1.5-4.5 4.5-4.5a2.2 2.2 0 0 1 0 4.5"/></svg>'
};

/* ---------- لایه دیتای فروشگاه (پویا، قابل مدیریت از پنل) ---------- */
let PRODUCTS = load('noir_products_v1', null) || DEFAULT_PRODUCTS.map(p => ({ ...p }));
function saveProducts(list) {
  PRODUCTS = (list || []).map(p => ({ ...p }));
  return save('noir_products_v1', PRODUCTS);
}
function getOrders() { return load('noir_orders', []); }

/* ---------- حالت سرور واقعی (اگر سرور Node در دسترس باشد) ---------- */
let API_MODE = false;
async function initStore() {
  try {
    const h = await fetch('/api/health');
    if (!h.ok) return;
    API_MODE = true;
    const r = await fetch('/api/products');
    if (r.ok) PRODUCTS = await r.json();
    console.log('✦ حالت سرور واقعی فعال شد — دیتا مشترک برای همه بازدیدکننده‌ها');
  } catch (e) { /* حالت استاتیک: دیتا از مرورگر خوانده می‌شود */ }
}
async function apiFetch(url, opts = {}) {
  opts.headers = { 'Content-Type': 'application/json', 'x-admin-token': sessionStorage.getItem('noir_token') || '', ...(opts.headers || {}) };
  const res = await fetch(url, opts);
  if (res.status === 401) throw new Error('unauthorized');
  return res.json();
}

/* ============================== نظرات مشتریان ============================== */
let REVIEWS = load('noir_reviews', null);
let RV_RATE = 5;
if (!REVIEWS) {
  const t = Date.now();
  REVIEWS = [
    { id: 'r1', productId: 'coat', name: 'نگار', rating: 5, text: 'کیفیت پارچه فوق‌العاده‌ست؛ دقیقاً همون چیزیه که توی عکس‌ها می‌بینید. بسته‌بندی هم واقعاً شیک بود.', date: 'شهریور ۱۴۰۵', created: t - 86400000 * 3 },
    { id: 'r2', productId: 'coat', name: 'سارا م.', rating: 5, text: 'برای عقدم خریدم؛ همه‌جا می‌پرسن از کجاست!', date: 'شهریور ۱۴۰۵', created: t - 86400000 * 6 },
    { id: 'r3', productId: 'bag', name: 'مونا', rating: 4, text: 'چرم واقعی بودنش محرزه. کاش رنگ‌بندی بیشتری هم داشت.', date: 'مرداد ۱۴۰۵', created: t - 86400000 * 20 }
  ];
  save('noir_reviews', REVIEWS);
}
const revsFor = pid => REVIEWS.filter(r => r.productId === pid);
function stars(avg, size = 13) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="st${i <= Math.round(avg) ? ' f' : ''}">★</span>`;
  return `<span class="stars" style="--sz:${size}px">${s}</span>`;
}
function syncStars() {
  const w = qs('#rvRate');
  if (w) qsa('button', w).forEach(b => b.classList.toggle('on', +b.dataset.n <= RV_RATE));
}
function reviewHTML(r) {
  const canDel = API_MODE && sessionStorage.getItem('noir_token');
  return `<div class="rev-item">
    <div class="rev-top"><b>${esc(r.name)}</b> ${stars(r.rating, 12)} <span class="dim" style="margin-inline-start:auto;font-size:11px">${esc(r.date)}</span>
    ${canDel ? `<button class="rv-x" data-revdel="${r.id}" title="حذف نظر (مدیر)">✕</button>` : ''}</div>
    <p>${esc(r.text)}</p>
  </div>`;
}
async function fillReviews(pid) {
  let list;
  if (API_MODE) {
    try { list = await apiFetch('/api/reviews?product=' + encodeURIComponent(pid)); }
    catch (e) { list = revsFor(pid); }
  } else list = revsFor(pid);
  const n = list.length;
  const avg = n ? list.reduce((a, r) => a + r.rating, 0) / n : 0;
  const sumEl = qs('#pdRevSum');
  if (sumEl) sumEl.innerHTML = n
    ? `${stars(avg)} <b>${faNum(Math.round(avg * 10) / 10)}</b> · ${faNum(n)} نظر`
    : '<span class="dim">هنوز نظری ثبت نشده — اولین نظر را شما بنویسید</span>';
  const lEl = qs('#revList');
  if (lEl) lEl.innerHTML = n
    ? list.map(reviewHTML).join('')
    : `<div class="empty" style="padding:38px 20px">هنوز نظری برای این محصول ثبت نشده.<br><span style="font-size:12px">اولین نفری باشید که تجربه‌اش را می‌گوید ✦</span></div>`;
}
async function submitReview(f) {
  const pid = f.dataset.pid;
  const body = { productId: pid, name: f.rname.value.trim(), text: f.rtext.value.trim(), rating: RV_RATE || 5 };
  if (!body.text) { toast('متن نظر را بنویسید', true); return; }
  if (API_MODE) {
    try { await apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify(body) }); }
    catch (e) { toast('ثبت نظر روی سرور ممکن نشد', true); return; }
  } else {
    REVIEWS.unshift({
      id: 'r' + Date.now().toString(36), productId: pid,
      name: body.name || 'کاربر ناشناس', text: body.text, rating: body.rating,
      date: new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' }),
      created: Date.now()
    });
    save('noir_reviews', REVIEWS);
  }
  f.reset(); RV_RATE = 5; syncStars();
  fillReviews(pid);
  toast('✔ نظر شما ثبت شد — سپاس از شما');
}

/* ============================== چاپ فاکتور ============================== */
function invoiceHTML(o) {
  const rows = o.items.map((it, i) => `<tr>
    <td>${faNum(i + 1)}</td>
    <td>${esc(it.name)}${it.en ? `<small>${esc(it.en)}</small>` : ''}</td>
    <td>${esc(it.size)}</td>
    <td>${faNum(it.qty)}</td>
    <td>${faNum(it.price)}</td>
    <td>${faNum(it.price * it.qty)}</td>
  </tr>`).join('');
  return `<div class="inv">
    <div class="inv-head">
      <div class="inv-brand"><b>${SETTINGS.brandFa}</b><span>${SETTINGS.brandEn}</span></div>
      <div class="inv-no">
        <h2>فاکتور فروش</h2>
        <div>شماره: <b dir="ltr">${o.no}</b></div>
        <div>تاریخ: ${o.date}</div>
        ${o.paid ? '<div class="inv-paid">✔ پرداخت شده</div>' : ''}
      </div>
    </div>
    <div class="inv-parties">
      <div><b>فروشنده:</b> ${SETTINGS.brandFa} · ${SETTINGS.phone}<br><span>${SETTINGS.address}</span></div>
      <div><b>خریدار:</b> ${o.buyer.name} · <span dir="ltr">${o.buyer.mobile}</span><br><span>${o.buyer.city} — ${o.buyer.addr}</span></div>
    </div>
    <table class="inv-tbl">
      <thead><tr><th>#</th><th>شرح کالا</th><th>سایز</th><th>تعداد</th><th>قیمت واحد<br>(${SETTINGS.currency})</th><th>مبلغ کل<br>(${SETTINGS.currency})</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="inv-tot">
      <div><span>جمع اقلام:</span><b>${faNum(o.sub)} ${SETTINGS.currency}</b></div>
      ${o.disc ? `<div><span>تخفیف:</span><b>(${faNum(o.disc)})</b></div>` : ''}
      <div><span>هزینه ارسال:</span><b>${o.fee ? faNum(o.fee) + ' ' + SETTINGS.currency : 'رایگان'}</b></div>
      <div><span>روش ارسال:</span><b>${esc(o.ship)}</b></div>
      <div><span>روش پرداخت:</span><b>${esc(o.pay)}</b></div>
      <div class="grand"><span>مبلغ قابل پرداخت:</span><b>${faNum(o.total)} ${SETTINGS.currency}</b></div>
    </div>
    <div class="inv-foot">
      <div class="sign">امضای خریدار</div>
      <div class="sign">مهر و امضای فروشگاه</div>
    </div>
    <p class="inv-thanks">از خرید شما سپاسگزاریم · ${SETTINGS.brandFa} · ${SETTINGS.email}</p>
  </div>`;
}
function printInvoice(order) {
  const o = order || load('noir_order', null);
  if (!o) { toast('سفارشی برای چاپ موجود نیست', true); return; }
  qs('#printArea').innerHTML = invoiceHTML(o);
  window.print();
}

/* ============================== STATE ============================== */
let cart = load('noir_cart', []);          // [{id,size,qty}]
let wish = load('noir_wish', []);          // [id]
let coupon = load('noir_coupon', null);    // {code, percent} | null  (کد تخفیف فعال)
if (coupon === true) coupon = { code: SETTINGS.coupon.code, percent: SETTINGS.coupon.percent }; // مهاجرت از نسخه قدیمی
let discList = load('noir_discounts', [SETTINGS.coupon]); // کش محلی کدها (حالت استاتیک)
let shopF = { cats: new Set(), sizes: new Set(), max: 16000000, sort: 'new', q: '' };
let pdSel = { size: null, qty: 1 };
let shipSel = 'post', paySel = 'online';

/* ============================== CART CORE ============================== */
const kOf = it => it.id + '|' + it.size;
const cartCount = () => cart.reduce((a, i) => a + i.qty, 0);
const cartSub = () => cart.reduce((a, i) => { const p = PROD(i.id); return p ? a + p.price * i.qty : a; }, 0);
const discOf = sub => (coupon ? Math.round((sub ?? cartSub()) * coupon.percent / 100) : 0);

/* اعتبارسنجی کد تخفیف — اول از سرور؛ اگر API در دسترس نبود، از کش محلی */
async function applyCoupon(code) {
  if (API_MODE) {
    try {
      const r = await fetch('/api/discounts/validate?code=' + encodeURIComponent(code));
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        coupon = { code: j.code, percent: j.percent };
        save('noir_coupon', coupon);
        renderCoSummary();
        toast(`کد ${j.code} اعمال شد — ${faNum(j.percent)}٪ تخفیف`);
        return;
      }
      toast(j && j.error ? j.error : 'کد تخفیف معتبر نیست', true);
      return;
    } catch (e) { /* ادامه با کش محلی */ }
  }
  const d = discList.find(x => x && String(x.code).toUpperCase() === code && x.active !== false);
  if (d) {
    coupon = { code: d.code, percent: d.percent };
    save('noir_coupon', coupon);
    renderCoSummary();
    toast(`کد ${d.code} اعمال شد — ${faNum(d.percent)}٪ تخفیف`);
  } else toast('کد تخفیف معتبر نیست', true);
}

function saveCart() { save('noir_cart', cart); renderBadge(); if (qs('#cartDrawer').classList.contains('open')) renderCart(); }

function renderBadge(pop = false) {
  const b = qs('#cartCount'), n = cartCount();
  b.textContent = faNum(n);
  b.classList.toggle('zero', n === 0);
  if (pop) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
}

function addToCart(id, size, qty = 1) {
  const p = PROD(id); if (!p) return;
  const found = cart.find(i => i.id === id && i.size === size);
  if (found) found.qty = Math.min(9, found.qty + qty);
  else cart.push({ id, size, qty });
  saveCart(); renderBadge(true);
}

function quickAdd(id) {
  const p = PROD(id);
  const size = p.sizes.length === 1 ? p.sizes[0] : 'M';
  addToCart(id, size, 1);
  toast(`«${p.name}» به سبد افزوده شد${p.sizes.length > 1 ? ' (سایز M)' : ''}`);
  openDrawer();
}

function toggleWish(id) {
  const i = wish.indexOf(id);
  if (i > -1) { wish.splice(i, 1); toast('از علاقه‌مندی‌ها حذف شد'); }
  else { wish.push(id); toast('به علاقه‌مندی‌ها افزوده شد'); }
  save('noir_wish', wish);
  syncWishUI(id);
}
function syncWishUI(id) {
  const on = wish.includes(id);
  qsa(`[data-wish="${id}"]`).forEach(b => b.classList.toggle('on', on));
}

/* ============================== UI: OVERLAYS ============================== */
const lockBody = on => document.body.classList.toggle('lock', on);
const showBackdrop = on => qs('#backdrop').classList.toggle('show', on);

function openDrawer() {
  renderCart();
  qs('#cartDrawer').classList.add('open');
  showBackdrop(true); lockBody(true);
}
function closeDrawer() { qs('#cartDrawer').classList.remove('open'); afterPanel(); }
function openPanel(sel) { qs(sel).classList.add('open'); showBackdrop(true); lockBody(true); }
function closeAllPanels() {
  qsa('.drawer.open, .m-nav.open, .filters.open, .search-ov.open, .modal.open').forEach(el => el.classList.remove('open'));
  afterPanel();
}
function afterPanel() {
  const anyOpen = qs('.drawer.open,.m-nav.open,.filters.open,.search-ov.open,.modal.open');
  if (!anyOpen) { showBackdrop(false); lockBody(false); }
}

/* ============================== UI: TOAST ============================== */
function toast(msg, err = false) {
  const w = qs('#toastWrap');
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = (err ? '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18"/></svg>' : I.check) + '<span>' + esc(msg) + '</span>';
  w.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 450); }, 2600);
}

/* ============================== CART DRAWER ============================== */
function renderCart() {
  const d = qs('#cartDrawer');
  const n = cartCount(), sub = cartSub();
  const remain = Math.max(0, FREE_AT - sub);
  const pct = Math.min(100, sub / FREE_AT * 100);
  const disc = discOf(sub);

  let items = '';
  if (n === 0) {
    items = `<div class="dr-empty">${I.bag}<p>سبد خرید شما خالی است</p>
      <a href="#/shop" class="btn btn-ghost btn-sm" onclick="closeAllPanels()">مشاهده فروشگاه</a></div>`;
  } else {
    items = '<div class="dr-items">' + cart.filter(it => PROD(it.id)).map(it => {
      const p = PROD(it.id), k = kOf(it);
      return `<div class="citem">
        <a href="#/product/${p.id}" onclick="closeAllPanels()"><img src="${p.img}" alt="${esc(p.name)}"></a>
        <div class="ci-info">
          <h4>${esc(p.name)}</h4>
          <div class="cis">سایز: ${esc(it.size)} · ${CATS[p.cat]}</div>
          <div class="ci-bottom">
            <span class="ci-price">${money(p.price * it.qty)}</span>
            <span style="display:inline-flex;align-items:center;gap:8px">
              <span class="qty mini">
                <button data-cqty="1" data-k="${k}" aria-label="افزایش">+</button>
                <span>${faNum(it.qty)}</span>
                <button data-cqty="-1" data-k="${k}" aria-label="کاهش">−</button>
              </span>
              <button class="ci-del" data-cdel="${k}" aria-label="حذف">${I.trash}</button>
            </span>
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  d.innerHTML = `
    <div class="dr-head">
      <h3>سبد خرید <span>(${faNum(n)} قلم)</span></h3>
      <button class="ic-btn" onclick="closeAllPanels()" aria-label="بستن">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    ${n ? `<div class="ship-hint">
      <p>${remain > 0 ? `تا <b>ارسال رایگان</b> فقط <b>${money(remain)}</b> مانده` : '✦ تبریک! ارسال سفارش شما <b>رایگان</b> شد'}</p>
      <div class="ship-bar"><i style="width:${pct}%"></i></div>
    </div>` : ''}
    ${items}
    ${n ? `<div class="dr-foot">
      <div class="dr-row"><span>جمع اقلام</span><span>${money(sub)}</span></div>
      ${disc ? `<div class="dr-row" style="color:var(--green)"><span>تخفیف ${esc(coupon.code)}</span><span>(${money(disc)})</span></div>` : ''}
      <div class="dr-row"><span>هزینه ارسال</span><span>${sub >= FREE_AT ? 'رایگان' : 'در مرحله بعد'}</span></div>
      <div class="dr-row total"><span>مبلغ نهایی</span><b>${money(sub - disc)}</b></div>
      <a href="#/checkout" class="btn btn-solid btn-full" onclick="closeAllPanels()">${I.bag} تکمیل خرید و پرداخت</a>
      <a class="cont" href="#/shop" onclick="closeAllPanels()">← ادامه خرید</a>
    </div>` : ''}`;
}

/* ============================== CARD TEMPLATE ============================== */
function productCard(p, i = 0) {
  const off = offPct(p);
  return `<article class="pcard rv" style="--d:${(i % 4) * 0.08}s">
    <div class="pimg">
      <a class="pimgl" href="#/product/${p.id}"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy"></a>
      ${off ? `<span class="ptag off">٪${faNum(off)} تخفیف</span>` : (p.tag ? `<span class="ptag">${p.tag}</span>` : '')}
      <button class="wish ${wish.includes(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-label="علاقه‌مندی">${I.heart}</button>
      <button class="qa" data-qa="${p.id}">${I.bag} افزودن سریع به سبد</button>
    </div>
    <div class="pinfo">
      <a class="pname" href="#/product/${p.id}">${esc(p.name)}</a>
      <span class="pen">${p.en}</span>
      <div class="pprice">${p.old ? `<s>${money(p.old)}</s>` : ''}<span>${money(p.price)}</span></div>
    </div>
  </article>`;
}

/* ============================== VIEWS ============================== */
function viewHome() {
  const featured = ['coat', 'leather', 'silk', 'bag'].map(PROD);
  const news = ['cardigan', 'skirt', 'sweater', 'scarf'].map(PROD);
  const catCards = [
    { k: 'women', t: 'زنانه', e: 'WOMEN', img: 'coat-camel.jpg' },
    { k: 'men', t: 'مردانه', e: 'MEN', img: 'leather-jacket.jpg' },
    { k: 'acc', t: 'اکسسوری', e: 'ACCESSORIES', img: 'bag.jpg' }
  ];
  const mqItems = ['ارسال رایگان سراسری بالای ۵ میلیون تومان', 'ضمانت اصالت و کیفیت کالا', '۷ روز ضمانت بازگشت بدون قید و شرط', 'بسته‌بندی هدیه‌ی مخصوص نُوار', 'کلکسیون پاییز و زمستان ۱۴۰۵'];
  const mqRow = mqItems.map(t => `<span class="mq-item"><b>◆</b>${t}</span>`).join('');

  return `
  <!-- HERO -->
  <section class="hero">
    <div class="hero-bg"><img src="hero.jpg" alt="کلکسیون زمستان نُوار"></div>
    <div class="hero-in">
      <span class="kick"><i></i>کلکسیون پاییز و زمستان ۱۴۰۵<i></i></span>
      <h1>شکوه، در سکوتِ<br><em>جزئیات</em> پنهان است</h1>
      <p class="hero-sub">کشمیر مغولستان، چرم دباغی ایتالیا و ابریشمِ لیون؛ در قالب کلکسیونی محدود که هر قطعه‌اش برای سال‌ها خاطره می‌سازد، نه یک فصلِ گذرا.</p>
      <div class="hero-cta">
        <a href="#/shop" class="btn btn-solid">مشاهده کلکسیون ${I.arrow}</a>
        <a href="#/product/coat" class="btn btn-ghost">پالتو شاخص فصل</a>
      </div>
      <div class="hero-en">FALL – WINTER COLLECTION 1405</div>
    </div>
    <div class="scroll-hint">اسکرول<i></i></div>
  </section>

  <!-- MARQUEE -->
  <div class="mq"><div class="mq-track">${mqRow}${mqRow}</div></div>

  <!-- CATEGORIES -->
  <section class="sec">
    <div class="container">
      <div class="sec-head rv">
        <div>
          <span class="sec-no">۰۱ — بخش‌ها</span>
          <h2>دنیای خودتان را<br>پیدا کنید</h2>
          <div class="gold-line"></div>
        </div>
        <a href="#/shop" class="link-more">مشاهده همه محصولات ${I.arrow}</a>
      </div>
      <div class="cats">
        ${catCards.map((c, i) => {
    const cnt = PRODUCTS.filter(p => p.cat === c.k && !p.hidden).length;
    return `<a href="#/shop?cat=${c.k}" class="cat-card rv" style="--d:${i * 0.1}s">
            <img src="${c.img}" alt="${c.t}" loading="lazy">
            <div class="cat-meta">
              <div><h3>${c.t}</h3><small>${faNum(cnt)} قطعه منتخب · <span class="en" style="letter-spacing:.2em">${c.e}</span></small></div>
              <span class="cat-go">${I.arrow}</span>
            </div>
          </a>`;
  }).join('')}
      </div>
    </div>
  </section>

  <!-- FEATURED -->
  <section class="sec tight" style="background:var(--bg2);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
    <div class="container">
      <div class="sec-head rv">
        <div>
          <span class="en en-lbl">CURATED SELECTION</span>
          <h2>منتخبِ سردبیر</h2>
          <div class="gold-line"></div>
        </div>
        <a href="#/shop" class="link-more">رفتن به فروشگاه ${I.arrow}</a>
      </div>
      <div class="pgrid">${featured.map((p, i) => productCard(p, i)).join('')}</div>
    </div>
  </section>

  <!-- EDITORIAL -->
  <section class="sec">
    <div class="container">
      <div class="edit rv">
        <div class="edit-img"><img src="lookbook.jpg" alt="لوک‌بوک نُوار" loading="lazy"></div>
        <div class="edit-txt">
          <span class="kick" style="margin-bottom:0"><i></i>داستان نُوار</span>
          <h2>لباسِ خوب، فریاد<br>نمی‌زند؛ <em>زمزمه</em> می‌کند</h2>
          <p>نُوار در سال ۱۳۹۷ در تهران متولد شد؛ با یک باورِ ساده: کمدِ کم اما قدرتمند. ما به‌جای دنبال‌کردن ترندهای لحظه‌ای، قطعاتی می‌دوزیم که ده سال بعد هم همان‌قدر بی‌نقص‌اند — با پارچه‌هایی که حساب واقعی‌شان را جلوی آینه می‌فهمید.</p>
          <div class="edit-sign">Casa Noir</div>
          <a href="#/shop" class="btn btn-ghost" style="align-self:flex-start">آشنایی با مواد اولیه ما</a>
          <div class="edit-row">
            <div><b>+۴۰</b><span>مولفه بافت وارداتی</span></div>
            <div><b>۵۲</b><span>مرحله کنترل کیفیت</span></div>
            <div><b>+۱۲هزار</b><span>مشتری ثابت</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- NEW ARRIVALS -->
  <section class="sec tight">
    <div class="container">
      <div class="sec-head rv">
        <div>
          <span class="en en-lbl">JUST LANDED</span>
          <h2>تازه‌‌های آتلیه</h2>
          <div class="gold-line"></div>
        </div>
        <a href="#/shop" class="link-more">مشاهده همه ${I.arrow}</a>
      </div>
      <div class="pgrid">${news.map((p, i) => productCard(p, i)).join('')}</div>
    </div>
  </section>

  <!-- VALUES -->
  <section class="sec tight" style="padding-top:0">
    <div class="container">
      <div class="vals rv">
        <div class="val">${I.truck}<h4>ارسال سریع و بیمه‌دار</h4><p>تحویل ۱ تا ۵ روز کاری در سراسر کشور؛ بسته‌های نُوار لایه‌لایه محافظت می‌شوند.</p></div>
        <div class="val">${I.shield}<h4>ضمانت اصالت کالا</h4><p>هر قطعه هولوگرام اصالت و شناسنامه‌ی پارچه دارد؛ نُوار فقط از تامین‌کنندگان دارای گواهی تهیه می‌کند.</p></div>
        <div class="val">${I.rotate}<h4>۷ روز بازگشت آسان</h4><p>بدون سؤال و فرم طولانی؛ کافیست با پشتیبانی هماهنگ کنید، پیک از درب منزل تحویل می‌گیرد.</p></div>
        <div class="val">${I.gift}<h4>بسته‌بندی هدیه</h4><p>جعبه‌ی سیگنچر نُوار، کاور پارچه‌ی نخی و کارت دست‌نویس؛ برای خودتان یا هدیه.</p></div>
      </div>
    </div>
  </section>

  <!-- NEWSLETTER -->
  <section class="sec tight" style="padding-bottom:110px">
    <div class="container">
      <div class="nl rv">
        <span class="kick" style="justify-content:center"><i></i>خبرنامه نُوار<i></i></span>
        <h3>اولین نفرِ کلکسیون‌های محدود باشید</h3>
        <p>هر فصل فقط دو کلکسیون می‌دوزیم. اعضای خبرنامه ۴۸ ساعت زودتر دسترسی می‌گیرند.</p>
        <form class="nl-form" id="nlForm">
          <input type="email" placeholder="نشانی ایمیل شما" dir="ltr" style="text-align:left" required>
          <button class="btn btn-solid" type="submit">عضویت</button>
        </form>
      </div>
    </div>
  </section>`;
}

/* ---------------- SHOP ---------------- */
function viewShop(params) {
  if (params && params.get('cat')) {
    shopF.cats = new Set([params.get('cat')]);
    shopF.sizes = new Set(); shopF.q = '';
  }
  return `
  <div class="shop-hero">
    <div class="container">
      <div class="crumb"><a href="#/">خانه</a> / <b>فروشگاه</b></div>
      <h1>فروشگاه نُوار</h1>
      <p class="dim" style="font-size:13.5px;margin-top:8px">هر قطعه، حاصل ده‌ها ساعت دوخت دستی است — با آرامی انتخاب کنید.</p>
    </div>
  </div>
  <div class="container">
    <div class="shop-wrap">
      <aside class="filters" id="filters">
        <div class="f-close">فیلترها
          <button class="ic-btn" id="fClose" aria-label="بستن">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
        <div class="f-group">
          <h4><i></i>دسته‌بندی</h4>
          ${Object.keys(CATS).map(k => `<label class="f-check"><input type="checkbox" name="fcat" value="${k}" ${shopF.cats.has(k) ? 'checked' : ''}> ${CATS[k]} <small>${faNum(PRODUCTS.filter(p => p.cat === k).length)}</small></label>`).join('')}
        </div>
        <div class="f-group">
          <h4><i></i>سایز</h4>
          <div class="chips" id="fSizes">${FREE_SIZES.map(s => `<button class="chip ${shopF.sizes.has(s) ? 'on' : ''}" data-fsize="${s}">${s}</button>`).join('')}</div>
        </div>
        <div class="f-group">
          <h4><i></i>حداکثر قیمت</h4>
          <input type="range" id="fRange" min="2000000" max="16000000" step="500000" value="${shopF.max}">
          <div class="range-val"><span>تا <b id="fRangeVal" style="color:var(--gold2)">${money(shopF.max)}</b></span></div>
        </div>
        <button class="f-clear" id="fClear">✕ حذف همه فیلترها</button>
      </aside>

      <div>
        <div class="shop-bar">
          <button class="btn btn-dark btn-sm f-toggle" id="fToggle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:15px;height:15px"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
            فیلترها
          </button>
          <span class="cnt"><b id="shopCount"></b> قطعه</span>
          <input id="shopQ" type="text" placeholder="جستجو در فروشگاه…" value="${esc(shopF.q)}">
          <span class="sel-wrap">مرتب‌سازی:
            <select id="sortSel">
              <option value="new" ${shopF.sort === 'new' ? 'selected' : ''}>جدیدترین</option>
              <option value="hot" ${shopF.sort === 'hot' ? 'selected' : ''}>پرفروش‌ترین</option>
              <option value="cheap" ${shopF.sort === 'cheap' ? 'selected' : ''}>ارزان‌ترین</option>
              <option value="exp" ${shopF.sort === 'exp' ? 'selected' : ''}>گران‌ترین</option>
              <option value="off" ${shopF.sort === 'off' ? 'selected' : ''}>بیشترین تخفیف</option>
            </select>
          </span>
        </div>
        <div class="pgrid" id="pgrid"></div>
      </div>
    </div>
  </div>`;
}

function applyShop() {
  let list = PRODUCTS.filter(p => {
    if (p.hidden) return false;
    if (shopF.cats.size && !shopF.cats.has(p.cat)) return false;
    if (shopF.sizes.size && !p.sizes.some(s => shopF.sizes.has(s))) return false;
    if (p.price > shopF.max) return false;
    if (shopF.q) {
      const q = shopF.q.trim();
      if (!(p.name.includes(q) || p.en.toLowerCase().includes(q.toLowerCase()) || CATS[p.cat].includes(q))) return false;
    }
    return true;
  });
  const sorts = {
    new: (a, b) => PRODUCTS.indexOf(a) - PRODUCTS.indexOf(b),
    hot: (a, b) => (b.tag === 'پرفروش') - (a.tag === 'پرفروش'),
    cheap: (a, b) => a.price - b.price,
    exp: (a, b) => b.price - a.price,
    off: (a, b) => offPct(b) - offPct(a)
  };
  list.sort(sorts[shopF.sort] || sorts.new);
  const grid = qs('#pgrid'); if (!grid) return;
  grid.innerHTML = list.length
    ? list.map((p, i) => productCard(p, i)).join('')
    : `<div class="empty" style="grid-column:1/-1"><h4>چیزی پیدا نشد</h4><p>فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.</p><button class="btn btn-ghost btn-sm" id="fClear2" style="margin-top:16px">حذف فیلترها</button></div>`;
  const c = qs('#shopCount'); if (c) c.textContent = faNum(list.length);
  initReveal();
  wish.forEach(syncWishUI);
}

/* ---------------- PRODUCT ---------------- */
function viewProduct(id) {
  const p = PROD(id);
  if (!p) return view404();
  pdSel = { size: p.sizes.length === 1 ? p.sizes[0] : null, qty: 1 };
  RV_RATE = 5;
  const off = offPct(p);
  const rel = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id)
    .concat(PRODUCTS.filter(x => x.cat !== p.cat && x.id !== p.id)).slice(0, 4);
  return `
  <div class="container pd">
    <div class="pd-media rv">
      <div class="pd-frame"><img src="${p.img}" alt="${esc(p.name)}"></div>
    </div>
    <div class="rv" style="--d:.1s">
      <div class="crumb"><a href="#/">خانه</a> / <a href="#/shop">فروشگاه</a> / <a href="#/shop?cat=${p.cat}">${CATS[p.cat]}</a> / <b>${esc(p.name)}</b></div>
      ${off ? `<span class="ptag off" style="position:static;display:inline-block;margin-bottom:10px">٪${faNum(off)} تخفیف محدود</span>` : (p.tag ? `<span class="ptag" style="position:static;display:inline-block;margin-bottom:10px">${p.tag}</span>` : '')}
      <h1>${esc(p.name)}</h1>
      <div class="en-sub">${p.en}</div>
      <div class="rev-sum" id="pdRevSum">…</div>
      <div class="pd-price">
        <b>${money(p.price)}</b>
        ${p.old ? `<s>${money(p.old)}</s><span class="save">${money(p.old - p.price)} سود شما</span>` : ''}
      </div>
      <p class="pd-desc">${esc(p.desc)}</p>

      <div class="opt">
        <div class="opt-label"><span>رنگ: <b id="pdColorName" style="color:var(--gold2)">${p.colors[0].n}</b></span></div>
        <div class="dots" id="pdColors">
          ${p.colors.map((c, i) => `<button class="dot ${i === 0 ? 'on' : ''}" data-color="${c.n}" aria-label="${c.n}"><i style="background:${c.c}"></i></button>`).join('')}
        </div>
      </div>

      <div class="opt">
        <div class="opt-label">
          <span>انتخاب سایز ${p.sizes.length === 1 ? '<b style="color:var(--gold2)">(تک‌سایز)</b>' : ''}</span>
          ${p.sizes.length > 1 ? `<button onclick="openPanelQ('#sizeModal')">راهنمای سایز</button>` : ''}
        </div>
        <div class="chips" id="pdSizes">
          ${p.sizes.map(s => `<button class="chip ${pdSel.size === s ? 'on' : ''}" data-size="${s}">${s}</button>`).join('')}
        </div>
      </div>

      <div class="pd-buy">
        <div class="qty">
          <button data-qty="1" aria-label="افزایش">+</button>
          <span id="pdQty">۱</span>
          <button data-qty="-1" aria-label="کاهش">−</button>
        </div>
        <button class="btn btn-solid" id="addBtn" style="flex:1;min-width:190px">${I.bag} افزودن به سبد خرید</button>
        <button class="wish-sq ${wish.includes(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-label="علاقه‌مندی">${I.heart}</button>
      </div>
      <button class="btn btn-ghost btn-full" id="buyBtn" data-id="${p.id}">خرید فوری — پرداخت سریع</button>

      <div class="pd-meta">
        <div class="meta-row"><b>کد کالا</b><span dir="ltr">NOIR-${String(PRODUCTS.indexOf(p) + 101)}</span></div>
        <div class="meta-row"><b>دسته‌بندی</b><a href="#/shop?cat=${p.cat}" style="color:var(--gold)">${CATS[p.cat]}</a></div>
        <div class="meta-row"><b>موجودی</b><span style="color:var(--green)">● موجود در انبار — ارسال از تهران</span></div>
      </div>

      <div class="accs">
        <div class="acc open">
          <button class="acc-btn">جنس و جزئیات ساخت ${I.chev}</button>
          <div class="acc-body"><div class="acc-body-in">${esc(p.fabric)}</div></div>
        </div>
        <div class="acc">
          <button class="acc-btn">نگهداری و شستشو ${I.chev}</button>
          <div class="acc-body"><div class="acc-body-in">${esc(p.care)}</div></div>
        </div>
        <div class="acc">
          <button class="acc-btn">ارسال و بازگشت ${I.chev}</button>
          <div class="acc-body"><div class="acc-body-in"><ul>
            <li>ارسال رایگان برای سفارش‌های بالای ${money(FREE_AT)}</li>
            <li>تحویل در تهران با پیک در همان روز</li>
            <li>۷ روز مهلت بازگشت بدون قید و شرط</li>
            <li>بسته‌بندی هدیه‌ی رایگان به همراه کارت دست‌نویس</li>
          </ul></div></div>
        </div>
      </div>
    </div>
  </div>

  <section class="sec tight container rev-sec">
    <div class="sec-head rv">
      <div>
        <span class="en en-lbl">CUSTOMER REVIEWS</span>
        <h2>نظرات مشتریان</h2>
        <div class="gold-line"></div>
      </div>
    </div>
    <div class="rev-grid rv">
      <div class="rev-list" id="revList"></div>
      <form class="rev-form" id="revForm" data-pid="${p.id}">
        <h3>ثبت نظر شما</h3>
        <p class="dim" style="font-size:12.5px">تجربه‌ی خودتان را با دیگران به اشتراک بگذارید</p>
        <div id="rvRate">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-n="${i}" class="on">★</button>`).join('')}</div>
        <div class="field"><label>نام شما</label><input name="rname" maxlength="40" placeholder="مثلاً: نگار"></div>
        <div class="field"><label>متن نظر *</label><textarea name="rtext" maxlength="800" placeholder="کیفیت پارچه، تن‌خور، نحوه‌ی ارسال…"></textarea></div>
        <button type="submit" class="btn btn-solid btn-full">ثبت نظر</button>
      </form>
    </div>
  </section>

  <section class="sec tight container">
    <div class="sec-head rv">
      <div>
        <span class="en en-lbl">YOU MAY ALSO LIKE</span>
        <h2>شاید بپسندید</h2>
        <div class="gold-line"></div>
      </div>
    </div>
    <div class="pgrid">${rel.map((x, i) => productCard(x, i)).join('')}</div>
  </section>`;
}

/* ---------------- CHECKOUT ---------------- */
function shipFee() { const m = SHIP.find(s => s.id === shipSel); return m ? m.fee(cartSub()) : 0; }

function viewCheckout() {
  if (!cart.length) {
    return `<div class="nf container"><h1 class="en" style="font-size:60px">EMPTY</h1>
      <p>سبد خرید شما خالی است؛ اول چیزی که دوست دارید انتخاب کنید.</p>
      <a href="#/shop" class="btn btn-solid">رفتن به فروشگاه</a></div>`;
  }
  return `
  <div class="container co">
    <div class="crumb"><a href="#/">خانه</a> / <b>تکمیل خرید</b></div>
    <h1 style="font-size:clamp(26px,3.6vw,40px);font-weight:800;margin-top:6px">تکمیل خرید و پرداخت</h1>
    <div class="co-grid">
      <form id="coForm" novalidate>
        <div class="fsec">
          <h3><i>۱</i> مشخصات گیرنده</h3>
          <div class="grid2">
            <div class="field"><label>نام *</label><input name="fname" data-req placeholder="مثلاً: نگار"><span class="err-t">نام را وارد کنید</span></div>
            <div class="field"><label>نام خانوادگی *</label><input name="lname" data-req placeholder="مثلاً: رفیعی"><span class="err-t">نام خانوادگی را وارد کنید</span></div>
            <div class="field"><label>شماره موبایل *</label><input name="mobile" data-req data-type="mobile" inputmode="numeric" placeholder="09xxxxxxxxx" dir="ltr" style="text-align:left"><span class="err-t">شماره موبایل معتبر وارد کنید (09xxxxxxxxx)</span></div>
            <div class="field"><label>ایمیل (اختیاری)</label><input name="email" data-type="email" placeholder="you@mail.com" dir="ltr" style="text-align:left"><span class="err-t">فرمت ایمیل صحیح نیست</span></div>
          </div>
        </div>

        <div class="fsec">
          <h3><i>۲</i> نشانی تحویل</h3>
          <div class="grid2">
            <div class="field"><label>استان *</label>
              <select name="state" data-req>
                <option value="">انتخاب کنید…</option>
                <option>تهران</option><option>البرز</option><option>اصفهان</option><option>فارس</option>
                <option>خراسان رضوی</option><option>آذربایجان شرقی</option><option>مازندران</option><option>گیلان</option><option>قم</option><option>سایر استان‌ها</option>
              </select><span class="err-t">استان را انتخاب کنید</span></div>
            <div class="field"><label>شهر *</label><input name="city" data-req placeholder="مثلاً: تهران"><span class="err-t">شهر را وارد کنید</span></div>
            <div class="field full"><label>آدرس کامل *</label><textarea name="addr" data-req placeholder="خیابان، کوچه، پلاک، واحد…"></textarea><span class="err-t">آدرس کامل را وارد کنید</span></div>
            <div class="field"><label>کد پستی</label><input name="postal" inputmode="numeric" placeholder="۱۰ رقم" dir="ltr" style="text-align:left"></div>
          </div>
        </div>

        <div class="fsec">
          <h3><i>۳</i> شیوه ارسال</h3>
          ${SHIP.map(s => `<label class="radio-card ${shipSel === s.id ? 'on' : ''}" data-rc="ship">
            <input type="radio" name="ship" value="${s.id}" ${shipSel === s.id ? 'checked' : ''}>
            <span><span class="rc-n">${s.n}</span><span class="rc-d" style="display:block">${s.d}</span></span>
            <span class="rc-f">${s.fee(cartSub()) === 0 ? 'رایگان ✦' : money(s.fee(cartSub()))}</span>
          </label>`).join('')}
        </div>

        <div class="fsec">
          <h3><i>۴</i> شیوه پرداخت</h3>
          ${PAY.map(s => `<label class="radio-card ${paySel === s.id ? 'on' : ''}" data-rc="pay">
            <input type="radio" name="pay" value="${s.id}" ${paySel === s.id ? 'checked' : ''}>
            <span><span class="rc-n">${s.n}</span><span class="rc-d" style="display:block">${s.d}</span></span>
          </label>`).join('')}
        </div>
      </form>

      <aside class="co-sum" id="coSum"></aside>
    </div>
  </div>`;
}

function renderCoSummary() {
  const el = qs('#coSum'); if (!el) return;
  const sub = cartSub();
  const disc = discOf(sub);
  const fee = shipFee();
  const total = sub - disc + fee;
  el.innerHTML = `
    <h3>سفارش شما (${faNum(cartCount())} قلم)</h3>
    <div class="sum-items">
      ${cart.filter(it => PROD(it.id)).map(it => { const p = PROD(it.id); return `<div class="sum-item">
        <img src="${p.img}" alt="">
        <div style="flex:1"><h5>${esc(p.name)}</h5><span>سایز ${esc(it.size)} × ${faNum(it.qty)}</span></div>
        <b>${money(p.price * it.qty)}</b></div>`; }).join('')}
    </div>
    ${coupon ? `<div class="cpn-applied"><span>✔ کد ${esc(coupon.code)} فعال شد — ${faNum(coupon.percent)}٪ تخفیف</span><button type="button" id="cpnRemove">حذف</button></div>`
      : `<div class="cpn"><input id="cpnInput" placeholder="کد تخفیف دارید؟" dir="ltr" style="text-align:left"><button type="button" class="btn btn-dark btn-sm" id="cpnApply">اعمال</button></div>`}
    <div class="trows">
      <div class="trow"><span>جمع اقلام</span><span>${money(sub)}</span></div>
      ${disc ? `<div class="trow disc"><span>تخفیف ${esc(coupon.code)} (${faNum(coupon.percent)}٪)</span><span>(${money(disc)})</span></div>` : ''}
      <div class="trow ${fee === 0 ? 'free' : ''}"><span>هزینه ارسال</span><span>${fee === 0 ? 'رایگان ✦' : money(fee)}</span></div>
    </div>
    <div class="trow grand"><span>مبلغ قابل پرداخت</span><b>${money(total)}</b></div>
    <button type="submit" form="coForm" class="btn btn-solid btn-full" id="placeOrder" style="margin-top:18px">${I.lock} ثبت سفارش و پرداخت</button>
    <div class="secure">${I.lock} پرداخت در محیطی امن — این یک دمو است و مبلغی کسر نمی‌شود</div>`;
}

async function placeOrder(form) {
  let ok = true;
  qsa('[data-req]', form).forEach(inp => {
    const wrap = inp.closest('.field');
    let bad = !inp.value.trim();
    if (!bad && inp.dataset.type === 'mobile') bad = !/^09\d{9}$/.test(inp.value.trim());
    if (!bad && inp.dataset.type === 'email' && inp.value.trim()) bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim());
    wrap.classList.toggle('err', bad);
    if (bad) ok = false;
  });
  if (!ok) { toast('لطفاً موارد مشخص‌شده را تکمیل کنید', true); return; }

  const f = Object.fromEntries(new FormData(form).entries());
  const sub = cartSub(), disc = discOf(sub), fee = shipFee();
  const order = {
    no: 'NOIR-' + faNum(10000 + Math.floor(Math.random() * 89999)),
    date: new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }),
    items: cart.filter(it => PROD(it.id)).map(it => ({ ...PROD(it.id), size: it.size, qty: it.qty })),
    sub, disc, fee, total: sub - disc + fee,
    couponCode: coupon ? coupon.code : '',
    ship: SHIP.find(s => s.id === shipSel).n,
    pay: PAY.find(s => s.id === paySel).n,
    buyer: { name: esc(f.fname + ' ' + f.lname), mobile: esc(f.mobile), city: esc(f.state + '، ' + f.city), addr: esc(f.addr) }
  };
  save('noir_order', order);
  if (API_MODE) {
    try { await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(order) }); }
    catch (e) { toast('ثبت سفارش روی سرور ممکن نشد — اتصال اینترنت را بررسی کنید', true); return; }
  } else {
    const allOrders = getOrders();
    allOrders.unshift({ ...order, status: 'در حال پردازش', created: Date.now() });
    save('noir_orders', allOrders);
  }
  /* اگر پرداخت آنلاین انتخاب شده و سرور واقعی فعال است → هدایت به درگاه */
  if (API_MODE && paySel === 'online') {
    try {
      const r = await fetch('/api/payment/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ no: order.no }) });
      const j = await r.json().catch(() => ({}));
      if (j && j.url) { window.location.href = j.url; return; }
      toast(j && j.error ? j.error : 'درگاه پرداخت موقتاً فعال نیست — سفارش به‌صورت دمو ثبت شد', true);
    } catch (e) {
      toast('ارتباط با درگاه برقرار نشد — سفارش به‌صورت دمو ثبت شد', true);
    }
  }
  cart = []; coupon = null; save('noir_cart', cart); save('noir_coupon', coupon);
  renderBadge();
  location.hash = '#/success';
}

/* ---------------- SUCCESS ---------------- */
function viewSuccess() {
  const o = load('noir_order', null);
  if (!o) { location.hash = '#/'; return ''; }
  /* رسیدن به این صفحه یعنی سفارش نهایی شده — سبد را خالی می‌کنیم */
  cart = []; coupon = null;
  save('noir_cart', cart); save('noir_coupon', coupon);
  renderBadge();
  return `
  <div class="container">
    <div class="done">
      <div class="done-ic">${I.check}</div>
      <span class="kick" style="justify-content:center"><i></i>سفارش با موفقیت ثبت شد<i></i></span>
      <h1>سپاس از اعتماد شما به نُوار</h1>
      <div class="ono" dir="ltr">ORDER № ${o.no}</div>
      <p class="dim">${o.buyer.name} عزیز، سفارش شما با روش «${o.ship}» ثبت شد و جزئیات آن به شماره <span dir="ltr">${o.buyer.mobile}</span> پیامک می‌شود.<br>${o.pay === 'کارت به کارت' ? 'شماره کارت جهت واریز، در پیامک برایتان ارسال شد.' : o.pay === 'پرداخت در محل' ? 'مبلغ را پس از تحویل و بازبینی کالا به مامور ارسال بپردازید.' : 'در نسخه‌ی واقعی، همین‌جا به درگاه امن بانک منتقل می‌شدید.'}</p>
      <div class="done-card">
        ${o.items.map(it => `<div class="trow"><span>${esc(it.name)} — سایز ${esc(it.size)} × ${faNum(it.qty)}</span><span>${money(it.price * it.qty)}</span></div>`).join('')}
        <div class="trow"><span>هزینه ارسال</span><span>${o.fee === 0 ? 'رایگان' : money(o.fee)}</span></div>
        ${o.disc ? `<div class="trow" style="color:var(--green)"><span>تخفیف</span><span>(${money(o.disc)})</span></div>` : ''}
        <div class="trow grand"><span>مبلغ کل · ${o.date}</span><b>${money(o.total)}</b></div>
      </div>
      <div class="row">
        <a href="#/shop" class="btn btn-solid">ادامه خرید</a>
        <button class="btn btn-dark" id="printBtn">🖨 چاپ فاکتور</button>
        <a href="#/" class="btn btn-ghost">بازگشت به خانه</a>
      </div>
    </div>
  </div>`;
}

/* ---------------- 404 ---------------- */
function view404() {
  return `<div class="nf container"><h1>404</h1><p>صفحه‌ای که دنبالش بودید پیدا نشد.</p>
    <a href="#/" class="btn btn-solid">بازگشت به فروشگاه</a></div>`;
}

/* ============================== ROUTER ============================== */
const view = () => qs('#view');
function router() {
  closeAllPanels();
  const h = location.hash.slice(2);
  const [path, query] = h.split('?');
  const params = new URLSearchParams(query || '');
  const seg = (path || '').replace(/\/+$/, '').split('/');
  let html, nav = '';

  if (seg[0] === '' || seg[0] === undefined) { html = viewHome(); nav = 'home'; }
  else if (seg[0] === 'shop') { nav = params.get('cat') || 'shop'; html = viewShop(params); }
  else if (seg[0] === 'product') { html = viewProduct(seg[1]); nav = 'shop'; }
  else if (seg[0] === 'about') { html = viewAbout(); nav = 'about'; }
  else if (seg[0] === 'checkout') { html = viewCheckout(); }
  else if (seg[0] === 'success') { html = viewSuccess(); }
  else if (seg[0] === 'admin') { html = typeof renderAdmin === 'function' ? renderAdmin(seg, params) : view404(); }
  else { html = view404(); }

  window.scrollTo({ top: 0, behavior: 'instant' });
  const v = view();
  v.classList.remove('fade-in'); void v.offsetWidth;
  v.innerHTML = html;
  v.classList.add('fade-in');
  document.body.classList.toggle('admin-mode', seg[0] === 'admin');

  qsa('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === nav));

  if (seg[0] === 'shop') { applyShop(); const q = params.get('q'); if (q) { shopF.q = q; const sq = qs('#shopQ'); if (sq) sq.value = q; applyShop(); } }
  if (seg[0] === 'checkout') renderCoSummary();
  if (seg[0] === 'product') fillReviews(seg[1]);
  if (seg[0] === 'admin' && typeof bindAdmin === 'function') bindAdmin(seg, params);

  updateMeta(seg, params);
  initReveal();
}

/* ============================== سئوی پویا: عنوان + توضیحات + JSON-LD هر صفحه ============================== */
const META_DEFAULT = {
  title: 'آتلیه نُوار | پوشاک لوکس — فروشگاه آنلاین',
  desc: 'آتلیه نُوار؛ کلکسیون پوشاک لوکس زنانه و مردانه با پارچه‌های وارداتی — پالتو کشمیر، چرم، ابریشم و اکسسوری.'
};
function updateMeta(seg, params) {
  let { title, desc } = META_DEFAULT;
  if (seg[0] === 'shop') {
    const cat = (params && params.get('cat')) || '';
    const cTitle = (typeof CATS !== 'undefined' && CATS[cat]) || '';
    title = cTitle ? `${cTitle} | آتلیه نُوار` : 'فروشگاه — همه محصولات | آتلیه نُوار';
    desc = cTitle ? `کلکسیون ${cTitle} آتلیه نُوار؛ طراحی محدود، پارچه وارداتی و دوخت دست.` : 'همه محصولات آتلیه نُوار؛ پالتو کشمیر، مانتو، کیف چرم طبیعی و شال ابریشم با ارسال سراسری.';
  } else if (seg[0] === 'product') {
    const p = seg[1] && PROD(seg[1]);
    if (p) {
      title = `${p.name} | آتلیه نُوار`;
      desc = `${p.name} — ${p.en}. ${faNum(p.price)} تومان | دسته: ${(typeof CATS !== 'undefined' && CATS[p.cat]) || p.cat}. خرید آنلاین با ارسال سراسری و ضمانت بازگشت از آتلیه نُوار.`;
    }
  } else if (seg[0] === 'about') { title = 'درباره ما | آتلیه نُوار'; desc = 'روایت برند آتلیه نُوار، تعهد به دوخت دست و پارچه‌های پایدار با تجربه لذت اقتنایی.'; }
  else if (seg[0] === 'checkout') { title = 'تکمیل خرید | آتلیه نُوار'; desc = 'ثبت سفارش و پرداخت امن در آتلیه نُوار.'; }
  else if (seg[0] === 'admin') { title = 'پنل مدیریت | آتلیه نُوار'; desc = 'مدیریت فروشگاه آتلیه نُوار.'; }
  document.title = title;
  const md = document.head.querySelector('meta[name="description"]');
  if (md) md.setAttribute('content', desc);
  const og = document.head.querySelector('meta[property="og:description"]');
  if (og) og.setAttribute('content', desc);
  const ogT = document.head.querySelector('meta[property="og:title"]');
  if (ogT) ogT.setAttribute('content', title);
  /* JSON-LD محصول برای گوگل */
  qsa('script[data-prod-ld]').forEach(s => s.remove());
  if (seg[0] === 'product' && seg[1] && PROD(seg[1])) {
    const p = PROD(seg[1]);
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: p.name, alternateName: p.en,
      image: [new URL(p.img, location.origin + location.pathname).href],
      description: desc, category: p.cat,
      brand: { '@type': 'Brand', name: 'آتلیه نُوار | Atelier Noir' },
      offers: {
        '@type': 'Offer', priceCurrency: 'IRR',
        price: p.price * 10, availability: 'https://schema.org/InStock',
        url: location.href
      }
    };
    const rs = REVIEWS && REVIEWS.filter(r => r.productId === p.id);
    if (rs && rs.length) {
      ld.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: (rs.reduce((a, r) => a + r.rating, 0) / rs.length).toFixed(1),
        reviewCount: rs.length
      };
    }
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-prod-ld', '1');
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }
}

/* ============================== REVEAL ============================== */
const io = new IntersectionObserver(es => es.forEach(x => {
  if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
}), { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
function initReveal() { qsa('.rv:not(.in)').forEach(el => io.observe(el)); }

/* ============================== SEARCH ============================== */
function runSearch(q) {
  const box = qs('#searchResults');
  q = q.trim();
  if (!q) { box.innerHTML = ''; return; }
  const res = PRODUCTS.filter(p => !p.hidden && (p.name.includes(q) || p.en.toLowerCase().includes(q.toLowerCase()) || CATS[p.cat].includes(q))).slice(0, 6);
  box.innerHTML = res.length
    ? res.map(p => `<a class="s-row" href="#/product/${p.id}">
        <img src="${p.img}" alt=""><span><span class="s-name">${esc(p.name)}</span><br><span class="s-en">${p.en}</span></span>
        <span class="s-price">${money(p.price)}</span></a>`).join('')
      + `<a class="s-row" href="#/shop?q=${encodeURIComponent(q)}" style="justify-content:center;color:var(--gold2);font-size:13px;border-bottom:none">مشاهده در صفحه فروشگاه ←</a>`
    : `<div class="s-empty">برابر «${esc(q)}» چیزی پیدا نشد.</div>`;
}

/* ============================== INFO MODAL ============================== */
function openInfo(k) {
  if (k === 'size') { openPanelQ('#sizeModal'); return; }
  const d = INFO[k]; if (!d) return;
  qs('#imTitle').textContent = d.t;
  qs('#imBody').innerHTML = d.b;
  openPanelQ('#infoModal');
}
function openPanelQ(sel) { openPanel(sel); }

/* ---------------- ABOUT ---------------- */
function viewAbout() {
  return `
  <section class="ah">
    <img src="lookbook.jpg" alt="درباره ${SETTINGS.brandFa}">
    <div class="ah-ov"></div>
    <div class="ah-tx">
      <span class="kick"><i></i>داستان ما<i></i></span>
      <h1>درباره نُوار</h1>
      <p>لباسِ خوب، فریاد نمی‌زند؛ <em style="color:var(--gold);font-style:normal">زمزمه</em> می‌کند.</p>
    </div>
  </section>

  <section class="sec">
    <div class="container">
      <div class="edit rv">
        <div class="edit-img" style="min-height:460px"><img src="coat-camel.jpg" alt="آتلیه" loading="lazy"></div>
        <div class="edit-txt">
          <span class="kick"><i></i>از کجا شروع شد؟</span>
          <h2>کارگاه کوچکی که<br><em>کمد کمدوارت</em> می‌ساخت</h2>
          <p>نُوار سال ۱۳۹۷ در یک اتاقِ کوچک در تهران شروع شد. ما با این سوال به جای «ترند فصل» رفتیم: «کدوم لباس رو ده سال دیگه هم دوست دارید؟»</p>
          <p>هر قطعه قبل از برش، از فیلتر وسواس‌گونه‌ی ما رد می‌شود: پارچه‌های طبیعی گواهی‌دار، دوخت دستی، و جزئیاتی که فقط وقتی نزدیک شوید دیده می‌شوند. همین که هر سال ۷۰٪ مشتری‌هایمان دوباره برمی‌گردند، پاداشِ همین وسواس است.</p>
          <div class="edit-row">
            <div><b>+۸</b><span>سال تجربه</span></div>
            <div><b>۱۶</b><span>کلکسیون محدود</span></div>
            <div><b>+۱۲هزار</b><span>مشتری وفادار</span></div>
          </div>
          <a href="#/shop" class="btn btn-solid" style="align-self:flex-start;margin-top:10px">تماشای کلکسیون امسال</a>
        </div>
      </div>
    </div>
  </section>

  <section class="sec tight">
    <div class="container">
      <div class="sec-head rv"><div>
        <span class="en en-lbl">OUR PROMISE</span>
        <h2>تعهد ما به شما</h2>
        <div class="gold-line"></div>
      </div></div>
      <div class="vals rv">
        <div class="val">${I.truck}<h4>ارسال سریع و بیمه‌دار</h4><p>تحویل ۱ تا ۵ روز کاری در سراسر کشور؛ بسته‌های نُوار لایه‌لایه محافظت می‌شوند.</p></div>
        <div class="val">${I.shield}<h4>ضمانت اصالت کالا</h4><p>هر قطعه هولوگرام اصالت و شناسنامه‌ی پارچه دارد؛ فقط از تامین‌کنندگان گواهی‌دار تهیه می‌کنیم.</p></div>
        <div class="val">${I.rotate}<h4>۷ روز بازگشت آسان</h4><p>بدون سؤال و فرم طولانی؛ کافیست با پشتیبانی هماهنگ کنید.</p></div>
        <div class="val">${I.gift}<h4>بسته‌بندی هدیه</h4><p>جعبه‌ی سیگنچر نُوار + کارت دست‌نویس؛ برای خودتان یا هدیه.</p></div>
      </div>
    </div>
  </section>

  <section class="sec tight" style="padding-bottom:100px">
    <div class="container">
      <div class="nl rv">
        <span class="kick" style="justify-content:center"><i></i>در خدمت شما هستیم<i></i></span>
        <h3>صدا در آتلیه، بدو برخورد</h3>
        <p>پاسخگویی تلفیف: ${SETTINGS.hours.replace('پاسخگویی: ', '')}</p>
        <div class="about-contact">
          <span>☎ <span dir="ltr">${SETTINGS.phone}</span></span>
          <span>✉ ${SETTINGS.email}</span>
          <span>📍 ${SETTINGS.address}</span>
        </div>
        <a href="#/shop" class="btn btn-solid" style="margin-top:26px">رفتن به فروشگاه</a>
      </div>
    </div>
  </section>`;
}

/* ============================== BOOT ============================== */
async function boot() {
  await initStore();
  renderBadge();
  applySettings();
  router();

  /* ثبت Service Worker برای قابلیت نصب (PWA) و کار آفلاین */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* PWA اختیاری است */ });
  }
}

/* ============================== SETTINGS APPLY ============================== */
function applySettings() {
  const map = { brandFa: SETTINGS.brandFa, brandEn: SETTINGS.brandEn, phone: SETTINGS.phone, email: SETTINGS.email, address: SETTINGS.address, hours: SETTINGS.hours };
  qsa('[data-set]').forEach(el => {
    const k = el.dataset.set;
    if (k === 'announce') { el.innerHTML = SETTINGS.announce; return; }
    if (map[k] !== undefined) el.textContent = map[k];
  });
}

/* ============================== EVENTS ============================== */
document.addEventListener('DOMContentLoaded', () => {

  /* ---- static chrome ---- */
  qs('#cartBtn').addEventListener('click', openDrawer);
  qs('#menuBtn').addEventListener('click', () => openPanel('#mNav'));
  qs('#navClose').addEventListener('click', closeAllPanels);
  qs('#backdrop').addEventListener('click', closeAllPanels);
  qs('#searchBtn').addEventListener('click', () => { openPanel('#searchOv'); setTimeout(() => qs('#searchInput').focus(), 100); });
  qs('#searchClose').addEventListener('click', closeAllPanels);
  qs('#searchInput').addEventListener('input', e => runSearch(e.target.value));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllPanels(); });
  window.addEventListener('scroll', () => qs('#siteHead').classList.toggle('scrolled', scrollY > 30));
  window.addEventListener('hashchange', router);

  /* ---- global click delegation ---- */
  document.addEventListener('click', e => {
    const qa = e.target.closest('[data-qa]'); if (qa) { quickAdd(qa.dataset.qa); return; }
    const wh = e.target.closest('[data-wish]'); if (wh) { toggleWish(wh.dataset.wish); return; }
    const acb = e.target.closest('.acc-btn'); if (acb) { acb.closest('.acc').classList.toggle('open'); return; }
    const inf = e.target.closest('[data-info]'); if (inf) { openInfo(inf.dataset.info); return; }
    const clo = e.target.closest('[data-close]'); if (clo) { const m = clo.closest('.modal,bottom-wrap'); if (m) { m.classList.remove('open'); afterPanel(); } return; }

    /* product page */
    const sz = e.target.closest('[data-size]');
    if (sz && qs('#pdSizes')) {
      pdSel.size = sz.dataset.size;
      qsa('#pdSizes .chip').forEach(c => c.classList.toggle('on', c.dataset.size === pdSel.size));
      return;
    }
    const col = e.target.closest('[data-color]');
    if (col && qs('#pdColors')) {
      qsa('#pdColors .dot').forEach(d => d.classList.toggle('on', d === col));
      qs('#pdColorName').textContent = col.dataset.color;
      return;
    }
    const qy = e.target.closest('[data-qty]');
    if (qy && qs('#pdQty')) {
      pdSel.qty = Math.min(9, Math.max(1, pdSel.qty + Number(qy.dataset.qty)));
      qs('#pdQty').textContent = faNum(pdSel.qty);
      return;
    }
    if (e.target.closest('#addBtn')) {
      const id = location.hash.split('/')[2];
      const p = PROD(id);
      if (!pdSel.size && p.sizes.length > 1) { toast('لطفاً ابتدا سایز را انتخاب کنید', true); return; }
      addToCart(id, pdSel.size || p.sizes[0], pdSel.qty);
      toast(`«${p.name}» به سبد اضافه شد`);
      openDrawer();
      return;
    }
    if (e.target.closest('#buyBtn')) {
      const id = e.target.closest('#buyBtn').dataset.id;
      const p = PROD(id);
      if (!pdSel.size && p.sizes.length > 1) { toast('لطفاً ابتدا سایز را انتخاب کنید', true); return; }
      addToCart(id, pdSel.size || p.sizes[0], pdSel.qty);
      location.hash = '#/checkout';
      return;
    }

    /* cart drawer */
    const cq = e.target.closest('[data-cqty]');
    if (cq) {
      const it = cart.find(i => kOf(i) === cq.dataset.k);
      if (it) { it.qty += Number(cq.dataset.cqty); if (it.qty <= 0) cart = cart.filter(i => i !== it); else it.qty = Math.min(9, it.qty); saveCart(); }
      return;
    }
    const cd = e.target.closest('[data-cdel]');
    if (cd) { cart = cart.filter(i => kOf(i) !== cd.dataset.cdel); saveCart(); toast('از سبد حذف شد'); return; }

    /* shop */
    const fsz = e.target.closest('[data-fsize]');
    if (fsz) {
      const s = fsz.dataset.fsize;
      shopF.sizes.has(s) ? shopF.sizes.delete(s) : shopF.sizes.add(s);
      fsz.classList.toggle('on'); applyShop(); return;
    }
    if (e.target.closest('#fClear') || e.target.closest('#fClear2')) {
      shopF = { cats: new Set(), sizes: new Set(), max: 16000000, sort: 'new', q: '' };
      router(); return;
    }
    if (e.target.closest('#fToggle')) { openPanel('#filters'); return; }
    if (e.target.closest('#fClose')) { closeAllPanels(); return; }

    /* checkout */
    const rc = e.target.closest('[data-rc]');
    if (rc) {
      const inp = qs('input', rc); inp.checked = true;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (e.target.closest('#cpnApply')) {
      const v = (qs('#cpnInput').value || '').trim().toUpperCase();
      if (!v) { toast('کد تخفیف را وارد کنید', true); return; }
      applyCoupon(v);
      return;
    }
    if (e.target.closest('#cpnRemove')) { coupon = null; save('noir_coupon', coupon); renderCoSummary(); return; }

    /* نظرات */
    const rvb = e.target.closest('#rvRate button');
    if (rvb) { RV_RATE = +rvb.dataset.n; syncStars(); return; }
    if (e.target.closest('#printBtn')) { printInvoice(); return; }
    const rd = e.target.closest('[data-revdel]');
    if (rd) {
      (async () => {
        try { await apiFetch('/api/reviews/' + encodeURIComponent(rd.dataset.revdel), { method: 'DELETE' }); } catch (err) { }
        const cur = location.hash.split('/')[2];
        fillReviews(cur);
        toast('نظر حذف شد');
      })();
      return;
    }
  });

  /* ---- change delegation ---- */
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.name === 'fcat') {
      el.checked ? shopF.cats.add(el.value) : shopF.cats.delete(el.value);
      qsa('input[name="fcat"]', el.closest('.filters') || document).forEach(i => { });
      applyShop();
    }
    if (el.name === 'ship') { shipSel = el.value; syncRC('ship'); renderCoSummary(); }
    if (el.name === 'pay') { paySel = el.value; syncRC('pay'); }
    if (el.id === 'sortSel') { shopF.sort = el.value; applyShop(); }
  });

  /* ---- input delegation ---- */
  document.addEventListener('input', e => {
    if (e.target.id === 'fRange') {
      shopF.max = Number(e.target.value);
      qs('#fRangeVal').textContent = money(shopF.max);
      applyShop();
    }
    if (e.target.id === 'shopQ') { shopF.q = e.target.value; applyShop(); }
  });

  /* ---- submit delegation ---- */
  document.addEventListener('submit', e => {
    if (e.target.id === 'coForm') { e.preventDefault(); placeOrder(e.target); }
    if (e.target.id === 'revForm') { e.preventDefault(); submitReview(e.target); }
    if (e.target.id === 'nlForm') {
      e.preventDefault();
      toast('خوش آمدید! ۱۵٪ کد هدیه عضویت برایتان پیامک می‌شود.');
      e.target.reset();
    }
  });

  boot();
});

function syncRC(key) {
  qsa(`[data-rc="${key}"]`).forEach(rc => rc.classList.toggle('on', qs('input', rc).checked));
}
