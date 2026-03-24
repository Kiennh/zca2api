const fs = require('fs');
const { ThreadType } = require('zca-js');

class ZaloService {
  constructor(client, sessionFile) {
    this.client = client;
    this.sessionFile = sessionFile;
    this.isListening = false;
  }

  async sendMessage(text, threadId, type = "user") {
    if (!this.client) throw new Error("Zalo client not initialized");
    
    const threadType = type === "group" ? ThreadType.Group : ThreadType.User;
    return await this.client.sendMessage(text, threadId, threadType);
  }

  async getGroups() {
    if (!this.client) throw new Error("Zalo client not initialized");
    
    const result = await this.client.getAllGroups();
    if (!result || !result.gridVerMap) return [];

    const gridVerMap = result.gridVerMap;
    const groupIds = Object.keys(gridVerMap);
    
    let sessionData = {};
    try {
      if (this.sessionFile && fs.existsSync(this.sessionFile)) {
        sessionData = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
      }
    } catch (e) {
      console.error("Failed to read session file for cache:", e.message);
    }
    
    const cache = sessionData.groups || {};
    const updatedCache = { ...cache };
    let cacheChanged = false;
    
    const groupsToFetch = [];
    const finalGroups = [];
    
    for (const id of groupIds) {
      const currentVer = gridVerMap[id];
      const cached = cache[id];
      
      if (cached && cached.version === currentVer) {
        finalGroups.push({ id, name: cached.name });
      } else {
        groupsToFetch.push(id);
      }
    }
    
    if (groupsToFetch.length > 0) {
      const chunkSize = 20;
      for (let i = 0; i < groupsToFetch.length; i += chunkSize) {
        const chunk = groupsToFetch.slice(i, i + chunkSize);
        try {
          const groupInfo = await this.client.getGroupInfo(chunk);
          if (groupInfo && groupInfo.gridInfoMap) {
            Object.values(groupInfo.gridInfoMap).forEach(g => {
              const info = {
                id: g.groupId,
                name: g.name,
                version: gridVerMap[g.groupId]
              };
              finalGroups.push({ id: info.id, name: info.name });
              updatedCache[info.id] = { name: info.name, version: info.version };
              cacheChanged = true;
            });
          }
        } catch (e) {
          console.error(`Error fetching group info for chunk starting at ${i}: `, e.message);
        }
      }
    }
    
    if (cacheChanged && this.sessionFile) {
      try {
        sessionData.groups = updatedCache;
        fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));
      } catch (e) {
        console.error("Failed to write updated cache to session file:", e.message);
      }
    }

    return finalGroups;
  }
}

module.exports = ZaloService;
