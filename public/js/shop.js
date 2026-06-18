'use strict';

const state = {
  products: [],
  cart: {}, // id -> qty
  filter: 'Hammasi',
};

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + ' so‘m';

function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { t.className = 'toast' + (isErr ? ' err' : ''); }, 2600);
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
    document.getElementById('statProducts').textContent = state.products.length;
    renderFilters();
    renderProducts();
  } catch (e) {
    document.getElementById('productGrid').innerHTML =
      '<p class="empty-state">Mahsulotlarni yuklab bo‘lmadi. Server ishlayotganini tekshiring.</p>';
  }
}

function renderFilters() {
  const cats = ['Hammasi', ...new Set(state.products.map((p) => p.category))];
  const box = document.getElementById('filters');
  box.innerHTML = '';
  cats.forEach((cat) => {
    const b = document.createElement('button');
    b.className = 'filter-chip' + (cat === state.filter ? ' active' : '');
    b.textContent = cat;
    b.onclick = () => { state.filter = cat; renderFilters(); renderProducts(); };
    box.appendChild(b);
  });
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const list = state.filter === 'Hammasi'
    ? state.products
    : state.products.filter((p) => p.category === state.filter);

  if (list.length === 0) {
    grid.innerHTML = '<p class="empty-state">Bu turkumda mahsulot yo‘q.</p>';
    return;
  }

  grid.innerHTML = '';
  list.forEach((p, i) => {
    const inStock = p.stock > 0;
    const card = document.createElement('article');
    card.className = 'card';
    card.style.animationDelay = (i * 0.05) + 's';
    const initial = p.name.charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="thumb" style="background:${p.color}">
        ${p.image ? `<img class="thumb-img" src="${p.image}" alt="${p.name}" loading="lazy" />` : `<span class="mono">${initial}</span>`}
        <span class="tag">${p.category}</span>
        ${p.stock > 0 && p.stock < 80 ? '<span class="low">Kam qoldi</span>' : ''}
        ${!inStock ? '<span class="low">Tugagan</span>' : ''}
      </div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="desc">${p.description || ''}</p>
        <div class="card-foot">
          <span class="price">${fmt(p.price)} <small>/ dona</small></span>
          <button class="add-btn" ${inStock ? '' : 'disabled'} data-id="${p.id}">
            ${inStock ? 'Qo‘shish' : 'Yo‘q'}
          </button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.add-btn[data-id]').forEach((btn) => {
    btn.onclick = () => addToCart(btn.dataset.id);
  });
}

function addToCart(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  const current = state.cart[id] || 0;
  if (current + 1 > product.stock) { toast('Zaxira yetarli emas', true); return; }
  state.cart[id] = current + 1;
  updateCartUI();
  toast(product.name + ' savatchaga qo‘shildi');
}

function changeQty(id, delta) {
  const product = state.products.find((p) => p.id === id);
  const next = (state.cart[id] || 0) + delta;
  if (next <= 0) { delete state.cart[id]; }
  else if (next > product.stock) { toast('Zaxira yetarli emas', true); return; }
  else { state.cart[id] = next; }
  updateCartUI();
}

function removeItem(id) { delete state.cart[id]; updateCartUI(); }

function cartTotal() {
  return Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const p = state.products.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function updateCartUI() {
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
  document.getElementById('cartCount').textContent = count;

  const body = document.getElementById('cartBody');
  const foot = document.getElementById('cartFoot');
  const ids = Object.keys(state.cart);

  if (ids.length === 0) {
    body.innerHTML = '<p class="empty-cart">Savatchangiz hozircha bo‘sh.</p>';
    foot.style.display = 'none';
    return;
  }

  body.innerHTML = '';
  ids.forEach((id) => {
    const p = state.products.find((x) => x.id === id);
    const qty = state.cart[id];
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="swatch" style="background:${p.color}">${p.image ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:3px" />` : ''}</div>
      <div class="info">
        <h4>${p.name}</h4>
        <div class="p">${fmt(p.price)} × ${qty}</div>
        <button class="remove" data-rm="${id}">O‘chirish</button>
      </div>
      <div class="qty">
        <button data-dec="${id}">−</button>
        <span>${qty}</span>
        <button data-inc="${id}">+</button>
      </div>`;
    body.appendChild(row);
  });

  body.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => changeQty(b.dataset.inc, 1));
  body.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => changeQty(b.dataset.dec, -1));
  body.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => removeItem(b.dataset.rm));

  document.getElementById('cartTotal').textContent = fmt(cartTotal());
  foot.style.display = 'block';
}

async function checkout() {
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const company = document.getElementById('custCompany').value.trim();
  if (!name || !phone) { toast('Ism va telefonni kiriting', true); return; }

  const items = Object.entries(state.cart).map(([id, qty]) => ({ id, qty }));
  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true; btn.textContent = 'Yuborilmoqda…';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: { name, phone, company }, items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Xatolik');

    toast('Buyurtma qabul qilindi: ' + data.id);
    state.cart = {};
    document.getElementById('custName').value = '';
    document.getElementById('custPhone').value = '';
    document.getElementById('custCompany').value = '';
    await loadProducts();
    updateCartUI();
    closeDrawer();
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Buyurtmani rasmiylashtirish';
  }
}

function openDrawer() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

document.getElementById('openCart').onclick = openDrawer;
document.getElementById('closeCart').onclick = closeDrawer;
document.getElementById('drawerOverlay').onclick = closeDrawer;
document.getElementById('checkoutBtn').onclick = checkout;

loadProducts();
updateCartUI();
