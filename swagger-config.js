const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zalo Messaging API',
      version: '1.0.0',
      description: 'API documentation for Zalo messaging integration',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/app.js', './src/routes/*.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
