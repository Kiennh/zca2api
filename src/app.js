const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Zalo } = require('zca-js');

const messageStore = require('./storage/message.store');
const ZaloService = require('./services/zalo.service');
const setupWebhook = require('./webhooks/zalo.webhook');
const messageControllerFactory = require('./controllers/message.controller');
const messageRoutesFactory = require('./routes/message.routes');

const SESSION_FILE = path.join(__dirname, '../sessions/session.json');

async function start() {
  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(bodyParser.json());
  app.use(express.static(path.join(__dirname, '../dashboard')));

  app.get('/qr.png', (req, res) => {
    const qrPath = path.join(__dirname, '../qr.png');
    if (fs.existsSync(qrPath)) {
      res.sendFile(qrPath);
    } else {
      res.status(404).send('QR code not found');
    }
  });

  // Simple endpoint to check authentication status
  let isAuthenticated = false;
  app.get('/api/auth-status', (req, res) => {
    res.json({ isAuthenticated });
  });

  const zaloConfig = {
    selfListen: true,
    checkUpdate: true
  };

  // Try to load session
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      zaloConfig.cookie = sessionData.cookie;
      zaloConfig.imei = sessionData.imei;
      console.log("Found existing session, attempting to resume...");
    } catch (e) {
      console.error("Failed to parse session file:", e);
    }
  }

  const zalo = new Zalo(zaloConfig);
  const zaloService = new ZaloService(zalo);

  const messageController = messageControllerFactory(zaloService, messageStore);
  const messageRoutes = messageRoutesFactory(messageController);

  app.use('/api', messageRoutes);

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  try {
    console.log("Logging into Zalo...");
    if (zaloConfig.cookie) {
        await zalo.login();
    } else {
        await zalo.loginQR();
    }

    isAuthenticated = true;
    console.log("Logged in successfully!");

    // Save session
    const session = zalo.getCookie();
    const imei = zalo.getImei();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookie: session, imei: imei }));
    console.log("Session saved.");

    setupWebhook(zalo, messageStore);
  } catch (error) {
    console.error("Failed to start Zalo client:", error);
    // If login fails with cookie, retry with QR
    if (zaloConfig.cookie) {
        console.log("Session might be expired, retrying with QR login...");
        try {
            const zaloNew = new Zalo({ selfListen: true, checkUpdate: true });
            await zaloNew.loginQR();
            isAuthenticated = true;
            const session = zaloNew.getCookie();
            const imei = zaloNew.getImei();
            fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookie: session, imei: imei }));
            setupWebhook(zaloNew, messageStore);
        } catch (e) {
            console.error("QR login retry failed:", e);
        }
    }
  }
}

start();
