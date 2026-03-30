const fs = require('fs');
const path = require('path');

class ConfigStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.config = { webhookUrl: '', secretToken: '' };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.config = { ...this.config, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load config:', error.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error.message);
    }
  }

  getWebhookUrl() {
    return this.config.webhookUrl;
  }

  setWebhookUrl(url) {
    this.config.webhookUrl = url;
    this.save();
  }

  getSecretToken() {
    return this.config.secretToken;
  }

  setSecretToken(token) {
    this.config.secretToken = token;
    this.save();
  }
}

module.exports = ConfigStore;
