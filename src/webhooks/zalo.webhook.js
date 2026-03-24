module.exports = (zalo, messageStore) => {
  if (zalo.client && zalo.client.listener) {
    zalo.client.listener.on("message", (msg) => {
      console.log("Incoming:", msg);
      messageStore.save(msg);
    });
  } else {
    console.error("Zalo client listener not available for webhook setup.");
  }
};
