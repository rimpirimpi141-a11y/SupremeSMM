import { getSetting } from '../database.js';
import { getSupportKeyboard } from '../keyboards.js';
import { CONFIG } from '../config.js';

export async function handleSupport(ctx) {
  const supportUsername = (getSetting('support_username', CONFIG.SUPPORT_USERNAME || 'SupremeSupport')).replace('@', '');

  const text = 
`🆘 *Customer Support & Help Desk*

👑 *Brand:* \`${CONFIG.BRAND_NAME}\`
🤖 *Bot:* \`${CONFIG.BOT_NAME}\`

Need assistance with your orders, payment verification, balance deposit, or custom high-volume services?

Our support team is available to assist you 24/7.

💬 *Support Contact:* @${supportUsername}

_Click the button below to message our support directly:_`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: getSupportKeyboard(supportUsername)
      });
      await ctx.answerCallbackQuery();
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: getSupportKeyboard(supportUsername)
      });
    }
  } else {
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: getSupportKeyboard(supportUsername)
    });
  }
}
