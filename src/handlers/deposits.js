import { get, getSetting, query, run, transaction } from '../database.js';
import { getDepositDecisionKeyboard, getPaymentMethodsKeyboard, getSkipUtrKeyboard } from '../keyboards.js';
import { formatCurrency } from '../utils/pricing.js';
import { creditBalance, generateDepositCode, getUserBalance } from '../utils/transactions.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

export async function startDeposit(ctx) {
  const telegramId = String(ctx.from.id);
  const currentBalance = getUserBalance(telegramId);
  const minDeposit = parseFloat(getSetting('min_deposit', String(CONFIG.DEFAULT_MIN_DEPOSIT)));

  ctx.session.step = 'awaiting_deposit_amount';
  ctx.session.data = { minDeposit };

  const text = 
`💳 *Deposit Funds*

💰 *Current Balance:* *${formatCurrency(currentBalance)}*
📉 *Minimum Deposit:* *${formatCurrency(minDeposit)}*

👇 *Enter the amount (in ₹) you want to deposit:*`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown' });
      await ctx.answerCallbackQuery();
    } catch (e) {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}

export async function handleDepositAmountInput(ctx) {
  const rawInput = ctx.message.text.trim().replace(/[^0-9.]/g, '');
  const amount = parseFloat(rawInput);
  const minDeposit = ctx.session.data?.minDeposit || CONFIG.DEFAULT_MIN_DEPOSIT;

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('⚠️ Please enter a valid deposit amount in numbers.');
    return;
  }

  if (amount < minDeposit) {
    await ctx.reply(`⚠️ Minimum deposit amount is *${formatCurrency(minDeposit)}*. Please enter an amount equal or higher:`, {
      parse_mode: 'Markdown'
    });
    return;
  }

  ctx.session.data.amount = amount;

  // Fetch active payment methods
  const methods = query('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id ASC');

  if (methods.length === 0) {
    // Fallback default
    return renderPaymentInstruction(ctx, {
      id: 0,
      name: 'UPI / QR Payment',
      qr_file_id: null,
      upi_id: getSetting('upi_id', CONFIG.DEFAULT_UPI_ID),
      instructions: getSetting('payment_instructions', CONFIG.DEFAULT_PAYMENT_INSTRUCTIONS)
    });
  }

  if (methods.length === 1) {
    return renderPaymentInstruction(ctx, methods[0]);
  }

  // If multiple methods, let user select
  ctx.session.step = 'awaiting_deposit_method_select';
  await ctx.reply(
    `💳 *Select Payment Method*\n\nDeposit Amount: *${formatCurrency(amount)}*\n\nPlease choose your preferred payment option below:`,
    {
      parse_mode: 'Markdown',
      reply_markup: getPaymentMethodsKeyboard(methods)
    }
  );
}

export async function handleSelectPaymentMethod(ctx, methodId) {
  const method = get('SELECT * FROM payment_methods WHERE id = ?', [methodId]);
  if (!method) {
    await ctx.answerCallbackQuery({ text: 'Payment method not found.' });
    return;
  }
  await renderPaymentInstruction(ctx, method);
  await ctx.answerCallbackQuery();
}

async function renderPaymentInstruction(ctx, method) {
  const amount = ctx.session.data.amount;
  const depositCode = generateDepositCode();

  ctx.session.data.depositCode = depositCode;
  ctx.session.data.methodId = method.id;
  ctx.session.data.methodName = method.name;
  ctx.session.step = 'awaiting_deposit_screenshot';

  const caption = 
`💳 *Make Payment & Submit Proof*

🆔 *Deposit Code:* \`${depositCode}\`
💰 *Amount to Pay:* *${formatCurrency(amount)}*
💳 *Payment Method:* ${method.name}
${method.upi_id ? `📱 *UPI ID / Account:* \`${method.upi_id}\`\n` : ''}
📝 *Instructions:*
_${method.instructions || 'Scan QR / transfer exact amount, then upload screenshot.'}_

