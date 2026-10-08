import { get, run } from '../database.js';
import { getMainMenuKeyboard, getPlatformsKeyboard } from '../keyboards.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

export async function handleStart(ctx) {
  // Strict private-chat check: NEVER show user menu or keyboards in groups/channels
  if (ctx.chat?.type !== 'private') {
    return ctx.reply('⚠️ Please open my private chat to use the bot.', {
      reply_markup: { remove_keyboard: true }
    });
  }

  const telegramId = String(ctx.from.id);
  const username = ctx.from.username ? `@${ctx.from.username}` : '';
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';

  // Check if user exists
  let user = get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);

  if (!user) {
    // Check referral param in /start payload
    let referrerId = null;
    const match = ctx.match; // Payload after /start
    if (match) {
      const rawRef = String(match).replace(/^ref_/, '').trim();
      if (rawRef && rawRef !== telegramId) {
        const potentialReferrer = get('SELECT id, telegram_id FROM users WHERE telegram_id = ?', [rawRef]);
        if (potentialReferrer) {
          referrerId = potentialReferrer.telegram_id;
        }
      }
    }

    run(
      `INSERT INTO users (telegram_id, username, first_name, last_name, balance, referrer_id)
       VALUES (?, ?, ?, ?, 0.0, ?)`,
      [telegramId, username, firstName, lastName, referrerId]
    );

    user = get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
    logger.bot(`New user registered: ${telegramId} (${firstName}) Referrer: ${referrerId || 'None'}`);

    if (referrerId) {
      // Record referral
      run(
        `INSERT OR IGNORE INTO referrals (referrer_id, referred_id, reward_amount, status)
         VALUES (?, ?, 0.0, 'Active')`,
        [referrerId, telegramId]
      );
    }
  } else {
    // Update name/username if changed
    run(
      `UPDATE users SET username = ?, first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
      [username, firstName, lastName, telegramId]
    );
  }

  // Clear any active session state
  if (ctx.session) {
    ctx.session.step = null;
    ctx.session.data = {};
  }

  const welcomeText = 
`🔥 *Welcome to ${CONFIG.BOT_NAME}!*

🚀 *Buy Social Media Services Easily*
💰 *Fast, Reliable & Secure*

👑 *Owner:* \`${CONFIG.BRAND_NAME}\`

👇 *Select an option from the menu below:*`;

  // Send main menu reply keyboard ONLY in private chat
  if (ctx.chat?.type === 'private') {
    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    });

    // Also show quick platform selector
    await ctx.reply('🛍️ *Quick Browse Services:*', {
      parse_mode: 'Markdown',
      reply_markup: getPlatformsKeyboard()
    });
  }
}
