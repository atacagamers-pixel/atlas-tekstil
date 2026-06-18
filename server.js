'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./data/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin hisob ma'lumotlari va token siri muhit o'zgaruvchilaridan olinadi.
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'change-this-secret-in-production';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------------------
// Salomatlik tekshiruvi (AWS Load Balancer / ECS health check uchun)
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'atlas-tekstil-shop',
    host: process.env.HOSTNAME || 'local',
    time: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// Stateless token (HMAC) — qo'shimcha kutubxonasiz, ko'p instansiyada ham ishlaydi
// ----------------------------------------------------------------------------
function createToken() {
  const payload = JSON.stringify({ role: 'admin', iat: Date.now() });
  const data = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifyToken(token) {
  if (!token || token.indexOf('.') === -1) return false;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  // Doimiy vaqtli taqqoslash
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    // Token 8 soatdan keyin eskiradi
    if (Date.now() - payload.iat > 8 * 60 * 60 * 1000) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Ruxsat yo‘q. Tizimga qayta kiring.' });
  }
  next();
}

// ----------------------------------------------------------------------------
// Ommaviy API (do'kon)
// ----------------------------------------------------------------------------
app.get('/api/products', (req, res) => {
  res.json(db.getProducts());
});

app.get('/api/products/:id', (req, res) => {
  const product = db.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  res.json(product);
});

app.post('/api/orders', (req, res) => {
  const { customer, items } = req.body || {};
  if (!customer || !customer.name || !customer.phone) {
    return res.status(400).json({ error: 'Mijoz ismi va telefon raqami talab qilinadi' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Savatcha bo‘sh' });
  }

  // Narx va zaxirani serverda qayta tekshiramiz (mijozga ishonmaymiz)
  let total = 0;
  const verifiedItems = [];
  for (const item of items) {
    const product = db.getProduct(item.id);
    if (!product) {
      return res.status(400).json({ error: 'Mahsulot mavjud emas: ' + item.id });
    }
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    if (qty > product.stock) {
      return res.status(400).json({ error: product.name + ' uchun zaxira yetarli emas' });
    }
    total += product.price * qty;
    verifiedItems.push({ id: product.id, name: product.name, price: product.price, qty });
  }

  // Zaxirani kamaytiramiz
  for (const item of verifiedItems) {
    const product = db.getProduct(item.id);
    db.updateProduct(item.id, { stock: product.stock - item.qty });
  }

  const order = db.addOrder({
    customer: { name: customer.name, phone: customer.phone, company: customer.company || '' },
    items: verifiedItems,
    total,
  });

  res.status(201).json(order);
});

// ----------------------------------------------------------------------------
// Admin API
// ----------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ token: createToken() });
  }
  res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const products = db.getProducts();
  const orders = db.getOrders();
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const lowStock = products.filter((p) => p.stock < 80).length;
  res.json({
    productCount: products.length,
    orderCount: orders.length,
    revenue,
    lowStock,
  });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Mahsulot nomi talab qilinadi' });
  const product = db.addProduct(req.body);
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const updated = db.updateProduct(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  res.json(updated);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const ok = db.deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Mahsulot topilmadi' });
  res.json({ success: true });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json(db.getOrders());
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const updated = db.updateOrderStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Buyurtma topilmadi' });
  res.json(updated);
});

// ----------------------------------------------------------------------------
// Frontend marshrutlari
// ----------------------------------------------------------------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Atlas Tekstil do‘koni ${PORT}-portda ishga tushdi`);
  console.log(`Do‘kon:  http://localhost:${PORT}/`);
  console.log(`Admin:   http://localhost:${PORT}/admin`);
});