📸 *Please send the payment screenshot image now:*`;

  if (method.qr_file_id) {
    try {
      await ctx.api.sendPhoto(ctx.chat.id, method.qr_file_id, {
        caption,
        parse_mode: 'Markdown'
      });
      return;
    } catch (err) {
      logger.error('Failed to send QR image, sending text fallback:', err);
    }
  }

  await ctx.reply(caption, { parse_mode: 'Markdown' });
}

export async function handleDepositScreenshotInput(ctx) {
  let proofFileId = null;

  if (ctx.message.photo && ctx.message.photo.length > 0) {
    // Highest resolution photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    proofFileId = photo.file_id;
  } else if (ctx.message.document) {
    proofFileId = ctx.message.document.file_id;
  } else {
    await ctx.reply('⚠️ Please upload a screenshot image or document of your payment.');
    return;
  }

  ctx.session.data.proofFileId = proofFileId;
  ctx.session.step = 'awaiting_deposit_utr';

  await ctx.reply(
    `✅ *Screenshot Received!*\n\n🔢 *Enter UTR / Transaction ID (Optional):*\nIf you have the 12-digit UTR/Txn ID, type it below.\nOtherwise, you can skip this step:`,
    {
      parse_mode: 'Markdown',
      reply_markup: getSkipUtrKeyboard()
    }
  );
}

export async function handleDepositUtrInput(ctx, isSkipped = false) {
  const telegramId = String(ctx.from.id);
  const data = ctx.session.data;

  if (!data || !data.depositCode || !data.amount) {
    ctx.session.step = null;
    await ctx.reply('⚠️ Deposit session expired. Please click 💳 Deposit to try again.');
    return;
  }

  const utrText = isSkipped ? 'Skipped' : (ctx.message?.text?.trim() || 'Provided');

  // Save deposit to SQLite
  const userRow = get('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
  run(
    `INSERT INTO deposits (deposit_code, user_id, telegram_id, amount, payment_method_name, status, proof_file_id, utr_reference)
     VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)`,
    [data.depositCode, userRow?.id || null, telegramId, data.amount, data.methodName || 'UPI', data.proofFileId, utrText]
  );

  const depositRow = get('SELECT id FROM deposits WHERE deposit_code = ?', [data.depositCode]);

  ctx.session.step = null;
  ctx.session.data = {};

  const confirmationMsg = 
`✅ *Payment Proof Submitted!*

🆔 *Deposit ID:* \`${data.depositCode}\`
💰 *Amount:* *${formatCurrency(data.amount)}*
🔢 *UTR / Ref:* \`${utrText}\`
⏳ *Status:* 🟡 *Pending Admin Verification*

_Our team is verifying your payment. Once approved, your wallet balance will be credited automatically!_`;

  if (isSkipped && ctx.callbackQuery) {
    await ctx.editMessageText(confirmationMsg, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery({ text: 'Deposit submitted!' });
  } else {
    await ctx.reply(confirmationMsg, { parse_mode: 'Markdown' });
  }

  // Notify Super Admin
  if (CONFIG.ADMIN_TELEGRAM_ID && depositRow) {
    try {
      const senderName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'User';
      const adminMsg = 
`💳 *NEW DEPOSIT REQUEST!*

🆔 *Deposit Code:* \`${data.depositCode}\`
👤 *User:* ${senderName} (@${ctx.from.username || 'NoUsername'})
🆔 *Telegram ID:* \`${telegramId}\`
💰 *Amount:* *${formatCurrency(data.amount)}*
💳 *Method:* ${data.methodName || 'UPI'}
🔢 *UTR / Ref:* \`${utrText}\``;

      if (data.proofFileId) {
        await ctx.api.sendPhoto(CONFIG.ADMIN_TELEGRAM_ID, data.proofFileId, {
          caption: adminMsg,
          parse_mode: 'Markdown',
          reply_markup: getDepositDecisionKeyboard(depositRow.id)
        });
      } else {
        await ctx.api.sendMessage(CONFIG.ADMIN_TELEGRAM_ID, adminMsg, {
          parse_mode: 'Markdown',
          reply_markup: getDepositDecisionKeyboard(depositRow.id)
        });
      }
    } catch (e) {
      logger.error('Failed to notify admin of deposit:', e);
    }
  }
}

