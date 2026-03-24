# Zalo Messaging Integration Project (zns-js / zca-js v2)

## Overview

This project implements: - Zalo messaging integration using zca-js
(v2) - REST API to send messages - Webhook to receive message
notifications - API to fetch received messages - Simple dashboard UI for
testing send/receive messages and group selection

------------------------------------------------------------------------

## 1. Tech Stack

-   Node.js (\>=18)
-   Express.js
-   zca-js (Zalo client)
-   WebSocket (optional for realtime UI)
-   Simple frontend (React or plain HTML)

------------------------------------------------------------------------

## 2. Project Structure

    project/
     ├── src/
     │   ├── services/
     │   │   └── zalo.service.js
     │   ├── controllers/
     │   │   └── message.controller.js
     │   ├── routes/
     │   │   └── message.routes.js
     │   ├── webhooks/
     │   │   └── zalo.webhook.js
     │   ├── storage/
     │   │   └── message.store.js
     │   └── app.js
     ├── dashboard/
     │   └── (frontend files)
     └── README.md

------------------------------------------------------------------------

## 3. Setup Zalo Client (zca-js v2)

### Install

    npm install zca-js express body-parser cors

### Initialize client

``` js
const { Zalo } = require("zca-js");

const zalo = new Zalo({
  selfListen: true,
  checkUpdate: true
});

await zalo.loginQR(); // scan QR
```

------------------------------------------------------------------------

## 4. Zalo Service

``` js
class ZaloService {
  constructor(client) {
    this.client = client;
  }

  async sendMessage(text, threadId, type = "user") {
    return await this.client.sendMessage({
      msg: text,
      threadId,
      type
    });
  }

  async getGroups() {
    return await this.client.getAllGroups();
  }
}

module.exports = ZaloService;
```

------------------------------------------------------------------------

## 5. REST API

### Routes

  Method   Endpoint        Description
  -------- --------------- -----------------------
  POST     /api/send       Send message
  GET      /api/groups     List groups
  GET      /api/messages   Get received messages

------------------------------------------------------------------------

### Controller

``` js
exports.sendMessage = async (req, res) => {
  const { text, threadId, type } = req.body;
  const result = await zaloService.sendMessage(text, threadId, type);
  res.json(result);
};
```

------------------------------------------------------------------------

## 6. Webhook (Receive Messages)

``` js
zalo.client.listener.on("message", (msg) => {
  console.log("Incoming:", msg);

  messageStore.save(msg);

  // optional: forward to webhook URL
});
```

------------------------------------------------------------------------

## 7. Message Storage (Simple)

``` js
const messages = [];

module.exports = {
  save(msg) {
    messages.push(msg);
  },
  getAll() {
    return messages;
  }
};
```

------------------------------------------------------------------------

## 8. Dashboard (Frontend)

### Features

-   Send message form
-   Group selector dropdown
-   Message history (received + sent)

### Example UI (HTML)

``` html
<select id="group"></select>
<input id="message" />
<button onclick="send()">Send</button>

<div id="messages"></div>
```

------------------------------------------------------------------------

## 9. API Documentation

### POST /api/send

Request:

``` json
{
  "text": "Hello",
  "threadId": "123",
  "type": "group"
}
```

Response:

``` json
{
  "success": true
}
```

------------------------------------------------------------------------

### GET /api/groups

Response:

``` json
[
  {
    "id": "group_id",
    "name": "Group Name"
  }
]
```

------------------------------------------------------------------------

### GET /api/messages

Response:

``` json
[
  {
    "text": "hello",
    "from": "user",
    "time": 123456
  }
]
```

------------------------------------------------------------------------

## 10. Run Project

    node src/app.js

------------------------------------------------------------------------

## 11. Notes

-   Requires QR login session persistence
-   Use database (MongoDB/Redis) in production
-   Secure webhook endpoints
