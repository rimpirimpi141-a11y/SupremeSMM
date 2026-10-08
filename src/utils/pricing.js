import { CONFIG } from '../config.js';

export function calculatePrice(pricePerK, quantity) {
  const price = (Number(pricePerK) * Number(quantity)) / 1000;
  return Math.round(price * 100) / 100; // 2 decimal places
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `${CONFIG.CURRENCY}${num.toFixed(2)}`;
}

export function formatNumber(num) {
  return Number(num).toLocaleString('en-IN');
}
