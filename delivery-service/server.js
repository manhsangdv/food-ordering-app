// delivery-service/server.js
const amqp = require('amqplib');
const express = require('express');

const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://rabbitmq:5672';
const PORT = process.env.PORT || 4004;

let channel;

const app = express();
app.get('/health', (_req, res) => {
  res.json({ service: 'delivery-service', status: 'healthy', rabbitMQ: channel ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => {
  console.log(`Delivery Service (HTTP Health Check) running on port ${PORT}`);
  connectRabbitMQ();
});

async function connectRabbitMQ() {
  for (;;) {
    try {
      const connection = await amqp.connect(RABBITMQ_URI);
      channel = await connection.createChannel();
      channel.prefetch(1);

      console.log('Delivery Service connected to RabbitMQ');

      await channel.assertQueue('PAYMENT_SUCCESSFUL', { durable: true });
      await channel.assertQueue('DELIVERY_IN_PROGRESS', { durable: true });
      await channel.assertQueue('DELIVERY_COMPLETED', { durable: true });

      startWorker();

      process.on('SIGINT', async () => {
        try { await channel.close(); await connection.close(); } catch {}
        process.exit(0);
      });
      break;
    } catch (err) {
      console.error('Failed to connect to RabbitMQ, retry in 5s:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

function startWorker() {
  channel.consume(
    'PAYMENT_SUCCESSFUL',
    (msg) => {
      if (!msg) return;
      try {
        const { orderId } = JSON.parse(msg.content.toString());
        console.log(`[Delivery] Received job for order: ${orderId}`);
        channel.ack(msg);
        simulateDelivery(orderId);
      } catch (err) {
        console.error('Error processing delivery message', err);
        // (tuỳ chọn) đưa vào dead-letter queue
      }
    },
    { noAck: false }
  );
}

function simulateDelivery(orderId) {
  setTimeout(() => {
    const statusUpdate = { orderId, status: 'OUT_FOR_DELIVERY', timestamp: new Date() };
    console.log(`[Delivery] Driver found for ${orderId}. Status: OUT_FOR_DELIVERY`);
    channel.sendToQueue('DELIVERY_IN_PROGRESS', Buffer.from(JSON.stringify(statusUpdate)), { persistent: true });
  }, 3000);

  setTimeout(() => {
    const statusUpdate = { orderId, status: 'DELIVERED', timestamp: new Date() };
    console.log(`[Delivery] Order ${orderId} has been delivered. Status: DELIVERED`);
    channel.sendToQueue('DELIVERY_COMPLETED', Buffer.from(JSON.stringify(statusUpdate)), { persistent: true });
  }, 13000);
}
