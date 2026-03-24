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

/**
 * @swagger
 * /api/send:
 *   post:
 *     summary: Send a message
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *               threadId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [user, group]
 *     responses:
 *       200:
 *         description: Message sent successfully
 */

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: Get all groups
 *     tags: [Messages]
 *     responses:
 *       200:
 *         description: List of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 : '#/components/schemas/Group'
 */

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Get message history
 *     tags: [Messages]
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 : '#/components/schemas/Message'
 */


module.exports = (controller) => {
  const router = express.Router();

  router.post('/send', controller.sendMessage);
  router.get('/groups', controller.getGroups);
  router.get('/messages', controller.getMessages);

  return router;
};
