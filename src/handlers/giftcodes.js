import { get, run } from '../database.js';
import { formatCurrency } from '../utils/pricing.js';
import { creditBalance } from '../utils/transactions.js';
import { logger } from '../utils/logger.js';

export async function startRedeemGiftCode(ctx) {
  ctx.session.step = 'awaiting_gift_code';
  ctx.session.data = {};

  const text = 
`🎁 *Redeem Gift Code*

Please enter your promo or voucher gift code below to claim instant balance:`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}

export async function handleGiftCodeInput(ctx) {
  const rawCode = ctx.message.text.trim().toUpperCase();
  const telegramId = String(ctx.from.id);
  ctx.session.step = null;

  if (!rawCode) {
    await ctx.reply('⚠️ Please provide a valid code.');
    return;
  }

  // Lookup gift code
  const codeRow = get('SELECT * FROM gift_codes WHERE code = ?', [rawCode]);

  if (!codeRow) {
    await ctx.reply('❌ *Invalid Gift Code!*\nThis code does not exist. Please check your spelling.', {
      parse_mode: 'Markdown'
    });
    return;
  }

  if (codeRow.is_active !== 1) {
    await ctx.reply('❌ *Inactive Code!*\nThis gift code has been deactivated.', {
      parse_mode: 'Markdown'
    });
    return;
  }

  // Check expiry
  if (codeRow.expires_at) {
    const expiryTime = new Date(codeRow.expires_at).getTime();
    if (Date.now() > expiryTime) {
      await ctx.reply('❌ *Expired Code!*\nThis gift code has already expired.', {
        parse_mode: 'Markdown'
      });
      return;
    }
  }

  // Check usage limit
  if (codeRow.used_count >= codeRow.max_uses) {
    await ctx.reply('❌ *Limit Reached!*\nThis gift code has reached its maximum redemptions.', {
      parse_mode: 'Markdown'
    });
    return;
  }

  // Check if user already used this code
  const alreadyUsed = get(
    'SELECT id FROM gift_code_uses WHERE code_id = ? AND telegram_id = ?',
    [codeRow.id, telegramId]
  );

  if (alreadyUsed) {
    await ctx.reply('⚠️ *Already Redeemed!*\nYou have already claimed this gift code.', {
      parse_mode: 'Markdown'
    });
    return;
  }

  // Atomically credit user balance
  try {
    const creditResult = creditBalance(
      telegramId,
      codeRow.reward_amount,
      'GIFT_CODE',
      `Redeemed Gift Code: ${codeRow.code}`,
      String(codeRow.id)
    );

    if (!creditResult.success) {
      await ctx.reply('❌ Error crediting gift code. Please try again or contact support.');
      return;
    }

    // Record usage
    const userRow = get('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
    run(
      `INSERT INTO gift_code_uses (code_id, user_id, telegram_id, reward_amount)
       VALUES (?, ?, ?, ?)`,
      [codeRow.id, userRow?.id || null, telegramId, codeRow.reward_amount]
    );

    // Increment used count
    run('UPDATE gift_codes SET used_count = used_count + 1 WHERE id = ?', [codeRow.id]);

    logger.info(`User ${telegramId} redeemed gift code ${codeRow.code} for ₹${codeRow.reward_amount}`);

    await ctx.reply(
      `🎉 *Congratulations!*\n\n` +
      `You have successfully redeemed *${codeRow.code}*!\n` +
      `💰 *Amount Added:* *${formatCurrency(codeRow.reward_amount)}*\n` +
      `💳 *New Balance:* *${formatCurrency(creditResult.balanceAfter)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error('Error redeeming gift code:', err);
    await ctx.reply('❌ An unexpected error occurred while redeeming the code.');
  }
}
