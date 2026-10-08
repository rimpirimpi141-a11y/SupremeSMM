import { query } from '../database.js';
import { formatCurrency, formatNumber } from '../utils/pricing.js';

export async function handleReferrals(ctx) {
  const telegramId = String(ctx.from.id);
  const botInfo = ctx.me || (await ctx.api.getMe());
  const botUsername = botInfo.username;

  const referralLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

  // Query referral statistics
  const refRows = query(
    'SELECT COUNT(*) as total_refs, COALESCE(SUM(reward_amount), 0) as total_earned FROM referrals WHERE referrer_id = ?',
    [telegramId]
  );

  const totalRefs = refRows[0]?.total_refs || 0;
  const totalEarned = refRows[0]?.total_earned || 0;

  const text = 
`👥 *Referral Program (10% Commission)*

Invite your friends and earn *10% commission on EVERY deposit* they make for life!

💰 *Commission Rate:* *10% on Every Deposit*
👥 *Total Referrals:* ${formatNumber(totalRefs)}
💰 *Total Referral Earnings:* *${formatCurrency(totalEarned)}*

🔗 *Your Personal Referral Link:*
\`${referralLink}\`

💡 _Example: When your friend deposits ₹100, you automatically get ₹10. When they deposit ₹500, you get ₹50 credited instantly to your balance!_`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}
