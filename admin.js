/* =====================================================================
   آتلیه نُوار — پنل مدیریت فروشگاه (Products & Orders)
   دو حالت کاری:
   • حالت سرور واقعی (API فعال): دیتا روی سرور و مشترک بین همه بازدیدکننده‌ها
   • حالت استاتیک: دیتا در حافظه مرورگر (localStorage)
   ===================================================================== */
'use strict';

/* رمز نسخه استاتیک از localStorage ('noir_spass') یا SETTINGS.adminPass خوانده می‌شود؛ در حالت سرور، رمز سمت سرور چک می‌شود */
const isApi = () => (typeof API_MODE !== 'undefined' && API_MODE);
const isAuthed = () => isApi() ? !!sessionStorage.getItem('noir_token') : sessionStorage.getItem('noir_admin') === '1';

const STATUS = ['در حال پردازش', 'در انتظار پرداخت', 'پرداخت شده', 'آماده‌سازی', 'ارسال شده', 'تحویل شده', 'لغو شده'];
const STATUS_COLOR = {
  'در حال پردازش': '#c9a15f', 'در انتظار پرداخت': '#e0b864', 'پرداخت شده': '#87b87c',
  'آماده‌سازی': '#8fb3d9', 'ارسال شده': '#b493d1', 'تحویل شده': '#87b87c', 'لغو شده': '#d0604f'
};

/* ------------------------ لایه دیتا (پیکربندی دوحالته) ------------------------ */
async function fetchOrders() {
  if (isApi()) { try { return await apiFetch('/api/orders'); } catch (e) { return []; } }
  return getOrders();
}
let ADMIN_ORDERS_CACHE = [];
async function syncAfter() {
  if (isApi()) { try { PRODUCTS = await apiFetch('/api/products'); } catch (e) { } }
}

/* ============================== ROUTER VIEW ============================== */
function renderAdmin(seg, params) {
  if (!isAuthed()) return admLoginView();
  const sub = seg[1] || 'dash';
  const main =
    sub === 'products' ? admProducts() :
    sub === 'orders' ? admOrders() :
    sub === 'discounts' ? admDiscounts() :
    sub === 'settings' ? admSettings() :
    (sub === 'new' || sub === 'edit') ? admForm(sub === 'edit' ? (seg[2] || params.get('id')) : null) :
    admDash();
  return `
  <div class="adm">
    <aside class="adm-side">
      <div class="adm-logo">آتلیه نُوار<span>پنل مدیریت فروشگاه</span></div>
      <nav class="adm-nav">
        <a href="#/admin" class="${sub === 'dash' ? 'on' : ''}">داشبورد</a>
        <a href="#/admin/products" class="${sub === 'products' ? 'on' : ''}">محصولات</a>
        <a href="#/admin/orders" class="${sub === 'orders' ? 'on' : ''}">سفارش‌ها <b class="adm-badge" id="admOrderBadge">۰</b></a>
        <a href="#/admin/discounts" class="${sub === 'discounts' ? 'on' : ''}">کدهای تخفیف</a>
        <a href="#/admin/settings" class="${sub === 'settings' ? 'on' : ''}">تنظیمات سایت</a>
        <a href="#/admin/new" class="${sub === 'new' ? 'on' : ''}">+ محصول جدید</a>
      </nav>
      <div class="adm-side-foot">
        <span style="font-size:10.5px;color:${isApi() ? 'var(--green)' : 'var(--mut)'};padding:2px 10px">
          ${isApi() ? '● حالت سرور واقعی — دیتا مشترک' : '○ حالت دمو (حافظه مرورگر)'}
        </span>
        <a href="#/" class="adm-shop">↗ مشاهده فروشگاه</a>
        <button id="admBackup">⬇ پشتیبان‌گیری از دیتا</button>
        <button id="admRestore">⬆ بازیابی نسخه پشتیبان</button>
        <button id="admReset">بازنشانی دیتا به حالت اولیه</button>
        <button id="admLogout">خروج از پنل</button>
      </div>
    </aside>
    <main class="adm-main">${main}</main>
  </div>`;
}

function bindAdmin(seg) {
  if (!isAuthed()) return;
  const sub = (seg && seg[1]) || 'dash';
  if (sub === 'orders') fillOrders();
  if (sub === 'discounts') fillDiscounts();
  if (sub === 'settings') fillSettings();
  if (sub === 'dash') fillDash();
}
function setBadge(el, n) { const b = qs(el); if (b) b.textContent = faNum(n); }

/* ============================== LOGIN ============================== */
function admLoginView() {
  return `
  <div class="adm-login">
    <form class="adm-login-card fade-in" id="admLoginForm" novalidate>
      <span class="logo" style="margin-bottom:6px;display:block;text-align:center">
        <span class="logo-fa">آتلیه نُوار</span>
        <span class="logo-en">ADMIN PANEL</span>
      </span>
      <h1>ورود به پنل مدیریت</h1>
      <p class="dim">برای مدیریت محصولات و سفارش‌ها وارد شوید.</p>
      <div class="field" style="margin-top:22px">
        <label>رمز عبور</label>
        <input type="password" id="admPass" placeholder="••••••••" autocomplete="current-password">
        <span class="err-t">رمز عبور اشتباه است</span>
      </div>
      <button class="btn btn-solid btn-full" type="submit" style="margin-top:16px">ورود به پنل</button>
      <p class="dim" style="font-size:11.5px;margin-top:14px;text-align:center">رمز عبور را مالک فروشگاه می‌داند و می‌تواند آن را از بخش «تنظیمات» تغییر دهد.</p>
      <a href="#/" style="display:block;text-align:center;font-size:12px;color:var(--mut);margin-top:18px">← بازگشت به فروشگاه</a>
    </form>
  </div>`;
}

