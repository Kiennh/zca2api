const fs = require('fs');
const path = require('path');

class MessageStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.messages = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.messages = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error.message);
    }
  }

  save(msg) {
    this.messages.push(msg);
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.messages, null, 2));
    } catch (error) {
      console.error('Failed to save messages:', error.message);
    }
  }

  getAll() {
    return this.messages;
  }
}

module.exports = MessageStore;
