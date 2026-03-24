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

  let isAuthenticated = false;
  let zaloApi = null;
  const zaloService = new ZaloService(null);

  app.get('/api/auth-status', (req, res) => {
    res.json({ isAuthenticated });
  });

  const zalo = new Zalo({
    selfListen: true,
    checkUpdate: true
  });

  const messageController = messageControllerFactory(zaloService, messageStore);
  const messageRoutes = messageRoutesFactory(messageController);
  app.use('/api', messageRoutes);

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

  try {
    console.log("Logging into Zalo...");

    if (fs.existsSync(SESSION_FILE)) {
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        try {
            zaloApi = await zalo.login({
                cookie: sessionData.cookie,
                imei: sessionData.imei,
                userAgent
            });
            isAuthenticated = true;
            console.log("Logged in successfully using saved session!");
        } catch (e) {
            console.error("Session login failed, falling back to QR:", e.message);
        }
    }

    if (!isAuthenticated) {
        zaloApi = await zalo.loginQR({ userAgent }, (event) => {
            if (event.type === "GotLoginInfo") {
                fs.writeFileSync(SESSION_FILE, JSON.stringify(event.data));
                console.log("Session saved.");
            }
        });
        isAuthenticated = true;
        console.log("Logged in successfully via QR!");
    }

    if (zaloApi) {
        zaloService.client = zaloApi;
        setupWebhook({ client: zaloApi }, messageStore);
    }
  } catch (error) {
    console.error("Failed to start Zalo client:", error);
  }
}

start();
