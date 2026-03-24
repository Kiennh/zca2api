class ZaloService {
  constructor(client) {
    this.client = client;
  }

  async sendMessage(text, threadId, type = "user") {
    return await this.client.sendMessage({
      msg: text,
      threadId,
      type
    });
  }

  async getGroups() {
    return await this.client.getAllGroups();
  }
}

module.exports = ZaloService;
