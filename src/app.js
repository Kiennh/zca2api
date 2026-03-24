const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Zalo } = require('zca-js');

const messageStore = require('./storage/message.store');
const ZaloService = require('./services/zalo.service');
const setupWebhook = require('./webhooks/zalo.webhook');
const messageControllerFactory = require('./controllers/message.controller');
const messageRoutesFactory = require('./routes/message.routes');

async function start() {
  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(bodyParser.json());
  app.use(express.static(path.join(__dirname, '../dashboard')));

  app.get('/qr.png', (req, res) => {
    res.sendFile(path.join(__dirname, '../qr.png'));
  });

  const zalo = new Zalo({
    selfListen: true,
    checkUpdate: true
  });

  const zaloService = new ZaloService(zalo);
  // We can't setup webhook yet because zalo.client might not be ready until login
  // But we can define the API routes

  const messageController = messageControllerFactory(zaloService, messageStore);
  const messageRoutes = messageRoutesFactory(messageController);

  app.use('/api', messageRoutes);

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Access the dashboard at http://localhost:${port} to scan the QR code.`);
  });

  try {
    console.log("Logging into Zalo...");
    await zalo.loginQR();
    console.log("Logged in successfully!");

    // Setup webhook after successful login
    setupWebhook(zalo, messageStore);
  } catch (error) {
    console.error("Failed to start Zalo client:", error);
  }
}

start();
