module.exports = (zalo, messageStore) => {
  zalo.client.listener.on("message", (msg) => {
    console.log("Incoming:", msg);
    messageStore.save(msg);
  });
};