/* ============================== DASHBOARD ============================== */
function admDash() {
  const active = PRODUCTS.filter(p => !p.hidden);
  const inv = active.reduce((a, p) => a + p.price, 0);
  const maxCnt = Math.max(1, ...Object.keys(CATS).map(k => active.filter(p => p.cat === k).length));
  return `
  <div class="adm-h">
    <h1>داشبورد</h1>
    <span class="dim" style="font-size:13px">${new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
  </div>
  <div class="stat-grid">
    <div class="stat"><span class="stat-n">${faNum(active.length)}</span><span class="stat-t">محصول فعال در فروشگاه</span></div>
    <div class="stat"><span class="stat-n" style="font-size:17px">${money(inv)}</span><span class="stat-t">ارزش موجودی انبار</span></div>
    <div class="stat"><span class="stat-n" id="stOrders">…</span><span class="stat-t">سفارش ثبت‌شده</span></div>
    <div class="stat"><span class="stat-n gold" id="stRev" style="font-size:17px">…</span><span class="stat-t">فروش کل</span></div>
  </div>
  <div class="grid2" style="margin-top:22px;align-items:start">
    <div class="fsec" style="margin:0">
      <h3 style="margin-bottom:18px"><i></i>محصولات به تفکیک دسته</h3>
      ${Object.keys(CATS).map(k => {
        const n = active.filter(p => p.cat === k).length;
        return `<div class="bar-row"><span>${CATS[k]}</span><div class="bar"><i style="width:${Math.round(n / maxCnt * 100)}%"></i></div><b>${faNum(n)}</b></div>`;
      }).join('')}
      <p class="dim" style="font-size:12px;margin-top:16px">${faNum(PRODUCTS.length - active.length)} محصول از نمایش مخفی است — از لیست محصولات قابل فعال‌سازی است.</p>
    </div>
    <div class="fsec" style="margin:0">
      <h3 style="margin-bottom:12px"><i></i>آخرین سفارش‌ها</h3>
      <div id="dashOrders"><p class="dim" style="font-size:13px">در حال بارگذاری…</p></div>
    </div>
  </div>`;
}

async function fillDash() {
  const os = await fetchOrders();
  const rev = os.filter(o => o.status !== 'لغو شده').reduce((a, o) => a + o.total, 0);
  const so = qs('#stOrders'); if (so) so.textContent = faNum(os.length);
  const sr = qs('#stRev'); if (sr) sr.textContent = money(rev);
  setBadge('#admOrderBadge', os.length);
  const w = qs('#dashOrders');
  if (w) w.innerHTML = os.length
    ? os.slice(0, 5).map(o => `<div class="mini-row">
        <span dir="ltr" style="font-weight:700;font-size:11.5px">${o.no}</span>
        <span>${esc(o.buyer.name)}</span>
        <b>${money(o.total)}</b>
        <em style="color:${STATUS_COLOR[o.status] || 'var(--mut)'}">${esc(o.status)}</em>
      </div>`).join('') + '<a href="#/admin/orders" class="link-more" style="margin-top:10px;display:inline-flex">مشاهده همه سفارش‌ها</a>'
    : '<p class="dim" style="font-size:13px;line-height:2">هنوز سفارشی ثبت نشده. برای تست، از خودِ فروشگاه یک خرید انجام دهید!</p>';
}

/* ============================== PRODUCTS ============================== */
function admProducts() {
  return `
  <div class="adm-h">
    <h1>محصولات <span class="dim" style="font-size:13px;font-weight:400">(${faNum(PRODUCTS.length)} مورد)</span></h1>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <input id="admSearch" class="adm-search" placeholder="جستجوی محصول…" type="text">
      <a href="#/admin/new" class="btn btn-solid btn-sm">+ افزودن محصول</a>
    </div>
  </div>
  <div class="table-wrap">
    <table class="adm-tbl">
      <thead><tr><th style="width:60px"></th><th>محصول</th><th>دسته</th><th>قیمت (تومان)</th><th>برچسب</th><th>سایزها</th><th>نمایش</th><th></th></tr></thead>
      <tbody id="admRows">${admRowsHTML('')}</tbody>
    </table>
  </div>`;
}

function admRowsHTML(q) {
  const list = PRODUCTS.filter(p => !q || p.name.includes(q) || p.en.toLowerCase().includes(q.toLowerCase()));
  if (!list.length) return `<tr><td colspan="8" style="text-align:center;color:var(--mut);padding:44px">محصولی یافت نشد.</td></tr>`;
  return list.map(p => `
    <tr>
      <td><img class="adm-thumb" src="${p.img}" alt=""></td>
      <td><b>${esc(p.name)}</b><small class="dim" style="display:block;font-family:var(--font-en);font-style:italic;font-size:10.5px">${esc(p.en)}</small></td>
      <td>${CATS[p.cat] || p.cat}</td>
      <td><b style="color:var(--gold2)">${faNum(p.price)}</b>${p.old ? `<small class="dim" style="display:block"><s>${faNum(p.old)}</s></small>` : ''}</td>
      <td>${p.tag ? `<span class="adm-tag">${p.tag}</span>` : '<span class="dim">—</span>'}</td>
      <td class="dim" style="font-size:12px">${p.sizes.join('، ')}</td>
      <td><label class="switch" title="${p.hidden ? 'نمایش' : 'مخفی کردن'}"><input type="checkbox" data-vis="${p.id}" ${p.hidden ? '' : 'checked'}><i></i></label></td>
      <td class="adm-acts"><a href="#/admin/edit/${p.id}">ویرایش</a><button data-del="${p.id}">حذف</button></td>
    </tr>`).join('');
}

