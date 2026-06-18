'use strict';

/*
 * Oddiy fayl asosidagi ma'lumotlar ombori.
 * Eslatma: bu demo uchun yetarli. Production / ko'p instansiyali (auto-scaling)
 * muhitda umumiy holatni saqlash uchun Amazon RDS yoki DynamoDB ishlatish tavsiya etiladi
 * (README dagi "Yaxshilanishlar" bo'limiga qarang).
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  // Atomik yozish: avval vaqtinchalik faylga, keyin almashtirish
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

// ---------- Products ----------
function getProducts() {
  return readJson(PRODUCTS_FILE, []);
}

function getProduct(id) {
  return getProducts().find((p) => p.id === id) || null;
}

function saveProducts(products) {
  writeJson(PRODUCTS_FILE, products);
}

function addProduct(product) {
  const products = getProducts();
  const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const newProduct = {
    id,
    name: product.name,
    category: product.category || 'Boshqa',
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    color: product.color || '#C75B39',
    description: product.description || '',
    createdAt: new Date().toISOString(),
  };
  products.push(newProduct);
  saveProducts(products);
  return newProduct;
}

function updateProduct(id, patch) {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const current = products[idx];
  products[idx] = {
    ...current,
    name: patch.name !== undefined ? patch.name : current.name,
    category: patch.category !== undefined ? patch.category : current.category,
    price: patch.price !== undefined ? Number(patch.price) : current.price,
    stock: patch.stock !== undefined ? Number(patch.stock) : current.stock,
    color: patch.color !== undefined ? patch.color : current.color,
    description: patch.description !== undefined ? patch.description : current.description,
  };
  saveProducts(products);
  return products[idx];
}

function deleteProduct(id) {
  const products = getProducts();
  const next = products.filter((p) => p.id !== id);
  if (next.length === products.length) return false;
  saveProducts(next);
  return true;
}

// ---------- Orders ----------
function getOrders() {
  return readJson(ORDERS_FILE, []);
}

function addOrder(order) {
  const orders = getOrders();
  const id = 'ORD-' + Date.now().toString(36).toUpperCase();
  const newOrder = {
    id,
    customer: order.customer,
    items: order.items,
    total: order.total,
    status: 'Yangi',
    createdAt: new Date().toISOString(),
  };
  orders.unshift(newOrder);
  writeJson(ORDERS_FILE, orders);
  return newOrder;
}

function updateOrderStatus(id, status) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx].status = status;
  writeJson(ORDERS_FILE, orders);
  return orders[idx];
}

module.exports = {
  getProducts,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  addOrder,
  updateOrderStatus,
};
