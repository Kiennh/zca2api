module.exports = (zaloService, messageStore, configStore, onFailure) => {
  if (zaloService.client && zaloService.client.listener) {
    zaloService.isListening = false;

    zaloService.client.listener.on("connected", () => {
      console.log("Zalo listener connected");
      zaloService.isListening = true;
    });

    zaloService.client.listener.on("closed", () => {
      console.log("Zalo listener closed");
      zaloService.isListening = false;
      if (typeof onFailure === 'function') onFailure();
    });

    zaloService.client.listener.on("disconnected", () => {
      console.log("Zalo listener disconnected");
      zaloService.isListening = false;
      if (typeof onFailure === 'function') onFailure();
    });

    zaloService.client.listener.on("error", (err) => {
      console.error("Zalo listener error:", err.message);
      zaloService.isListening = false;
      if (typeof onFailure === 'function') onFailure();
    });

    zaloService.client.listener.on("message", async (msg) => {
      console.log("Incoming:", msg);
      messageStore.save(msg);

      const webhookUrl = configStore.getWebhookUrl();
      if (webhookUrl) {
        try {
          const data = msg.data || {};
          const formatted = {
            from: data.dName || data.uidFrom || (msg.isSelf ? 'Me' : 'Unknown'),
            time: parseInt(data.ts || Date.now(), 10),
            text: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || ''),
            isGroup: msg.type === 1,
            threadId: msg.threadId,
            isSelf: msg.isSelf,
            raw: msg
          };

          console.log(`Forwarding to webhook: ${webhookUrl}`);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formatted)
          });
        } catch (error) {
          console.error(`Failed to forward to webhook: ${error.message}`);
        }
      }
    });

    zaloService.client.listener.start();
  } else {
    console.error("Zalo client listener not available for webhook setup.");
    if (typeof onFailure === 'function') onFailure();
  }
};
