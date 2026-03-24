module.exports = (zaloService, messageStore) => {
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
      res.json(messageStore.getAll());
    }
  };
};
