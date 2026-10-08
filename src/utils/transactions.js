import { get, run, transaction } from '../database.js';
import { logger } from './logger.js';

export function generateOrderCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'ORD-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateDepositCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'DEP-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getUser(telegramId) {
  const strId = String(telegramId).trim();
  return get('SELECT * FROM users WHERE telegram_id = ?', [strId]);
}

export function getUserBalance(telegramId) {
  const user = getUser(telegramId);
  return user ? Number(user.balance) : 0.0;
}

/**
 * Safely credit user balance with a transaction record
 */
export function creditBalance(telegramId, amount, type, description, referenceId = null) {
  const numAmount = Math.abs(Number(amount));
  if (numAmount <= 0) return { success: false, message: 'Invalid amount' };

  return transaction(() => {
    const strId = String(telegramId).trim();
    const user = get('SELECT id, balance FROM users WHERE telegram_id = ?', [strId]);
    if (!user) {
      throw new Error(`User with telegram_id ${strId} not found`);
    }

    const balanceBefore = Number(user.balance);
    const balanceAfter = Math.round((balanceBefore + numAmount) * 100) / 100;

    run('UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [balanceAfter, user.id]);

    run(
      `INSERT INTO transactions (user_id, telegram_id, type, amount, balance_before, balance_after, description, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, strId, type, numAmount, balanceBefore, balanceAfter, description, referenceId]
    );

    logger.info(`Credited ₹${numAmount} to ${strId}. New balance: ₹${balanceAfter}`);
    return { success: true, balanceBefore, balanceAfter, amount: numAmount };
  });
}

/**
 * Safely deduct user balance with strict non-negative check and transaction record
 */
export function deductBalance(telegramId, amount, type, description, referenceId = null) {
  const numAmount = Math.abs(Number(amount));
  if (numAmount <= 0) return { success: false, message: 'Invalid amount' };

  return transaction(() => {
    const strId = String(telegramId).trim();
    const user = get('SELECT id, balance, total_spent FROM users WHERE telegram_id = ?', [strId]);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const currentBalance = Number(user.balance);
    if (currentBalance < numAmount) {
      return {
        success: false,
        message: 'Insufficient balance',
        currentBalance,
        required: numAmount,
        shortage: Math.round((numAmount - currentBalance) * 100) / 100
      };
    }

    const balanceBefore = currentBalance;
    const balanceAfter = Math.round((balanceBefore - numAmount) * 100) / 100;
    const newSpent = Math.round(((Number(user.total_spent) || 0) + numAmount) * 100) / 100;

    run('UPDATE users SET balance = ?, total_spent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      balanceAfter,
      newSpent,
      user.id
    ]);

    run(
      `INSERT INTO transactions (user_id, telegram_id, type, amount, balance_before, balance_after, description, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, strId, type, -numAmount, balanceBefore, balanceAfter, description, referenceId]
    );

    logger.info(`Deducted ₹${numAmount} from ${strId}. New balance: ₹${balanceAfter}`);
    return { success: true, balanceBefore, balanceAfter, amount: numAmount };
  });
}