export async function handleAdminApproveDeposit(ctx, depositId) {
  let deposit;
  let creditResult;
  let referrerBonusInfo = null;

  try {
    transaction(() => {
      deposit = get('SELECT * FROM deposits WHERE id = ?', [depositId]);

      if (!deposit) {
        throw new Error('Deposit record not found');
      }

      if (deposit.status !== 'Pending') {
        throw new Error(`Deposit is already ${deposit.status}`);
      }

      // Mark Approved first inside transaction
      run('UPDATE deposits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['Approved', depositId]);

      // Credit depositing user's balance
      creditResult = creditBalance(
        deposit.telegram_id,
        deposit.amount,
        'DEPOSIT_APPROVED',
        `Approved deposit ${deposit.deposit_code}`,
        deposit.deposit_code
      );

      if (!creditResult.success) {
        throw new Error('Failed to credit user balance');
      }

      // Check for locked Referrer -> calculate commission on EVERY approved deposit
      const user = get('SELECT referrer_id, id, first_name FROM users WHERE telegram_id = ?', [deposit.telegram_id]);
      if (user && user.referrer_id && String(user.referrer_id).trim() !== String(deposit.telegram_id).trim()) {
        const commissionRate = parseFloat(getSetting('referral_commission_percent', '10')) / 100;
        const commissionAmount = Math.round((Number(deposit.amount) * commissionRate) * 100) / 100;

        if (commissionAmount > 0) {
          const percentLabel = getSetting('referral_commission_percent', '10');
          const refCredit = creditBalance(
            user.referrer_id,
            commissionAmount,
            'REFERRAL_COMMISSION',
            `${percentLabel}% referral commission for deposit ${deposit.deposit_code} from ${deposit.telegram_id}`,
            deposit.deposit_code
          );

          if (refCredit.success) {
            run(
              'UPDATE referrals SET reward_amount = reward_amount + ? WHERE referrer_id = ? AND referred_id = ?',
              [commissionAmount, user.referrer_id, deposit.telegram_id]
            );

            referrerBonusInfo = {
              referrerId: user.referrer_id,
              commissionAmount,
              percentLabel,
              newBalance: refCredit.balanceAfter,
              referredUser: deposit.telegram_id
            };
          }
        }
      }
    });
  } catch (err) {
    logger.error('Error in handleAdminApproveDeposit:', err);
    await ctx.answerCallbackQuery({ text: err.message || 'Error approving deposit.' });
    return;
  }

  // Notify Depositing User
  try {
    await ctx.api.sendMessage(
      deposit.telegram_id,
      `🎉 *Deposit Approved!*\n\n` +
      `Your deposit of *${formatCurrency(deposit.amount)}* has been verified and added to your balance.\n` +
      `💰 *New Balance:* *${formatCurrency(creditResult.balanceAfter)}*\n\n` +
      `You can now browse 🛍️ Services and place orders!`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    logger.error('Failed to notify user of approved deposit:', e);
  }

  // Notify Referrer if referral commission was credited
  if (referrerBonusInfo) {
    try {
      await ctx.api.sendMessage(
        referrerBonusInfo.referrerId,
        `🎁 *${referrerBonusInfo.percentLabel}% Referral Commission Received!*\n\n` +
        `Your referred friend (\`${referrerBonusInfo.referredUser}\`) made a deposit of *${formatCurrency(deposit.amount)}*.\n` +
        `💰 *Commission Added (${referrerBonusInfo.percentLabel}%):* *${formatCurrency(referrerBonusInfo.commissionAmount)}*\n` +
        `💳 *Your New Balance:* *${formatCurrency(referrerBonusInfo.newBalance)}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      logger.error('Failed to notify referrer:', e);
    }
  }

  const updatedCaption = 
`✅ *DEPOSIT APPROVED*

🆔 *Code:* \`${deposit.deposit_code}\`
👤 *User:* \`${deposit.telegram_id}\`
💰 *Amount:* *${formatCurrency(deposit.amount)}*
💳 *Status:* ✅ Approved
${referrerBonusInfo ? `🎁 *10% Referral Commission:* ${formatCurrency(referrerBonusInfo.commissionAmount)} sent to \`${referrerBonusInfo.referrerId}\`` : ''}`;

  if (ctx.callbackQuery?.message?.photo) {
    try {
      await ctx.editMessageCaption({ caption: updatedCaption, parse_mode: 'Markdown' });
    } catch (e) {}
  } else {
    try {
      await ctx.editMessageText(updatedCaption, { parse_mode: 'Markdown' });
    } catch (e) {}
  }

  await ctx.answerCallbackQuery({ text: `Deposit ${deposit.deposit_code} approved!` });
}

export async function handleAdminRejectDeposit(ctx, depositId) {
  const deposit = get('SELECT * FROM deposits WHERE id = ?', [depositId]);

  if (!deposit) {
    await ctx.answerCallbackQuery({ text: 'Deposit record not found.' });
    return;
  }

  if (deposit.status !== 'Pending') {
    await ctx.answerCallbackQuery({ text: `Deposit already ${deposit.status}.` });
    return;
  }

  run('UPDATE deposits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['Rejected', depositId]);

  // Notify User
  try {
    await ctx.api.sendMessage(
      deposit.telegram_id,
      `❌ *Deposit Request Rejected*\n\n` +
      `Your deposit request \`${deposit.deposit_code}\` for *${formatCurrency(deposit.amount)}* could not be verified.\n\n` +
      `If you need assistance, please contact 🆘 Support.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    logger.error('Failed to notify user of rejected deposit:', e);
  }

  const rejectedCaption = 
`❌ *DEPOSIT REJECTED*

🆔 *Code:* \`${deposit.deposit_code}\`
👤 *User:* \`${deposit.telegram_id}\`
💰 *Amount:* *${formatCurrency(deposit.amount)}*
❌ *Status:* Rejected`;

  if (ctx.callbackQuery?.message?.photo) {
    try {
      await ctx.editMessageCaption({ caption: rejectedCaption, parse_mode: 'Markdown' });
    } catch (e) {}
  } else {
    try {
      await ctx.editMessageText(rejectedCaption, { parse_mode: 'Markdown' });
    } catch (e) {}
  }

  await ctx.answerCallbackQuery({ text: `Deposit ${deposit.deposit_code} rejected.` });
}
