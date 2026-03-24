const express = require('express');

module.exports = (controller) => {
  const router = express.Router();

  router.post('/send', controller.sendMessage);
  router.get('/groups', controller.getGroups);
  router.get('/messages', controller.getMessages);

  return router;
};
