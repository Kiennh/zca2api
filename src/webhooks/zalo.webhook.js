module.exports = (zaloService, messageStore) => {
  if (zaloService.client && zaloService.client.listener) {
    zaloService.isListening = false;

    zaloService.client.listener.on("connected", () => {
      console.log("Zalo listener connected");
      zaloService.isListening = true;
    });

    zaloService.client.listener.on("closed", () => {
      console.log("Zalo listener closed");
      zaloService.isListening = false;
    });

    zaloService.client.listener.on("disconnected", () => {
      console.log("Zalo listener disconnected");
      zaloService.isListening = false;
    });

    zaloService.client.listener.on("message", (msg) => {
      console.log("Incoming:", msg);
      messageStore.save(msg);
    });

    zaloService.client.listener.start();
  } else {
    console.error("Zalo client listener not available for webhook setup.");
  }
};
