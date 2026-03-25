const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger-config');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Zalo } = require('zca-js');

const MessageStore = require('./storage/message.store');
const ConfigStore = require('./storage/config.store');
const ZaloService = require('./services/zalo.service');
const setupWebhook = require('./webhooks/zalo.webhook');
const messageControllerFactory = require('./controllers/message.controller');
const messageRoutesFactory = require('./routes/message.routes');

const ACCOUNTS_DIR = path.join(__dirname, '../sessions/accounts');
const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

const accounts = new Map();

async function start() {
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  }

  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(bodyParser.json());
  app.use(express.static(path.join(__dirname, '../dashboard')));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  async function createAccount(accountId) {
    if (accounts.has(accountId)) return accounts.get(accountId);

    const accountDir = path.join(ACCOUNTS_DIR, accountId);
    if (!fs.existsSync(accountDir)) {
      fs.mkdirSync(accountDir, { recursive: true });
    }

    const sessionFile = path.join(accountDir, 'session.json');
    const configFile = path.join(accountDir, 'config.json');
    const messagesFile = path.join(accountDir, 'messages.json');
    const qrFile = path.join(accountDir, 'qr.png');

    const configStore = new ConfigStore(configFile);
    const messageStore = new MessageStore(messagesFile);
    const zaloService = new ZaloService(null, sessionFile);

    const account = {
      accountId,
      accountDir,
      sessionFile,
      configFile,
      messagesFile,
      qrFile,
      configStore,
      messageStore,
      zaloService,
      isAuthenticated: false,
      qrActions: null,
      zaloApi: null,
      isResetting: false,
    };

    accounts.set(accountId, account);

    const controller = messageControllerFactory(zaloService, messageStore, configStore);
    account.controller = controller;

    return account;
  }

  async function loginProcess(accountId) {
    const account = accounts.get(accountId);
    if (!account) return;

    const zalo = new Zalo({ selfListen: true, checkUpdate: true });

    if (fs.existsSync(account.sessionFile)) {
      console.log(`[${accountId}] Found session file, attempting to resume...`);
      try {
        const sessionData = JSON.parse(fs.readFileSync(account.sessionFile, 'utf8'));
        account.zaloApi = await zalo.login({
          cookie: sessionData.cookie,
          imei: sessionData.imei,
          userAgent: sessionData.userAgent || defaultUserAgent
        });
        account.isAuthenticated = true;
        console.log(`[${accountId}] Logged in successfully using saved session!`);
        if (fs.existsSync(account.qrFile)) fs.unlinkSync(account.qrFile);
        account.qrActions = null;
      } catch (e) {
        console.error(`[${accountId}] Session login failed:`, e.message);
      }
    }

    if (!account.isAuthenticated) {
      console.log(`[${accountId}] Starting QR login...`);
      try {
        account.zaloApi = await zalo.loginQR({ userAgent: defaultUserAgent, qrPath: account.qrFile }, (event) => {
          if (event.actions) {
            account.qrActions = event.actions;
          }

          if (event.type === 0) { // QRCodeGenerated
            console.log(`[${accountId}] QR Code generated, saving to file...`);
            event.actions.saveToFile();
          }

          if (event.type === 4) { // GotLoginInfo
            try {
              fs.writeFileSync(account.sessionFile, JSON.stringify(event.data));
              console.log(`[${accountId}] Session saved to disk.`);
            } catch (err) {
              console.error(`[${accountId}] Failed to save session:`, err.message);
            }
          }
        });
        account.isAuthenticated = true;
        console.log(`[${accountId}] Logged in successfully via QR!`);
        if (fs.existsSync(account.qrFile)) fs.unlinkSync(account.qrFile);
        account.qrActions = null;
      } catch (error) {
        console.error(`[${accountId}] QR login failed:`, error.message);
        account.qrActions = null;
        setTimeout(() => loginProcess(accountId), 5000);
        return;
      }
    }

    if (account.zaloApi) {
      account.zaloService.client = account.zaloApi;
      setupWebhook(accountId, account.zaloService, account.messageStore, account.configStore, () => resetSession(accountId));
    }
  }

  async function resetSession(accountId) {
    const account = accounts.get(accountId);
    if (!account || account.isResetting) return;
    account.isResetting = true;
    console.log(`!!! [${accountId}] Resetting session due to listener failure...`);

    account.isAuthenticated = false;
    account.zaloService.isListening = false;
    account.zaloService.client = null;
    account.qrActions = null;

    if (fs.existsSync(account.sessionFile)) {
      try {
        fs.unlinkSync(account.sessionFile);
        console.log(`[${accountId}] Session file deleted.`);
      } catch (err) {
        console.error(`[${accountId}] Failed to delete session file:`, err.message);
      }
    }

    if (fs.existsSync(account.qrFile)) {
      try {
        fs.unlinkSync(account.qrFile);
      } catch (err) {}
    }

    account.isResetting = false;
    loginProcess(accountId);
  }

  // Resume existing accounts
  const existingAccounts = fs.readdirSync(ACCOUNTS_DIR);
  for (const accountId of existingAccounts) {
    if (fs.statSync(path.join(ACCOUNTS_DIR, accountId)).isDirectory()) {
      const account = await createAccount(accountId);
      loginProcess(accountId);
    }
  }

  app.get('/api/accounts', (req, res) => {
    const list = Array.from(accounts.values()).map(acc => ({
      accountId: acc.accountId,
      isAuthenticated: acc.isAuthenticated,
      isListening: acc.zaloService.isListening
    }));
    res.json(list);
  });

  app.post('/api/accounts', async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });
    if (accounts.has(accountId)) return res.status(400).json({ error: 'Account already exists' });

    await createAccount(accountId);
    loginProcess(accountId);
    res.json({ success: true, accountId });
  });

  app.get('/qr/:accountId.png', (req, res) => {
    const account = accounts.get(req.params.accountId);
    if (account && fs.existsSync(account.qrFile)) {
      res.sendFile(account.qrFile);
    } else {
      res.status(404).send('QR code not found');
    }
  });

  app.use('/api/:accountId', (req, res, next) => {
    const account = accounts.get(req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Inject account into req for controllers if needed, but for now we'll use a dynamic router or similar
    req.account = account;
    next();
  });

  // Dynamic routes based on account
  app.get('/api/:accountId/auth-status', (req, res) => {
    const account = req.account;
    if (!account.isAuthenticated && !fs.existsSync(account.qrFile) && account.qrActions) {
      console.log(`[${account.accountId}] QR file missing during status check, re-generating...`);
      account.qrActions.retry();
    }
    res.json({
      isAuthenticated: account.isAuthenticated,
      isListening: account.zaloService.isListening || false
    });
  });

  app.post('/api/:accountId/refresh-qr', (req, res) => {
    const account = req.account;
    if (account.isAuthenticated) return res.json({ success: false, message: "Already authenticated" });
    if (account.qrActions) {
      console.log(`[${account.accountId}] Manual QR refresh requested.`);
      account.qrActions.retry();
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Login not in progress" });
    }
  });

  app.post('/api/:accountId/send', (req, res) => req.account.controller.sendMessage(req, res));
  app.get('/api/:accountId/groups', (req, res) => req.account.controller.getGroups(req, res));
  app.get('/api/:accountId/messages', (req, res) => req.account.controller.getMessages(req, res));
  app.get('/api/:accountId/webhook-config', (req, res) => req.account.controller.getWebhookConfig(req, res));
  app.post('/api/:accountId/webhook-config', (req, res) => req.account.controller.updateWebhookConfig(req, res));

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  setInterval(() => {}, 3600000);
}

start();
