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

const SESSION_DIR = path.join(__dirname, '../sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');
const QR_FILE = path.join(SESSION_DIR, 'qr.png');

async function start() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(bodyParser.json());
  app.use(express.static(path.join(__dirname, '../dashboard')));

  app.get('/qr.png', (req, res) => {
    if (fs.existsSync(QR_FILE)) {
      res.sendFile(QR_FILE);
    } else {
      res.status(404).send('QR code not found');
    }
  });

  let isAuthenticated = false;
  let qrActions = null;
  let zaloApi = null;
  const zaloService = new ZaloService(null, SESSION_FILE);

  app.get('/api/auth-status', (req, res) => {
    // If not authenticated and QR file is missing but we have actions, re-generate it
    if (!isAuthenticated && !fs.existsSync(QR_FILE) && qrActions) {
        console.log("QR file missing during status check, re-generating...");
        qrActions.retry();
    }
    res.json({ isAuthenticated });
  });

  app.post('/api/refresh-qr', (req, res) => {
    if (isAuthenticated) return res.json({ success: false, message: "Already authenticated" });
    if (qrActions) {
        console.log("Manual QR refresh requested.");
        qrActions.retry();
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Login not in progress" });
    }
  });

  const messageController = messageControllerFactory(zaloService, messageStore);
  const messageRoutes = messageRoutesFactory(messageController);
  app.use('/api', messageRoutes);

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

  async function loginProcess() {
    const zalo = new Zalo({ selfListen: true, checkUpdate: true });

    if (fs.existsSync(SESSION_FILE)) {
        console.log("Found session file, attempting to resume...");
        try {
            const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            zaloApi = await zalo.login({
                cookie: sessionData.cookie,
                imei: sessionData.imei,
                userAgent: sessionData.userAgent || defaultUserAgent
            });
            isAuthenticated = true;
            console.log("Logged in successfully using saved session!");
            if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE);
            qrActions = null;
        } catch (e) {
            console.error("Session login failed:", e.message);
        }
    }

    if (!isAuthenticated) {
        console.log("Starting QR login...");
        try {
            zaloApi = await zalo.loginQR({ userAgent: defaultUserAgent, qrPath: QR_FILE }, (event) => {
                if (event.actions) {
                    qrActions = event.actions;
                }

                if (event.type === 0) { // QRCodeGenerated
                    console.log("QR Code generated, saving to file...");
                    event.actions.saveToFile();
                }

                if (event.type === 4) { // GotLoginInfo
                    try {
                        fs.writeFileSync(SESSION_FILE, JSON.stringify(event.data));
                        console.log("Session saved to disk.");
                    } catch (err) {
                        console.error("Failed to save session:", err.message);
                    }
                }
            });
            isAuthenticated = true;
            console.log("Logged in successfully via QR!");
            if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE);
            qrActions = null;
        } catch (error) {
            console.error("QR login failed:", error.message);
            qrActions = null;
            setTimeout(loginProcess, 5000);
            return;
        }
    }

    if (zaloApi) {
        zaloService.client = zaloApi;
        setupWebhook({ client: zaloApi }, messageStore);
    }
  }

  loginProcess();
}

start();
