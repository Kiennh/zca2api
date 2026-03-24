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
    
    const result = await this.client.getAllGroups();
    if (!result || !result.gridVerMap) return [];

    const groupIds = Object.keys(result.gridVerMap);
    if (groupIds.length === 0) return [];

    const chunkSize = 20;
    const allGroups = [];

    for (let i = 0; i < groupIds.length; i += chunkSize) {
      const chunk = groupIds.slice(i, i + chunkSize);
      try {
        const groupInfo = await this.client.getGroupInfo(chunk);
        if (groupInfo && groupInfo.gridInfoMap) {
          Object.values(groupInfo.gridInfoMap).forEach(g => {
            allGroups.push({
              id: g.groupId,
              name: g.name
            });
          });
        }
      } catch (e) {
        console.error(`Error fetching group info for chunk starting at ${i}:`, e.message);
      }
    }

    return allGroups;
  }
}

module.exports = ZaloService;
