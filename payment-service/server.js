// payment-service/server.js
const amqp = require('amqplib');

const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://rabbitmq:5672';
let channel;

async function connectRabbitMQ() {
  for (;;) {
    try {
      const connection = await amqp.connect(RABBITMQ_URI);
      channel = await connection.createChannel();
      channel.prefetch(1);

      await channel.assertQueue('ORDER_CREATED', { durable: true });
      await channel.assertQueue('PAYMENT_SUCCESSFUL', { durable: true });

      console.log('Payment Service connected to RabbitMQ');
      consumeOrders();

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

function consumeOrders() {
  channel.consume(
    'ORDER_CREATED',
    (msg) => {
      if (!msg) return;
      const order = JSON.parse(msg.content.toString());
      console.log(`Received order ${order._id} for processing payment...`);

      // Giả lập xử lý thanh toán 5 giây
      setTimeout(() => {
        console.log(`Payment successful for order ${order._id}`);
        channel.sendToQueue('PAYMENT_SUCCESSFUL', Buffer.from(JSON.stringify({ orderId: order._id })), {
          persistent: true,
        });
        channel.ack(msg);
      }, 5000);
    },
    { noAck: false }
  );
}

connectRabbitMQ();
console.log('Payment Service (Worker) is running...');