/* ============================== ORDERS ============================== */
function admOrders() {
  return `
  <div class="adm-h"><h1>سفارش‌ها</h1></div>
  <div id="ordersWrap"><p class="dim" style="padding:10px 4px">در حال بارگذاری…</p></div>`;
}

async function fillOrders() {
  const w = qs('#ordersWrap'); if (!w) return;
  const os = await fetchOrders();
  ADMIN_ORDERS_CACHE = os;
  setBadge('#admOrderBadge', os.length);
  w.innerHTML = ordersListHTML(os);
}

function ordersListHTML(os) {
  if (!os.length) return `<div class="empty"><h4>هنوز سفارشی ثبت نشده</h4><p>برای تست، از خودِ فروشگاه یک خرید انجام دهید تا اینجا نمایش داده شود.</p><a href="#/shop" class="btn btn-solid btn-sm" style="margin-top:16px">رفتن به فروشگاه</a></div>`;
  return os.map((o, i) => `
  <div class="o-card">
    <div class="o-head" data-exp="${i}">
      <span class="o-no" dir="ltr">${o.no}</span>
      <span class="o-buyer">${esc(o.buyer.name)}</span>
      <span class="o-date dim">${esc(o.date)}</span>
      <span class="o-items dim">${faNum(o.items.reduce((a, x) => a + x.qty, 0))} قلم</span>
      <b class="o-total">${money(o.total)}</b>
      <select data-status="${o.no}" class="o-status" style="color:${STATUS_COLOR[o.status] || 'var(--ivory)'}" onclick="event.stopPropagation()">
        ${STATUS.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="o-body" id="ob-${i}">
      <div class="o-items-list">
        ${o.items.map(it => `<div class="mini-row">
          ${it.img ? `<img src="${it.img}" style="width:34px;height:43px;object-fit:cover;border:1px solid var(--line)" alt="">` : ''}
          <span>${esc(it.name)}</span><span class="dim">سایز ${esc(it.size)} × ${faNum(it.qty)}</span><b>${money(it.price * it.qty)}</b>
        </div>`).join('')}
      </div>
      <div class="o-meta">
        <div><b>روش ارسال:</b> ${esc(o.ship)} &nbsp;·&nbsp; <b>روش پرداخت:</b> ${esc(o.pay)}</div>
        <div><b>نشانی:</b> ${esc(o.buyer.city)} — ${esc(o.buyer.addr)}</div>
        <div><b>موبایل:</b> <span dir="ltr">${esc(o.buyer.mobile)}</span></div>
        <div style="margin-top:6px"><button class="btn btn-dark btn-sm" data-print="${o.no}">🖨 چاپ فاکتور</button></div>
      </div>
    </div>
  </div>`).join('');
}

/* ============================== SITE SETTINGS ============================== */
const SET_FIELDS = [
  { sec: 'هویت برند' },
  { k: 'brandFa', label: 'نام فارسی برند', ph: 'آتلیه نُوار' },
  { k: 'brandEn', label: 'نام لاتین برند', ph: 'ATELIER NOIR' },
  { k: 'announce', label: 'نوار اعلان بالای سایت (HTML ساده قابل استفاده است)', ph: 'ارسال رایگان برای سفارش‌های بالای ۵ میلیون تومان...' },
  { sec: 'صفحه اصلی (بخش هیرو)' },
  { k: 'hero.kick', label: 'خط کوچک بالای تیتر', ph: 'کلکسیون پاییز و زمستان ۱۴۰۵' },
  { k: 'hero.t1', label: 'تیتر اصلی — بخش اول', ph: 'شکوه، در سکوتِ' },
  { k: 'hero.t2', label: 'تیتر اصلی — کلمه طلایی ایتالیک', ph: 'جزئیات' },
  { k: 'hero.t3', label: 'تیتر اصلی — بخش آخر', ph: 'پنهان است' },
  { k: 'hero.sub', label: 'توضیحات زیر تیتر', ph: 'کشمیر مغولستان، چرم دباغی ایتالیا...', ta: true },
  { sec: 'اطلاعات تماس و ارسال' },
  { k: 'phone', label: 'تلفن', ph: '۰۲۱ - ۲۶۲۲ ۸۴۶۰' },
  { k: 'email', label: 'ایمیل', ph: 'atelier@noir.ir' },
  { k: 'address', label: 'آدرس فروشگاه', ph: 'تهران، خیابان ولیعصر...' },
  { k: 'hours', label: 'ساعات پاسخگویی', ph: 'شنبه تا پنجشنبه، ۹ تا ۱۸' },
  { k: 'freeShippingAt', label: 'سقف ارسال رایگان (تومان)', ph: '۵۰۰۰۰۰۰', type: 'number' }
];

function getSet(k) {
  return k.startsWith('hero.') ? (SETTINGS.hero || {})[k.slice(5)] : SETTINGS[k];
}

