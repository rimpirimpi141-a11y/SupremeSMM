import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID ? String(process.env.ADMIN_TELEGRAM_ID).trim() : '',
  BRAND_NAME: '𝐒𝐔𝐏𝐑𝐄𝐌𝐄 𝐇𝐄𝐑𝐄',
  BOT_NAME: 'SMM PANEL',
  CURRENCY: '₹',
  DATABASE_PATH: process.env.DATABASE_PATH || './data/database.sqlite',
  DEFAULT_MIN_DEPOSIT: 50,
  DEFAULT_REFERRAL_BONUS: 5.0,
  DEFAULT_UPI_ID: 'sonugupta829857@okhdfcbank',
  DEFAULT_PAYMENT_INSTRUCTIONS: 'Send payment via Google Pay, PhonePe, Paytm or any UPI App.\nAfter payment, send the screenshot or UTR number here for instant verification.',
  SUPPORT_USERNAME: process.env.SUPPORT_USERNAME ? process.env.SUPPORT_USERNAME.replace('@', '').trim() : 'SUPREMEXAURA01',
  DEFAULT_SUPPORT_USERNAME: process.env.SUPPORT_USERNAME ? process.env.SUPPORT_USERNAME.replace('@', '').trim() : 'SUPREMEXAURA01',
};
