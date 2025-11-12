// restaurant-service/server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- MongoDB (retry, tắt buffering) ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food_delivery_db';
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

async function connectMongo() {
  for (;;) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('[restaurant-service] Connected to MongoDB:', MONGO_URI);
      break;
    } catch (err) {
      console.error('[restaurant-service] Mongo connect failed, retry in 3s:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
connectMongo();

// --- Schema ---
const menuItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
});

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  menu: [menuItemSchema],
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// --- APIs ---
// 1) Tạo nhà hàng
app.post('/restaurants', async (req, res) => {
  try {
    const { name, address, menu } = req.body;
    const saved = await new Restaurant({ name, address, menu }).save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('[restaurant-service] create error:', error);
    res.status(400).json({ error: error.message });
  }
});

// 2) Lấy tất cả
app.get('/restaurants', async (_req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3) Lấy chi tiết
app.get('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4) Cập nhật
app.put('/restaurants/:id', async (req, res) => {
  try {
    const { name, address } = req.body;
    const updated = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { name, address },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5) Xoá
app.delete('/restaurants/:id', async (req, res) => {
  try {
    const deleted = await Restaurant.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Restaurant not found' });
    res.status(200).json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6) Lấy menu
app.get('/restaurants/:id/menu', async (req, res) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(r.menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7) Thêm món
app.post('/restaurants/:id/menu', async (req, res) => {
  try {
    const { itemName, price } = req.body;
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    r.menu.push({ itemName, price });
    await r.save();
    res.status(201).json(r);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 8) Sửa món
app.put('/restaurants/:id/menu/:itemId', async (req, res) => {
  try {
    const { itemName, price } = req.body;
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    const item = r.menu.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    item.itemName = itemName;
    item.price = price;
    await r.save();
    res.json(r);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 9) Xoá món
app.delete('/restaurants/:id/menu/:itemId', async (req, res) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Restaurant not found' });
    const item = r.menu.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    item.remove();
    await r.save();
    res.json(r);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health
app.get('/health', (_req, res) => {
  res.json({
    service: 'restaurant-service',
    status: 'healthy',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

const PORT = process.env.PORT || 4001;
const server = app.listen(PORT, () => {
  console.log(`✅ Restaurant Service running on port ${PORT}`);
});

// Graceful shutdown (tránh container “sập” đột ngột)
process.on('SIGTERM', async () => {
  console.log('[restaurant-service] SIGTERM received. Closing HTTP & Mongo...');
  server.close(async () => {
    try { await mongoose.connection.close(); } catch {}
    process.exit(0);
  });
});