function admSettings() {
  return `
  <div class="adm-h"><h1>تنظیمات سایت</h1></div>
  <div id="setNote" style="max-width:760px"></div>
  <form id="setForm" class="fsec" style="max-width:760px" novalidate>
    ${SET_FIELDS.map(f => f.sec
      ? `<h3 style="margin:18px 0 12px;color:var(--gold2)">${f.sec}</h3>`
      : `<div class="field">
          <label>${f.label}</label>
          ${f.ta ? `<textarea data-setk="${f.k}" rows="2" placeholder="${esc(f.ph)}"></textarea>`
                 : `<input data-setk="${f.k}"${f.type ? ` type="${f.type}"` : ''} placeholder="${esc(f.ph)}"${f.k === 'freeShippingAt' ? ' dir="ltr" style="text-align:left"' : ''}>`}
        </div>`).join('')}
    <button type="submit" class="btn btn-solid" style="margin-top:16px">💾 ذخیره تنظیمات و انتشار</button>
  </form>

  <form id="passForm" class="fsec" style="max-width:760px;margin-top:26px" novalidate>
    <h3 style="margin-bottom:12px;color:var(--gold2)">تغییر رمز عبور مدیر</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
      <div class="field"><label>رمز فعلی</label><input type="password" id="spCur" autocomplete="current-password"></div>
      <div class="field"><label>رمز جدید</label><input type="password" id="spNew" autocomplete="new-password"></div>
      <div class="field"><label>تکرار رمز جدید</label><input type="password" id="spNew2" autocomplete="new-password"></div>
    </div>
    <button type="submit" class="btn btn-dark" style="margin-top:14px">تغییر رمز</button>
    <p class="dim" style="font-size:11px;margin-top:10px">رمز جدید بلافاصله فعال می‌شود؛ آن را جای امنی یادداشت کنید.</p>
  </form>`;
}

function fillSettings() {
  qsa('[data-setk]').forEach(inp => {
    const v = getSet(inp.dataset.setk);
    if (v !== undefined && v !== null && v !== '') inp.value = (inp.dataset.setk === 'freeShippingAt') ? v : String(v);
  });
  const n = qs('#setNote');
  if (n) n.innerHTML = `<p class="dim" style="padding:8px 4px 16px;line-height:2">
    این تنظیمات به‌صورت سراسری برای <b>همه بازدیدکنندگان</b> اعمال می‌شود.
    ${isApi() ? 'تغییرها روی سرور و برای همیشه ذخیره می‌شوند ✦' : '⚠ در حالت دمو، تغییرها فقط روی همین مرورگر ذخیره می‌شوند؛ برای عمومی شدن، روی سرور واقعی (Render) اجرا کنید.'}
    برای بازگشت هر فیلد به مقدار اولیه، آن را خالی بگذارید.</p>`;
}

async function saveSettingsForm(e) {
  e.preventDefault();
  const body = { hero: {} };
  qsa('[data-setk]').forEach(inp => {
    const v = inp.value.trim();
    if (!v) return;                                  // خالی = بدون تغییر
    const k = inp.dataset.setk;
    if (k === 'freeShippingAt') body.freeShippingAt = Math.round(Math.abs(+v || 0));
    else if (k.startsWith('hero.')) body.hero[k.slice(5)] = v;
    else body[k] = v;
  });
  if (isApi()) {
    let r; try { r = await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify(body) }); }
    catch (err) { toast('ذخیره تنظیمات روی سرور ممکن نشد', true); return; }
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'ذخیره ممکن نشد', true); return; }
  } else {
    const cur = load('noir_settings', {}) || {};
    const merged = { ...cur, ...body, hero: { ...(cur.hero || {}), ...(body.hero || {}) } };
    save('noir_settings', merged);
  }
  applySettingOverrides(body);
  applySettings();                                   // هدر/فوتر فوراً بروزرسانی شود
  toast('✔ تنظیمات ذخیره و اعمال شد');
}

async function changeAdminPass(e) {
  e.preventDefault();
  const cur = qs('#spCur').value, nw = qs('#spNew').value, nw2 = qs('#spNew2').value;
  if (nw.length < 4) { toast('رمز جدید باید حداقل ۴ کاراکتر باشد', true); return; }
  if (nw !== nw2) { toast('تکرار رمز جدید با خودش یکی نیست', true); return; }
  if (isApi()) {
    let r; try { r = await apiFetch('/api/settings/pass', { method: 'POST', body: JSON.stringify({ current: cur, next: nw }) }); }
    catch (err) { toast('تغییر رمز ممکن نشد', true); return; }
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'رمز فعلی اشتباه است', true); return; }
  } else {
    const curPass = localStorage.getItem('noir_spass') || SETTINGS.adminPass;
    if (cur !== curPass) { toast('رمز فعلی اشتباه است', true); return; }
    localStorage.setItem('noir_spass', nw);
  }
  qs('#spCur').value = ''; qs('#spNew').value = ''; qs('#spNew2').value = '';
  toast('✔ رمز عبور تغییر کرد — از این به بعد با رمز جدید وارد شوید');
}

