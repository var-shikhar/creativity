const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Redis max retries exceeded');
      }
      return retries * 100;
    }
  }
});

client.on('error', (err) => console.error('Redis Client Error:', err));
client.on('connect', () => console.log('✓ Redis connected'));
client.on('reconnecting', () => console.log('↻ Redis reconnecting...'));

const connectRedis = async () => {
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

module.exports = { client, connectRedis };
