const messages = [];

module.exports = {
  save(msg) {
    messages.push(msg);
  },
  getAll() {
    return messages;
  }
};
