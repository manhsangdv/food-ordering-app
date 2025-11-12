const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const amqp = require('amqplib'); // RabbitMQ

const app = express();
app.use(bodyParser.json());

// --- Kết nối DB & RabbitMQ ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/food_delivery_db';
const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost:5672';

mongoose.connect(MONGO_URI)
    .then(() => console.log('Order Service connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

let channel; // Kênh RabbitMQ
async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URI);
        channel = await connection.createChannel();
        // Đảm bảo các queue tồn tại
        await channel.assertQueue('ORDER_CREATED', { durable: true });
        await channel.assertQueue('PAYMENT_SUCCESSFUL', { durable: true });
        await channel.assertQueue('DELIVERY_IN_PROGRESS', { durable: true });
        await channel.assertQueue('DELIVERY_COMPLETED', { durable: true });
        
        console.log('Order Service connected to RabbitMQ');
        
        // Bắt đầu lắng nghe
        consumePaymentEvents();
        consumeDeliveryEvents();
    } catch (err) {
        console.error('Failed to connect to RabbitMQ', err);
        setTimeout(connectRabbitMQ, 5000);
    }
}
connectRabbitMQ();

// --- Định nghĩa Order Schema ---
const orderSchema = new mongoose.Schema({
    // Chúng ta sẽ dùng userId (String) thay vì join
    userId: { type: String, required: true, index: true }, 
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
    items: [{
        itemName: String,
        quantity: Number
    }],
    totalPrice: Number,
    status: { type: String, default: 'PENDING' }, // PENDING, CONFIRMED, OUT_FOR_DELIVERY, DELIVERED
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// --- APIs cho Đơn hàng (Order) ---

// 1. Tạo đơn hàng mới
app.post('/orders', async (req, res) => {
    try {
        const { userId, restaurantId, items, totalPrice } = req.body;
        
        const newOrder = new Order({
            userId,
            restaurantId,
            items,
            totalPrice,
            status: 'PENDING'
        });
        
        await newOrder.save();
        
        // Gửi message đến RabbitMQ
        channel.sendToQueue('ORDER_CREATED', Buffer.from(JSON.stringify(newOrder)));
        
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 2. Lấy tất cả đơn hàng (cho Admin)
app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }); // Sắp xếp mới nhất
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Lấy chi tiết 1 đơn hàng (để theo dõi)
app.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Lấy tất cả đơn hàng của 1 user
app.get('/users/:userId/orders', async (req, res) => {
    try {
        const userOrders = await Order.find({ userId: req.params.userId })
                                     .sort({ createdAt: -1 });
        
        if (!userOrders) return res.status(404).json({ error: 'No orders found for this user' });
        
        res.json(userOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'order-service', status: 'healthy', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', rabbitmq: channel ? 'connected' : 'disconnected' });
});

// --- Các hàm lắng nghe RabbitMQ (Giữ nguyên) ---

function consumePaymentEvents() {
    channel.consume('PAYMENT_SUCCESSFUL', async (msg) => {
        if (msg === null) return;
        const { orderId } = JSON.parse(msg.content.toString());
        await Order.findByIdAndUpdate(orderId, { status: 'CONFIRM' });
        console.log(`Order ${orderId} status updated to CONFIRMED`);
        channel.ack(msg);
    });
}

function consumeDeliveryEvents() {
    channel.consume('DELIVERY_IN_PROGRESS', async (msg) => {
        if (msg === null) return;
        const { orderId, status } = JSON.parse(msg.content.toString());
        await Order.findByIdAndUpdate(orderId, { status: status }); // 'OUT_FOR_DELIVERY'
        console.log(`Order ${orderId} status updated to ${status}`);
        channel.ack(msg);
    });

    channel.consume('DELIVERY_COMPLETED', async (msg) => {
        if (msg === null) return;
        const { orderId, status } = JSON.parse(msg.content.toString());
        await Order.findByIdAndUpdate(orderId, { status: status }); // 'DELIVERED'
        console.log(`Order ${orderId} status updated to ${status}`);
        channel.ack(msg);
    });
}

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
    console.log(`✅ Order Service running on port ${PORT}`);
});