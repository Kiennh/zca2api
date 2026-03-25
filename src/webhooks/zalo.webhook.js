module.exports = (accountId, zaloService, messageStore, configStore, onFailure) => {
  if (zaloService.client && zaloService.client.listener) {
    zaloService.isListening = false;

    zaloService.client.listener.on("connected", () => {
      console.log(`Zalo listener connected for ${accountId}`);
      zaloService.isListening = true;
    });

    zaloService.client.listener.on("closed", () => {
      console.log(`Zalo listener closed for ${accountId}`);
      zaloService.isListening = false;
      if (typeof onFailure === 'function') onFailure();
    });

    zaloService.client.listener.on("disconnected", () => {
      console.log(`Zalo listener disconnected for ${accountId}`);
      zaloService.isListening = false;
      if (typeof onFailure === 'function') onFailure();
    });

    zaloService.client.listener.on("error", (err) => {
      console.error(`Zalo listener error for ${accountId}:`, err.message);
      zaloService.isListening = false;
      if (typeof onFailure === 'function') onFailure();
    });

    zaloService.client.listener.on("message", async (msg) => {
      console.log(`Incoming [${accountId}]:`, msg);
      messageStore.save(msg);

      const webhookUrl = configStore.getWebhookUrl();
      if (webhookUrl) {
        try {
          const data = msg.data || {};
          const formatted = {
            accountId: accountId,
            from: data.dName || data.uidFrom || (msg.isSelf ? 'Me' : 'Unknown'),
            time: parseInt(data.ts || Date.now(), 10),
            text: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || ''),
            isGroup: msg.type === 1,
            threadId: msg.threadId,
            isSelf: msg.isSelf,
            raw: msg
          };

          console.log(`Forwarding to webhook [${accountId}]: ${webhookUrl}`);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formatted)
          });
        } catch (error) {
          console.error(`Failed to forward to webhook [${accountId}]: ${error.message}`);
        }
      }
    });

    zaloService.client.listener.start();
  } else {
    console.error(`Zalo client listener not available for webhook setup on ${accountId}.`);
    if (typeof onFailure === 'function') onFailure();
  }
};
