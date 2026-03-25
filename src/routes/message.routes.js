const express = require('express');
/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         from:
 *           type: string
 *         time:
 *           type: integer
 *         text:
 *           type: string
 *         isGroup:
 *           type: boolean
 *         threadId:
 *           type: string
 *         isSelf:
 *           type: boolean
 *     Group:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 */

module.exports = (controller) => {
  const router = express.Router();

  router.post('/send', controller.sendMessage);
  router.get('/groups', controller.getGroups);
  router.get('/messages', controller.getMessages);
  router.get('/webhook-config', controller.getWebhookConfig);
  router.post('/webhook-config', controller.updateWebhookConfig);

  return router;
};
