'use strict';

let token = sessionStorage.getItem('atlas_token') || '';

const fmt = (n) => new Intl.NumberFormat('uz-UZ').format(n) + ' so‘m';

function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { t.className = 'toast' + (isErr ? ' err' : ''); }, 2600);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) { logout(); throw new Error('Sessiya tugadi'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
  return data;
}

// ---------------- Auth ----------------
async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Tekshirilmoqda…';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kirish amalga oshmadi');
    token = data.token;
    sessionStorage.setItem('atlas_token', token);
    showAdmin();
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Kirish';
  }
}

function logout() {
  token = '';
  sessionStorage.removeItem('atlas_token');
  document.getElementById('adminView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
}

function showAdmin() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'flex';
  loadDashboard();
  loadProducts();
  loadOrders();
}

// ---------------- Dashboard ----------------
async function loadDashboard() {
  try {
    const s = await api('/api/admin/stats');
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="lbl">Mahsulotlar</div><div class="val">${s.productCount}</div></div>
      <div class="stat-card"><div class="lbl">Buyurtmalar</div><div class="val">${s.orderCount}</div></div>
      <div class="stat-card accent"><div class="lbl">Umumiy tushum</div><div class="val">${new Intl.NumberFormat('uz-UZ').format(s.revenue)}</div></div>
      <div class="stat-card"><div class="lbl">Kam zaxira</div><div class="val">${s.lowStock}</div></div>`;

    const orders = await api('/api/admin/orders');
    const tb = document.getElementById('recentOrders');
    if (orders.length === 0) {
      tb.innerHTML = '<tr><td colspan="4" style="color:var(--ink-soft)">Hozircha buyurtma yo‘q.</td></tr>';
    } else {
      tb.innerHTML = orders.slice(0, 5).map((o) => `
        <tr><td><strong>${o.id}</strong></td><td>${o.customer.name}</td>
        <td>${fmt(o.total)}</td><td><span class="badge new">${o.status}</span></td></tr>`).join('');
    }
  } catch (e) { /* logout handled */ }
}

// ---------------- Products ----------------
async function loadProducts() {
  try {
    const products = await api('/api/products');
    const tb = document.getElementById('productsTable');
    if (products.length === 0) {
      tb.innerHTML = '<tr><td colspan="6" style="color:var(--ink-soft)">Mahsulot yo‘q.</td></tr>';
      return;
    }
    tb.innerHTML = products.map((p) => `
      <tr>
        <td>${p.image ? `<img src="${p.image}" alt="${p.name}" class="admin-thumb" />` : `<span class="swatch-sm" style="background:${p.color}"></span>`}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category}</td>
        <td>${fmt(p.price)}</td>
        <td>${p.stock} ${p.stock < 80 ? '<span class="badge low">kam</span>' : ''}</td>
        <td>
          <button class="icon-btn" data-edit="${p.id}">Tahrirlash</button>
          <button class="icon-btn danger" data-del="${p.id}">O‘chirish</button>
        </td>
      </tr>`).join('');

    tb.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openEdit(b.dataset.edit, products));
    tb.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => deleteProduct(b.dataset.del));
  } catch (e) { /* */ }
}

function openModal() { document.getElementById('productModal').classList.add('open'); }
function closeModal() { document.getElementById('productModal').classList.remove('open'); }

function openAdd() {
  document.getElementById('modalTitle').textContent = 'Yangi mahsulot';
  document.getElementById('editId').value = '';
  document.getElementById('pName').value = '';
  document.getElementById('pCategory').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pStock').value = '';
  document.getElementById('pColor').value = '#C75B39';
  document.getElementById('pDesc').value = '';
  openModal();
}

function openEdit(id, products) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  document.getElementById('modalTitle').textContent = 'Mahsulotni tahrirlash';
  document.getElementById('editId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pCategory').value = p.category;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pColor').value = p.color;
  document.getElementById('pDesc').value = p.description || '';
  openModal();
}

async function saveProduct() {
  const id = document.getElementById('editId').value;
  const body = {
    name: document.getElementById('pName').value.trim(),
    category: document.getElementById('pCategory').value.trim(),
    price: document.getElementById('pPrice').value,
    stock: document.getElementById('pStock').value,
    color: document.getElementById('pColor').value.trim(),
    description: document.getElementById('pDesc').value.trim(),
  };
  if (!body.name) { toast('Nom kiriting', true); return; }
  try {
    if (id) {
      await api('/api/admin/products/' + id, { method: 'PUT', body: JSON.stringify(body) });
      toast('Mahsulot yangilandi');
    } else {
      await api('/api/admin/products', { method: 'POST', body: JSON.stringify(body) });
      toast('Mahsulot qo‘shildi');
    }
    closeModal();
    loadProducts();
    loadDashboard();
  } catch (e) { toast(e.message, true); }
}

async function deleteProduct(id) {
  if (!confirm('Ushbu mahsulotni o‘chirishni tasdiqlaysizmi?')) return;
  try {
    await api('/api/admin/products/' + id, { method: 'DELETE' });
    toast('Mahsulot o‘chirildi');
    loadProducts();
    loadDashboard();
  } catch (e) { toast(e.message, true); }
}

// ---------------- Orders ----------------
const STATUSES = ['Yangi', 'Tayyorlanmoqda', 'Yetkazildi', 'Bekor qilindi'];

async function loadOrders() {
  try {
    const orders = await api('/api/admin/orders');
    const tb = document.getElementById('ordersTable');
    if (orders.length === 0) {
      tb.innerHTML = '<tr><td colspan="5" style="color:var(--ink-soft)">Hozircha buyurtma yo‘q.</td></tr>';
      return;
    }
    tb.innerHTML = orders.map((o) => {
      const itemsText = o.items.map((i) => `${i.name} ×${i.qty}`).join(', ');
      const opts = STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('');
      return `
        <tr>
          <td><strong>${o.id}</strong></td>
          <td>${o.customer.name}<br><span style="color:var(--ink-soft);font-size:0.8rem">${o.customer.phone}</span></td>
          <td style="max-width:240px">${itemsText}</td>
          <td>${fmt(o.total)}</td>
          <td><select class="icon-btn" data-order="${o.id}">${opts}</select></td>
        </tr>`;
    }).join('');

    tb.querySelectorAll('[data-order]').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await api('/api/admin/orders/' + sel.dataset.order + '/status', {
            method: 'PUT', body: JSON.stringify({ status: sel.value }),
          });
          toast('Holat yangilandi');
          loadDashboard();
        } catch (e) { toast(e.message, true); }
      };
    });
  } catch (e) { /* */ }
}

// ---------------- Tabs ----------------
document.querySelectorAll('.side-link[data-tab]').forEach((link) => {
  link.onclick = () => {
    document.querySelectorAll('.side-link[data-tab]').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('tab-' + link.dataset.tab).classList.add('active');
  };
});

document.getElementById('loginBtn').onclick = login;
document.getElementById('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('addProductBtn').onclick = openAdd;
document.getElementById('cancelModal').onclick = closeModal;
document.getElementById('saveProduct').onclick = saveProduct;
document.getElementById('productModal').onclick = (e) => { if (e.target.id === 'productModal') closeModal(); };

// Avtomatik kirish (agar token saqlangan bo'lsa)
if (token) { showAdmin(); }
