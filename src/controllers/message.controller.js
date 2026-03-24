module.exports = (zaloService, messageStore, configStore) => {
  return {
    sendMessage: async (req, res) => {
      const { text, threadId, type } = req.body;
      try {
        const result = await zaloService.sendMessage(text, threadId, type);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    getGroups: async (req, res) => {
      try {
        const result = await zaloService.getGroups();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    getMessages: async (req, res) => {
      const rawMessages = messageStore.getAll();
      const formatted = rawMessages.map(msg => {
        const data = msg.data || {};
        return {
          from: data.dName || data.uidFrom || (msg.isSelf ? 'Me' : 'Unknown'),
          time: parseInt(data.ts || Date.now(), 10),
          text: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || ''),
          isGroup: msg.type === 1,
          threadId: msg.threadId,
          isSelf: msg.isSelf
        };
      });
      res.json(formatted);
    },

    getWebhookConfig: (req, res) => {
      res.json({ webhookUrl: configStore.getWebhookUrl() });
    },

    updateWebhookConfig: (req, res) => {
      const { webhookUrl } = req.body;
      configStore.setWebhookUrl(webhookUrl);
      res.json({ success: true, webhookUrl: configStore.getWebhookUrl() });
    }
  };
};
