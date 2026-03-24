class ZaloService {
  constructor(client) {
    this.client = client;
  }

  async sendMessage(text, threadId, type = "user") {
    if (!this.client) throw new Error("Zalo client not initialized");
    return await this.client.sendMessage({
      msg: text,
      threadId,
      type
    });
  }

  async getGroups() {
    if (!this.client) throw new Error("Zalo client not initialized");
    if (typeof this.client.getAllGroups !== 'function') {
        throw new Error("this.client.getAllGroups is not a function. Check if client is initialized correctly.");
    }
    return await this.client.getAllGroups();
  }
}

module.exports = ZaloService;
