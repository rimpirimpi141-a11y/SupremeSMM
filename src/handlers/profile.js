import { get, query } from '../database.js';
import { getProfileKeyboard } from '../keyboards.js';
import { formatCurrency, formatNumber } from '../utils/pricing.js';

export async function handleProfile(ctx) {
  const telegramId = String(ctx.from.id);
  const user = get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);

  if (!user) {
    await ctx.reply('⚠️ Profile not found. Please send /start to register.');
    return;
  }

  // Count referrals
  const refCount = query('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?', [telegramId]);
  const referralsCount = refCount[0]?.cnt || 0;

  // Count orders
  const ordCount = query('SELECT COUNT(*) as cnt FROM orders WHERE telegram_id = ?', [telegramId]);
  const totalOrders = ordCount[0]?.cnt || 0;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || ctx.from.first_name || 'User';

  const profileText = 
`👤 *User Profile*

👤 *Name:* ${fullName} ${user.username ? `(${user.username})` : ''}
🆔 *Telegram ID:* \`${user.telegram_id}\`
💰 *Balance:* *${formatCurrency(user.balance)}*
📦 *Total Orders:* ${formatNumber(totalOrders)}
👥 *Referrals:* ${formatNumber(referralsCount)}
📅 *Joined Date:* ${user.created_at || 'Recently'}

👇 *Manage your account below:*`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(profileText, {
      parse_mode: 'Markdown',
      reply_markup: getProfileKeyboard()
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(profileText, {
      parse_mode: 'Markdown',
      reply_markup: getProfileKeyboard()
    });
  }
}
