export const logger = {
  info: (msg, ...args) => {
    console.log(`[${new Date().toISOString()}] ℹ️  INFO: ${msg}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`[${new Date().toISOString()}] ✅ SUCCESS: ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`[${new Date().toISOString()}] ⚠️  WARN: ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`[${new Date().toISOString()}] ❌ ERROR: ${msg}`, ...args);
  },
  bot: (msg, ...args) => {
    console.log(`[${new Date().toISOString()}] 🤖 BOT: ${msg}`, ...args);
  },
};