/* ============================== DISCOUNT CODES ============================== */
function admDiscounts() {
  return `
  <div class="adm-h"><h1>کدهای تخفیف</h1></div>
  <form id="discForm" class="fsec" style="max-width:760px;margin-bottom:22px" novalidate>
    <h3 style="margin-bottom:14px">افزودن کد جدید</h3>
    <div style="display:grid;grid-template-columns:1fr 130px auto;gap:12px;align-items:end">
      <div class="field" style="margin:0">
        <label>متن کد (انگلیسی)</label>
        <input id="dcode" placeholder="مثال: NOOR20" dir="ltr" style="text-align:left" maxlength="24" autocomplete="off">
      </div>
      <div class="field" style="margin:0">
        <label>درصد تخفیف</label>
        <input id="dpercent" type="number" min="1" max="90" placeholder="۱۰" dir="ltr" style="text-align:center">
      </div>
      <button class="btn btn-solid" type="submit" style="height:44px">+ افزودن</button>
    </div>
    <p class="dim" style="font-size:11px;margin-top:10px">کدها فوراً برای مشتری‌ها قابل استفاده‌اند. کد غیرفعال لحظه‌ای از کار می‌ایستد.</p>
  </form>
  <div id="discWrap"><p class="dim" style="padding:10px 4px">در حال بارگذاری…</p></div>`;
}

async function fetchDiscounts() {
  if (isApi()) { try { return await apiFetch('/api/discounts'); } catch (e) { return []; } }
  return discList;
}

async function fillDiscounts() {
  const w = qs('#discWrap'); if (!w) return;
  const ds = await fetchDiscounts();
  if (!isApi()) { /* در حالت استاتیک، کش محلی همان منبع است */ }
  w.innerHTML = !ds.length
    ? `<div class="empty"><h4>هنوز کدی ثبت نشده</h4><p>با فرم بالا اولین کد تخفیف را بسازید.</p></div>`
    : `<div class="otable">${ds.map(d => `
      <div class="orow" style="grid-template-columns:auto 1fr auto auto auto">
        <b dir="ltr" style="letter-spacing:1px;color:var(--gold2)">${esc(d.code)}</b>
        <span class="dim" style="font-size:12px">${faNum(d.percent)}٪ تخفیف از جمع اقلام</span>
        <button type="button" class="btn btn-ghost btn-sm" data-dtog="${esc(d.code)}">${d.active !== false ? '🟢 فعال' : '⚪ غیرفعال'}</button>
        <button type="button" class="btn btn-dark btn-sm" data-ddel="${esc(d.code)}" style="color:#d0604f">حذف</button>
        <span></span>
      </div>`).join('')}</div>`;
}

async function discToggle(code) {
  if (isApi()) {
    let r; try { r = await apiFetch('/api/discounts/' + encodeURIComponent(code), { method: 'PATCH', body: '{}' }); }
    catch (e) { toast('تغییر وضعیت ممکن نشد', true); return; }
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'تغییر وضعیت ممکن نشد', true); return; }
  } else {
    const d = discList.find(x => x.code === code);
    if (d) d.active = d.active === false ? true : false;
    save('noir_discounts', discList);
  }
  fillDiscounts();
}

async function discDelete(code) {
  if (isApi()) {
    let r; try { r = await apiFetch('/api/discounts/' + encodeURIComponent(code), { method: 'DELETE' }); }
    catch (e) { toast('حذف ممکن نشد', true); return; }
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'حذف ممکن نشد', true); return; }
  } else {
    discList = discList.filter(x => x.code !== code);
    save('noir_discounts', discList);
  }
  fillDiscounts();
  toast('کد حذف شد');
}

