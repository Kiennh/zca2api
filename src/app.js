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
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

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
      loginTimeout: null,
      currentAttemptId: null,
    };

    accounts.set(accountId, account);

    const controller = messageControllerFactory(zaloService, messageStore, configStore);
    account.controller = controller;

    return account;
  }

  async function renameAccount(oldId, newId) {
    if (oldId === newId) return newId;
    const account = accounts.get(oldId);
    if (!account) return oldId;

    console.log(`Renaming account ${oldId} to ${newId}`);

    const oldDir = account.accountDir;
    const newDir = path.join(ACCOUNTS_DIR, newId);

    if (fs.existsSync(newDir) && oldDir !== newDir) {
      console.warn(`Target directory ${newId} already exists. Overwriting session info.`);
      fs.copyFileSync(account.sessionFile, path.join(newDir, 'session.json'));
      if (fs.existsSync(account.configFile)) fs.copyFileSync(account.configFile, path.join(newDir, 'config.json'));
      if (fs.existsSync(account.messagesFile)) fs.copyFileSync(account.messagesFile, path.join(newDir, 'messages.json'));
      try {
        fs.rmSync(oldDir, { recursive: true, force: true });
      } catch (e) { }
    } else if (oldDir !== newDir) {
      fs.renameSync(oldDir, newDir);
    }

    account.accountId = newId;
    account.accountDir = newDir;
    account.sessionFile = path.join(newDir, 'session.json');
    account.configFile = path.join(newDir, 'config.json');
    account.messagesFile = path.join(newDir, 'messages.json');
    account.qrFile = path.join(newDir, 'qr.png');

    account.configStore.filePath = account.configFile;
    account.messageStore.filePath = account.messagesFile;
    account.zaloService.sessionFile = account.sessionFile;

    accounts.delete(oldId);
    accounts.set(newId, account);

    return newId;
  }

  function cleanupAccountResources(accountId, deleteSession = false) {
    const account = accounts.get(accountId);
    if (!account) return;

    console.log(`[${accountId}] Cleaning up resources (deleteSession: ${deleteSession})...`);

    if (account.loginTimeout) {
      clearTimeout(account.loginTimeout);
      account.loginTimeout = null;
    }

    if (account.zaloApi) {
      if (account.zaloApi.listener) {
        try {
          account.zaloApi.listener.removeAllListeners();
          account.zaloApi.listener.stop();
        } catch (e) {
          console.error(`[${accountId}] Error stopping listener:`, e.message);
        }
      }
      account.zaloApi = null;
    }

    account.zaloService.client = null;
    account.zaloService.isListening = false;
    account.isAuthenticated = false;
    account.qrActions = null;

    if (fs.existsSync(account.qrFile)) {
      try {
        fs.unlinkSync(account.qrFile);
      } catch (err) { }
    }

    if (deleteSession && fs.existsSync(account.sessionFile)) {
      try {
        fs.unlinkSync(account.sessionFile);
        console.log(`[${accountId}] Session file deleted.`);
      } catch (err) {
        console.error(`[${accountId}] Failed to delete session file:`, err.message);
      }
    }
  }

  async function loginProcess(accountId) {
    let account = accounts.get(accountId);
    if (!account) return;

    cleanupAccountResources(accountId);
    const currentAttemptId = Date.now();
    account.currentAttemptId = currentAttemptId;

    console.log(`[${accountId}] Loading account (Attempt: ${currentAttemptId})`);
    const zalo = new Zalo({ selfListen: true, checkUpdate: true });

    if (fs.existsSync(account.sessionFile)) {
      console.log(`[${accountId}] Found session file, attempting to resume...`);
      try {
        const sessionData = JSON.parse(fs.readFileSync(account.sessionFile, 'utf8'));
        const api = await zalo.login({
          cookie: sessionData.cookie,
          imei: sessionData.imei,
          userAgent: sessionData.userAgent || getRandomUserAgent()
        });

        if (account.currentAttemptId !== currentAttemptId) return;

        account.zaloApi = api;
        account.isAuthenticated = true;
        console.log(`[${accountId}] Logged in successfully using saved session!`);
        account.qrActions = null;
      } catch (e) {
        console.error(`[${accountId}] Session login failed:`, e.message);
      }
    }

    if (!account.isAuthenticated) {
      if (account.currentAttemptId !== currentAttemptId) return;
      console.log(`[${accountId}] Starting QR login...`);
      try {
        const selectedUserAgent = getRandomUserAgent();
        const api = await zalo.loginQR({ userAgent: selectedUserAgent, qrPath: account.qrFile }, (event) => {
          if (account.currentAttemptId !== currentAttemptId) return;

          if (event.actions) {
            account.qrActions = event.actions;
          }

          if (event.type === 0) { // QRCodeGenerated
            console.log(`[${accountId}] QR Code generated, saving to file...`);
            event.actions.saveToFile();
          }

          if (event.type === 4) { // GotLoginInfo
            try {
              const sessionData = { ...event.data, userAgent: selectedUserAgent };
              fs.writeFileSync(account.sessionFile, JSON.stringify(sessionData));
              console.log(`[${accountId}] Session saved to disk.`);
            } catch (err) {
              console.error(`[${accountId}] Failed to save session:`, err.message);
            }
          }
        });

        if (account.currentAttemptId !== currentAttemptId) return;

        account.zaloApi = api;
        account.isAuthenticated = true;
        console.log(`[${accountId}] Logged in successfully via QR!`);
        account.qrActions = null;
      } catch (error) {
        if (account.currentAttemptId !== currentAttemptId) return;
        console.error(`[${accountId}] QR login failed:`, error.message);
        account.qrActions = null;
        account.loginTimeout = setTimeout(() => loginProcess(accountId), 5000);
        return;
      }
    }

    if (account.currentAttemptId !== currentAttemptId) return;

    if (account.zaloApi) {
      account.zaloService.client = account.zaloApi;

      let currentId = account.accountId;
      if (currentId.startsWith('pending_')) {
        try {
          const selfInfo = await account.zaloApi.getSelfInfo();
          if (selfInfo && selfInfo.uid) {
            const realUid = selfInfo.uid.toString();
            currentId = await renameAccount(currentId, realUid);
          }
        } catch (e) {
          console.error(`[${currentId}] Failed to get self info for renaming:`, e.message);
        }
      }
      console.log(`[${currentId}] setup webhook and reset session ${currentId}`)
      setupWebhook(currentId, account.zaloService, account.messageStore, account.configStore, () => resetSession(currentId));
    }
  }

  async function resetSession(accountId) {
    const account = accounts.get(accountId);
    if (!account || account.isResetting) return;
    account.isResetting = true;
    console.log(`!!! [${accountId}] Resetting session due to failure or manual request...`);

    cleanupAccountResources(accountId, true);
    account.isResetting = false;
    loginProcess(accountId);
  }

  // Resume existing accounts
  if (fs.existsSync(ACCOUNTS_DIR)) {
    const existingAccounts = fs.readdirSync(ACCOUNTS_DIR);
    for (const accountId of existingAccounts) {
      if (fs.statSync(path.join(ACCOUNTS_DIR, accountId)).isDirectory()) {
        await createAccount(accountId);
        loginProcess(accountId);
      }
    }
  }

  /**
   * @swagger
   * /api/accounts:
   *   get:
   *     summary: List all accounts
   *     tags: [Accounts]
   *     responses:
   *       200:
   *         description: List of accounts with status
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   accountId:
   *                     type: string
   *                   isAuthenticated:
   *                     type: boolean
   *                   isListening:
   *                     type: boolean
   */
  app.get('/api/accounts', (req, res) => {
    const list = Array.from(accounts.values()).map(acc => ({
      accountId: acc.accountId,
      isAuthenticated: acc.isAuthenticated,
      isListening: acc.zaloService.isListening
    }));
    res.json(list);
  });

  /**
   * @swagger
   * /api/accounts:
   *   post:
   *     summary: Create a new account
   *     tags: [Accounts]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               accountId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Account created successfully
   */
  app.post('/api/accounts', async (req, res) => {
    let { accountId } = req.body;
    if (!accountId) {
      accountId = `pending_${Date.now()}`;
    }
    if (accounts.has(accountId)) return res.status(400).json({ error: 'Account already exists' });

    await createAccount(accountId);
    loginProcess(accountId);
    res.json({ success: true, accountId });
  });

  /**
   * @swagger
   * /qr/{accountId}.png:
   *   get:
   *     summary: Get login QR code for account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: QR code image
   *         content:
   *           image/png:
   *             schema:
   *               type: string
   *               format: binary
   */
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

    req.account = account;
    next();
  });

  /**
   * @swagger
   * /api/{accountId}:
   *   delete:
   *     summary: Delete account and all its data
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Account deleted
   */
  app.delete('/api/:accountId', async (req, res) => {
    const accountId = req.params.accountId;
    const account = req.account;

    console.log(`Deleting account ${accountId}`);
    cleanupAccountResources(accountId, true);
    accounts.delete(accountId);

    // Delete files
    try {
      fs.rmSync(account.accountDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete account directory for ${accountId}:`, e.message);
    }

    res.json({ success: true });
  });

  /**
   * @swagger
   * /api/{accountId}/re-login:
   *   post:
   *     summary: Force re-login for account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Login process restarted
   */
  app.post('/api/:accountId/re-login', (req, res) => {
    console.log(`[${req.params.accountId}] Re-login requested`);
    resetSession(req.params.accountId);
    res.json({ success: true, message: "Login process restarted" });
  });

  /**
   * @swagger
   * /api/{accountId}/auth-status:
   *   get:
   *     summary: Get auth status for account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auth status
   */
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

  /**
   * @swagger
   * /api/{accountId}/refresh-qr:
   *   post:
   *     summary: Refresh QR code for account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Success or failure message
   */
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

  /**
   * @swagger
   * /api/{accountId}/send:
   *   post:
   *     summary: Send message
   *     tags: [Messages]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 text:
   *                   type: string
   *                 threadId:
   *                   type: string
   *                 type:
   *                   type: string
   *                   enum: [user, group]
   *     responses:
   *       200:
   *         description: Message sent
   */
  app.post('/api/:accountId/send', (req, res) => req.account.controller.sendMessage(req, res));

  /**
   * @swagger
   * /api/{accountId}/groups:
   *   get:
   *     summary: Get groups
   *     tags: [Messages]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of groups
   */
  app.get('/api/:accountId/groups', (req, res) => req.account.controller.getGroups(req, res));

  /**
   * @swagger
   * /api/{accountId}/messages:
   *   get:
   *     summary: Get messages
   *     tags: [Messages]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of messages
   */
  app.get('/api/:accountId/messages', (req, res) => req.account.controller.getMessages(req, res));

  /**
   * @swagger
   * /api/{accountId}/webhook-config:
   *   get:
   *     summary: Get webhook config
   *     tags: [Config]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Webhook config
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 webhookUrl:
   *                   type: string
   *                 secretToken:
   *                   type: string
   */
  app.get('/api/:accountId/webhook-config', (req, res) => req.account.controller.getWebhookConfig(req, res));

  /**
   * @swagger
   * /api/{accountId}/webhook-config:
   *   post:
   *     summary: Update webhook config
   *     tags: [Config]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               webhookUrl:
   *                 type: string
   *               secretToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Webhook config
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 webhookUrl:
   *                   type: string
   *                 secretToken:
   *                   type: string updated
   */
  app.post('/api/:accountId/webhook-config', (req, res) => req.account.controller.updateWebhookConfig(req, res));

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  setInterval(() => { }, 3600000);
}

start();
