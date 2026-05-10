const session = require('express-session');
const connectRedis = require('connect-redis');
const { createClient } = require('redis');

async function buildSessionMiddleware() {
  let store;

  try {
    const redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: { tls: true, rejectUnauthorized: false },
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    await redisClient.connect();
    console.log('[Redis] Connected to Upstash successfully.');

    // connect-redis v7 default export
    const RedisStore = connectRedis.default || connectRedis;
    store = new RedisStore({ client: redisClient, prefix: 'pesu:sess:' });
  } catch (err) {
    console.warn('[Redis] Failed to connect — falling back to in-memory sessions.');
    console.warn('[Redis] Error:', err.message);
    store = undefined; // express-session defaults to MemoryStore
  }

  return session({
    store,
    secret: process.env.SESSION_SECRET || 'changeme',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    },
  });
}

module.exports = { buildSessionMiddleware };