async function discAdd(e) {
  e.preventDefault();
  const code = (qs('#dcode').value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const percent = Math.round(Math.abs(+qs('#dpercent').value || 0));
  if (!code) { toast('متن کد را به انگلیسی وارد کنید', true); return; }
  if (!percent || percent < 1 || percent > 90) { toast('درصد باید بین ۱ تا ۹۰ باشد', true); return; }
  if (isApi()) {
    let r; try { r = await apiFetch('/api/discounts', { method: 'POST', body: JSON.stringify({ code, percent }) }); }
    catch (err) { toast('افزودن کد ممکن نشد', true); return; }
    if (!r || !r.ok) { toast(r && r.error ? r.error : 'افزودن کد ممکن نشد', true); return; }
  } else {
    if (discList.some(x => String(x.code).toUpperCase() === code)) { toast('این کد از قبل وجود دارد', true); return; }
    discList.push({ code, percent, active: true });
    save('noir_discounts', discList);
  }
  qs('#discForm').reset();
  fillDiscounts();
  toast(`✔ کد ${code} ساخته شد`);
}

/* ============================== PRODUCT FORM ============================== */
function admForm(id) {
  const p = id ? PROD(id) : null;
  if (id && !p) return `<div class="empty"><h4>محصول پیدا نشد</h4><a class="btn btn-ghost btn-sm" href="#/admin/products" style="margin-top:14px">بازگشت</a></div>`;
  const v = k => (p ? esc(String(p[k] ?? '')) : '');
  const ALL_S = ['S', 'M', 'L', 'XL', 'تک‌سایز'];
  return `
  <div class="adm-h">
    <h1>${p ? 'ویرایش محصول' : 'محصول جدید'}</h1>
    <a href="#/admin/products" class="link-more">بازگشت به لیست</a>
  </div>
  <form id="prodForm" data-edit="${id || ''}" class="fsec" style="max-width:880px" novalidate>
    <div class="adm-formgrid">
      <div>
        <div class="adm-imgbox">
          <img id="admImgPrev" src="${p ? esc(p.img) : 'coat-camel.jpg'}" alt="">
          <label class="btn btn-dark btn-sm" style="width:100%;margin-top:12px;justify-content:center">آپلود تصویر
            <input type="file" id="admImg" accept="image/*" hidden>
          </label>
          <input type="hidden" id="fimgData" value="${p ? esc(p.img) : ''}">
          <p class="dim" style="font-size:11px;margin-top:10px;line-height:1.9">تصویر به‌صورت خودکار بهینه و فشرده می‌شود${isApi() ? ' و روی سرور ذخیره می‌گردد' : ''}. اگر آپلود نکنید،${p ? ' تصویر فعلی حفظ می‌شود.' : ' یک تصویر پیش‌فرض از دسته انتخاب می‌شود.'}</p>
        </div>
      </div>
      <div class="grid2">
        <div class="field"><label>نام محصول (فارسی) *</label><input name="fname" value="${v('name')}" placeholder="مثلاً: پالتو کشمیر «میلانو»"></div>
        <div class="field"><label>نام لاتین</label><input name="fen" value="${v('en')}" placeholder="MILANO COAT" dir="ltr" style="text-align:left"></div>
        <div class="field"><label>دسته‌بندی *</label>
          <select name="fcat">${Object.keys(CATS).map(k => `<option value="${k}" ${p && p.cat === k ? 'selected' : ''}>${CATS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>برچسب</label>
          <select name="ftag">
            <option value="">بدون برچسب</option>
            ${['جدید', 'پرفروش', 'تخفیف'].map(t => `<option ${p && p.tag === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select></div>
        <div class="field"><label>قیمت (تومان) *</label><input name="fprice" value="${p ? p.price : ''}" inputmode="numeric" placeholder="14800000" dir="ltr" style="text-align:left"></div>
        <div class="field"><label>قیمت قبل از تخفیف (اختیاری)</label><input name="fold" value="${p && p.old ? p.old : ''}" inputmode="numeric" placeholder="0" dir="ltr" style="text-align:left"></div>
        <div class="field full"><label>سایزهای موجود *</label>
          <div class="chips" id="sizeChips">
            ${ALL_S.map(s => `<label class="chip"><input type="checkbox" name="fsz" value="${s}" ${p && p.sizes.includes(s) ? 'checked' : ''} hidden> ${s}</label>`).join('')}
          </div>
          <span class="err-t" id="szErr">حداقل یک سایز انتخاب کنید</span>
        </div>
      </div>
    </div>
    <div class="field" style="margin-top:22px"><label>رنگ‌های موجود</label>
      <div id="colorRows">${(p ? p.colors : [{ n: 'مشکی', c: '#171512' }]).map(c => colorRowHTML(c.n, c.c)).join('')}</div>
      <button type="button" class="btn btn-dark btn-sm" id="admAddColor" style="margin-top:8px">+ افزودن رنگ</button>
    </div>
    <div class="field" style="margin-top:20px"><label>توضیح کوتاه (متن صفحه محصول)</label><textarea name="fdesc">${v('desc')}</textarea></div>
    <div class="field" style="margin-top:16px"><label>جنس و جزئیات ساخت</label><textarea name="ffabric" style="min-height:56px">${v('fabric')}</textarea></div>
    <div class="field" style="margin-top:16px"><label>نگهداری و شستشو</label><textarea name="fcare" style="min-height:56px">${v('care')}</textarea></div>
    <div style="display:flex;gap:12px;margin-top:26px;flex-wrap:wrap">
      <button type="submit" class="btn btn-solid">${p ? 'ذخیره تغییرات' : 'انتشار محصول'}</button>
      <a href="#/admin/products" class="btn btn-ghost">انصراف</a>
      ${p ? `<a href="#/product/${p.id}" class="btn btn-dark" style="margin-inline-start:auto">↗ مشاهده در فروشگاه</a>` : ''}
    </div>
  </form>`;
}

function colorRowHTML(n, c) {
  return `<div class="color-row">
    <input name="cname" value="${esc(n || '')}" placeholder="نام رنگ (مثلاً شتری)">
    <input type="color" name="chex" value="${c || '#171512'}">
    <button type="button" class="adm-x" data-c-del aria-label="حذف">✕</button>
  </div>`;
}

/* ============================== SAVE PRODUCT ============================== */
async function saveProductForm(f) {
  const fd = new FormData(f);
  const editing = f.dataset.edit || null;
  const name = String(fd.get('fname') || '').trim();
  const num = s => { s = String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); return Number(s.replace(/[^\d]/g, '')) || 0; };
  const price = num(fd.get('fprice'));
  const sizes = fd.getAll('fsz').map(String);

  let bad = false;
  const mark = (inp, cond) => { const w = inp && inp.closest('.field'); if (w) w.classList.toggle('err', cond); if (cond) bad = true; };
  mark(qs('[name=fname]', f), !name);
  mark(qs('[name=fprice]', f), !(price > 0));
  const szErr = qs('#szErr');
  if (szErr) szErr.style.display = sizes.length ? '' : 'block';
  if (!sizes.length) bad = true;
  if (bad) { toast('موارد ستاره‌دار را کامل کنید', true); return; }

  const names = fd.getAll('cname').map(String);
  const hexes = fd.getAll('chex').map(String);
  let colors = names.map((n, i) => ({ n: n.trim(), c: hexes[i] || '#171512' })).filter(c => c.n);
  if (!colors.length) colors = [{ n: 'مشکی', c: '#171512' }];

  const cat = String(fd.get('fcat'));
  let img = qs('#fimgData').value;
  if (!img) { const same = PRODUCTS.find(x => x.cat === cat); img = same ? same.img : 'coat-camel.jpg'; }

  const prod = {
    id: editing || ('p' + Date.now().toString(36)),
    name,
    en: String(fd.get('fen') || '').trim() || 'NOIR ITEM',
    cat,
    price,
    old: Math.max(0, num(fd.get('fold'))),
    tag: String(fd.get('ftag') || ''),
    img, sizes, colors,
    desc: String(fd.get('fdesc') || '').trim(),
    fabric: String(fd.get('ffabric') || '').trim(),
    care: String(fd.get('fcare') || '').trim()
  };

  /* حفظ وضعیت مخفی در حالت ویرایش */
  const cur = editing ? PRODUCTS.find(x => x.id === editing) : null;
  if (cur) prod.hidden = !!cur.hidden;

  let ok;
  if (isApi()) {
    try {
      await apiFetch(editing ? '/api/products/' + encodeURIComponent(editing) : '/api/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(prod)
      });
      await syncAfter();
      ok = true;
    } catch (e) { ok = false; }
  } else {
    const list = PRODUCTS.map(x => ({ ...x }));
    if (editing) {
      const i = list.findIndex(x => x.id === editing);
      if (i > -1) { prod.hidden = !!list[i].hidden; list[i] = prod; }
      else list.unshift(prod);
    } else list.unshift(prod);
    ok = saveProducts(list);
  }

  toast(ok ? (editing ? '✔ تغییرات ذخیره شد' : '✔ محصول منتشر شد و در فروشگاه در دسترس است') : (isApi() ? 'ذخیره روی سرور ممکن نشد — اتصال را بررسی کنید' : 'حافظه‌ی مرورگر پر است — تصویر کوچک‌تری انتخاب کنید'), !ok);
  if (ok) location.hash = '#/admin/products';
}

/* ============================== IMAGE PIPELINE ============================== */
function processImage(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = e => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const MAX = 900;
        const sc = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
}

/* ============================== CONFIRM BOX ============================== */
let askCb = null;
function askBox(msg, okLabel, cb) {
  askCb = cb;
  const ov = document.createElement('div');
  ov.className = 'modal open'; ov.id = 'askOv';
  ov.innerHTML = `<div class="modal-card" style="max-width:420px">
    <h3>هشدار<button data-close style="color:var(--mut);font-size:16px">✕</button></h3>
    <p>${msg}</p>
    <div style="display:flex;gap:12px;margin-top:24px">
      <button id="askYes" class="btn btn-sm" style="background:var(--red);border:1px solid var(--red);color:#fff">${okLabel}</button>
      <button id="askNo" class="btn btn-ghost btn-sm">انصراف</button>
    </div></div>`;
  document.body.appendChild(ov);
  lockBody(true);
}

/* ============================== EVENTS (delegated) ============================== */
document.addEventListener('DOMContentLoaded', () => {

  document.addEventListener('click', e => {
    if (e.target.closest('#admLogout')) {
      sessionStorage.removeItem('noir_admin');
      sessionStorage.removeItem('noir_token');
      toast('از پنل خارج شدید');
      location.hash = '#/';
      return;
    }
    if (e.target.closest('#admBackup')) {
      (async () => {
        try {
          let data;
          if (isApi()) {
            const res = await fetch('/api/backup', { headers: { 'x-admin-token': sessionStorage.getItem('noir_token') || '' } });
            if (!res.ok) throw new Error();
            data = await res.json();
          } else {
            data = { products: PRODUCTS, orders: getOrders(), discounts: discList, reviews: REVIEWS };
          }
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'noir-backup-' + new Date().toISOString().slice(0, 10) + '.json';
          a.click();
          URL.revokeObjectURL(a.href);
          toast('✔ نسخه پشتیبان دانلود شد');
        } catch (err) { toast('دانلود پشتیبان ممکن نشد', true); }
      })();
      return;
    }
    if (e.target.closest('#admRestore')) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json';
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        try {
          const b = JSON.parse(await f.text());
          if (!b || !Array.isArray(b.products) || !Array.isArray(b.orders)) throw new Error();
          if (isApi()) {
            await apiFetch('/api/restore', { method: 'POST', body: JSON.stringify(b) });
            await syncAfter();
          } else {
            saveProducts(b.products);
            save('noir_orders', b.orders);
            if (Array.isArray(b.discounts)) { discList = b.discounts; save('noir_discounts', discList); }
            if (Array.isArray(b.reviews)) { REVIEWS = b.reviews; save('noir_reviews', REVIEWS); }
          }
          router();
          toast('✔ نسخه پشتیبان بازیابی شد');
        } catch (err) { toast('فایل پشتیبان معتبر نیست', true); }
      };
      inp.click();
      return;
    }
    const pr = e.target.closest('[data-print]');
    if (pr) {
      const o = ADMIN_ORDERS_CACHE.find(x => x.no === pr.dataset.print);
      if (o) printInvoice(o);
      return;
    }
    const dt = e.target.closest('[data-dtog]');
    if (dt) { discToggle(dt.dataset.dtog); return; }
    const dd = e.target.closest('[data-ddel]');
    if (dd) { askBox(`کد «${dd.dataset.ddel}» برای همیشه حذف می‌شود. ادامه می‌دهید؟`, 'حذف', () => discDelete(dd.dataset.ddel)); return; }
    if (e.target.closest('#admReset')) {
      askBox('همه‌ی تغییرات محصولات و سفارش‌ها پاک می‌شود و دیتای اولیه برمی‌گردد. ادامه می‌دهید؟', 'بازنشانی', async () => {
        if (isApi()) {
          try { await apiFetch('/api/reset', { method: 'POST', body: '{}' }); await syncAfter(); } catch (err) { }
        } else {
          saveProducts(DEFAULT_PRODUCTS.map(x => ({ ...x })));
          save('noir_orders', []);
          discList = [SETTINGS.coupon, { code: 'WELCOME15', percent: 15, active: true }];
          save('noir_discounts', discList);
          save('noir_reviews', null);
        }
        router();
        toast('دیتا به حالت اولیه بازنشانی شد');
      });
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const p = PROD(del.dataset.del);
      if (!p) return;
      askBox(`«${esc(p.name)}» برای همیشه از فروشگاه حذف می‌شود؛ بازگشتی در کار نیست.`, 'بله، حذف شود', async () => {
        if (isApi()) {
          try { await apiFetch('/api/products/' + encodeURIComponent(p.id), { method: 'DELETE' }); await syncAfter(); } catch (err) { }
        } else {
          saveProducts(PRODUCTS.filter(x => x.id !== p.id));
        }
        router();
        toast('محصول حذف شد');
      });
      return;
    }
    if (e.target.closest('#askYes')) {
      const ov = qs('#askOv'); if (ov) ov.remove();
      lockBody(false);
      if (askCb) askCb();
      askCb = null;
      return;
    }
    if (e.target.closest('#askNo')) {
      const ov = qs('#askOv'); if (ov) ov.remove();
      lockBody(false);
      askCb = null;
      return;
    }
    const exp = e.target.closest('[data-exp]');
    if (exp && !e.target.closest('select')) {
      const card = exp.closest('.o-card');
      if (card) card.classList.toggle('open');
      return;
    }
    if (e.target.closest('#admAddColor')) {
      qs('#colorRows').insertAdjacentHTML('beforeend', colorRowHTML('', '#171512'));
      return;
    }
    const cdel = e.target.closest('[data-c-del]');
    if (cdel) { const row = cdel.closest('.color-row'); if (row) row.remove(); return; }
  });

  document.addEventListener('change', e => {
    const vis = e.target.closest('[data-vis]');
    if (vis) {
      (async () => {
        const p = PRODUCTS.find(x => x.id === vis.dataset.vis);
        if (!p) return;
        if (isApi()) {
          try {
            await apiFetch('/api/products/' + encodeURIComponent(p.id), { method: 'PUT', body: JSON.stringify({ ...p, hidden: !vis.checked }) });
            await syncAfter();
          } catch (err) { }
        } else {
          const list = PRODUCTS.map(x => ({ ...x }));
          const lp = list.find(x => x.id === vis.dataset.vis);
          if (lp) { lp.hidden = !vis.checked; saveProducts(list); }
        }
        toast(vis.checked ? 'محصول در فروشگاه نمایش داده می‌شود' : 'محصول مخفی شد');
      })();
      return;
    }
    const st = e.target.closest('[data-status]');
    if (st) {
      (async () => {
        const newStatus = st.value;
        if (isApi()) {
          try {
            await apiFetch('/api/orders/' + encodeURIComponent(st.dataset.status), { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
          } catch (err) { toast('ثبت تغییر روی سرور ممکن نشد', true); return; }
        } else {
          const os = getOrders();
          const o = os.find(x => x.no === st.dataset.status);
          if (o) { o.status = newStatus; save('noir_orders', os); }
        }
        st.style.color = STATUS_COLOR[newStatus] || '';
        toast(`وضعیت سفارش به «${newStatus}» تغییر کرد`);
      })();
      return;
    }
    if (e.target.id === 'admImg' && e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!/^image\//.test(f.type)) { toast('فقط فایل تصویری قابل قبول است', true); return; }
      processImage(f).then(async d => {
        if (isApi()) {
          try {
            const r = await apiFetch('/api/upload', { method: 'POST', body: JSON.stringify({ data: d }) });
            qs('#fimgData').value = r.path;
            qs('#admImgPrev').src = d;
            toast('تصویر روی سرور بارگذاری شد — با ذخیره‌ی فرم اعمال می‌شود');
            return;
          } catch (err) {
            toast('آپلود روی سرور ممکن نشد — تصویر در حافظه نگه‌داشته می‌شود', true);
          }
        }
        qs('#fimgData').value = d;
        qs('#admImgPrev').src = d;
        toast('تصویر آماده شد — با ذخیره‌ی فرم اعمال می‌شود');
      }).catch(() => toast('خواندن تصویر ممکن نشد', true));
      return;
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'admSearch') {
      const b = qs('#admRows');
      if (b) b.innerHTML = admRowsHTML(e.target.value.trim());
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id === 'discForm') { discAdd(e); return; }
    if (e.target.id === 'setForm') { saveSettingsForm(e); return; }
    if (e.target.id === 'passForm') { changeAdminPass(e); return; }
    if (e.target.id === 'admLoginForm') {
      e.preventDefault();
      (async () => {
        const pass = qs('#admPass').value;
        if (isApi()) {
          try {
            const res = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pass })
            });
            if (!res.ok) throw new Error();
            const j = await res.json();
            sessionStorage.setItem('noir_token', j.token);
            router();
            toast('خوش آمدید! وارد پنل مدیریت شدید');
          } catch (err) {
            qs('#admPass').closest('.field').classList.add('err');
          }
        } else if (pass === (localStorage.getItem('noir_spass') || SETTINGS.adminPass)) {
          sessionStorage.setItem('noir_admin', '1');
          router();
          toast('خوش آمدید! وارد پنل مدیریت شدید');
        } else {
          qs('#admPass').closest('.field').classList.add('err');
        }
      })();
    }
    if (e.target.id === 'prodForm') {
      e.preventDefault();
      saveProductForm(e.target);
    }
  });
});
