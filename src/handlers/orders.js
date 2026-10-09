import { get, query, run } from '../database.js';
import { getOrderConfirmKeyboard, getDepositPromptKeyboard } from '../keyboards.js';
import { calculatePrice, formatCurrency, formatNumber } from '../utils/pricing.js';
import { deductBalance, generateOrderCode, getUserBalance } from '../utils/transactions.js';
import { logger } from '../utils/logger.js';
import { CONFIG, PERMANENT_SUPER_ADMIN_ID } from '../config.js';

// In-memory order drafts for confirmation steps
const activeDrafts = new Map();

export async function handleStartOrder(ctx, serviceId) {
  const service = get('SELECT * FROM services WHERE id = ? AND is_active = 1', [serviceId]);

  if (!service) {
    await ctx.answerCallbackQuery({ text: 'Service is currently unavailable.' });
    return;
  }

  const telegramId = String(ctx.from.id);
  const currentBalance = getUserBalance(telegramId);

  ctx.session.step = 'awaiting_order_target';
  ctx.session.data = {
    serviceId: service.id,
    serviceName: service.name,
    platform: service.platform,
    pricePerK: service.price_per_k,
    minQuantity: service.min_quantity,
    maxQuantity: service.max_quantity,
    instructions: service.instructions
  };

  const text = 
`🛍️ *Service:* ${service.name}
💰 *Price:* ${formatCurrency(service.price_per_k)} / 1,000
📦 *Minimum:* ${formatNumber(service.min_quantity)}
📦 *Maximum:* ${formatNumber(service.max_quantity)}
💳 *Your Balance:* ${formatCurrency(currentBalance)}

📌 *Instructions:* ${service.instructions || 'Public link only'}

🔗 *Please send the target link or username:*`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
  await ctx.answerCallbackQuery();
}

export async function handleOrderTargetInput(ctx) {
  const target = ctx.message.text.trim();
  if (target.length < 3) {
    await ctx.reply('⚠️ Please provide a valid target link or username.');
    return;
  }

  ctx.session.data.target = target;
  ctx.session.step = 'awaiting_order_quantity';

  const data = ctx.session.data;
  await ctx.reply(
    `✅ *Target Received:*\n\`${target}\`\n\n🔢 *Enter the quantity you wish to order:*\n_(Min: ${formatNumber(data.minQuantity)} | Max: ${formatNumber(data.maxQuantity)})_`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleOrderQuantityInput(ctx) {
  const rawInput = ctx.message.text.trim().replace(/,/g, '');
  const quantity = parseInt(rawInput, 10);
  const data = ctx.session.data;

  if (isNaN(quantity) || quantity <= 0) {
    await ctx.reply('⚠️ Please enter a valid numerical quantity.');
    return;
  }

  if (quantity < data.minQuantity || quantity > data.maxQuantity) {
    await ctx.reply(
      `⚠️ *Invalid Quantity!*\nQuantity must be between *${formatNumber(data.minQuantity)}* and *${formatNumber(data.maxQuantity)}*.\n\nPlease enter the quantity again:`
    );
    return;
  }

  const telegramId = String(ctx.from.id);
  const totalAmount = calculatePrice(data.pricePerK, quantity);
  const currentBalance = getUserBalance(telegramId);

  // Check balance
  if (currentBalance < totalAmount) {
    const shortage = Math.round((totalAmount - currentBalance) * 100) / 100;
    ctx.session.step = null;
    ctx.session.data = {};

    await ctx.reply(
      `❌ *Insufficient Balance!*\n\n` +
      `🛍️ *Service:* ${data.serviceName}\n` +
      `📦 *Quantity:* ${formatNumber(quantity)}\n` +
      `💰 *Total Cost:* ${formatCurrency(totalAmount)}\n` +
      `💳 *Your Balance:* ${formatCurrency(currentBalance)}\n` +
      `⚠️ *Shortage:* ${formatCurrency(shortage)}\n\n` +
      `Please deposit funds to complete this order.`,
      {
        parse_mode: 'Markdown',
        reply_markup: getDepositPromptKeyboard()
      }
    );
    return;
  }

  // Create draft confirmation
  const draftId = `draft_${Date.now()}_${telegramId}`;
  activeDrafts.set(draftId, {
    telegramId,
    serviceId: data.serviceId,
    serviceName: data.serviceName,
    platform: data.platform,
    target: data.target,
    quantity,
    totalAmount,
    createdAt: Date.now()
  });

  ctx.session.step = null;
  ctx.session.data = {};

  const summaryText = 
`📦 *Order Summary & Confirmation*

🛍️ *Service:* ${data.serviceName}
🌐 *Platform:* ${data.platform}
🔗 *Target:* \`${data.target}\`
🔢 *Quantity:* ${formatNumber(quantity)}
💰 *Total Amount:* *${formatCurrency(totalAmount)}*
💳 *Current Balance:* ${formatCurrency(currentBalance)}
💵 *Balance After Order:* ${formatCurrency(currentBalance - totalAmount)}

_Press Confirm to place your order immediately._`;

  await ctx.reply(summaryText, {
    parse_mode: 'Markdown',
    reply_markup: getOrderConfirmKeyboard(draftId)
  });
}

export async function handleConfirmOrder(ctx, draftId) {
  const draft = activeDrafts.get(draftId);
  if (!draft) {
    await ctx.answerCallbackQuery({ text: 'Order draft expired or already processed.' });
    return;
  }

  const telegramId = String(ctx.from.id);
  if (draft.telegramId !== telegramId) {
    await ctx.answerCallbackQuery({ text: 'Unauthorized order confirmation.' });
    return;
  }

  // Deduct balance safely with atomic transaction
  const deductResult = deductBalance(
    telegramId,
    draft.totalAmount,
    'ORDER_PAYMENT',
    `Order for ${draft.serviceName} (${draft.quantity})`,
    draftId
  );

  if (!deductResult.success) {
    await ctx.editMessageText(
      `❌ *Order Failed:* ${deductResult.message || 'Insufficient balance.'}\n\nPlease check your balance or deposit funds.`,
      { parse_mode: 'Markdown' }
    );
    activeDrafts.delete(draftId);
    await ctx.answerCallbackQuery();
    return;
  }

  // Generate unique order ID
  const orderCode = generateOrderCode();

  // Save order to SQLite
  run(
    `INSERT INTO orders (order_code, telegram_id, service_id, service_name, platform, target, quantity, amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
    [orderCode, telegramId, draft.serviceId, draft.serviceName, draft.platform, draft.target, draft.quantity, draft.totalAmount]
  );

  // Increment total orders count for user
  run('UPDATE users SET total_orders = total_orders + 1 WHERE telegram_id = ?', [telegramId]);

  activeDrafts.delete(draftId);

  const receiptText = 
`🎉 *Order Placed Successfully!*

🆔 *Order ID:* \`${orderCode}\`
🛍️ *Service:* ${draft.serviceName}
🌐 *Platform:* ${draft.platform}
🔗 *Target:* \`${draft.target}\`
🔢 *Quantity:* ${formatNumber(draft.quantity)}
💰 *Amount Paid:* ${formatCurrency(draft.totalAmount)}
💳 *Remaining Balance:* ${formatCurrency(deductResult.balanceAfter)}
⏳ *Status:* 🟡 *Pending*

_Our system is processing your order. You can track status anytime under 👤 Profile -> 📦 My Orders._`;

  await ctx.editMessageText(receiptText, { parse_mode: 'Markdown' });
  await ctx.answerCallbackQuery({ text: 'Order placed successfully!' });

  // Notify admin
  const targetAdminId = String(CONFIG.ADMIN_TELEGRAM_ID || PERMANENT_SUPER_ADMIN_ID).trim();
  if (targetAdminId) {
    try {
      await ctx.api.sendMessage(
        targetAdminId,
        `🔔 *NEW ORDER RECEIVED!*\n\n` +
        `🆔 *Order Code:* \`${orderCode}\`\n` +
        `👤 *User:* \`${telegramId}\` (@${ctx.from.username || 'N/A'})\n` +
        `🛍️ *Service:* ${draft.serviceName}\n` +
        `🔗 *Target:* \`${draft.target}\`\n` +
        `🔢 *Quantity:* ${formatNumber(draft.quantity)}\n` +
        `💰 *Amount:* ${formatCurrency(draft.totalAmount)}`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      logger.error('Failed to notify admin of new order:', e);
    }
  }
}

export async function handleCancelOrder(ctx, draftId) {
  activeDrafts.delete(draftId);
  await ctx.editMessageText('❌ *Order has been cancelled.*', { parse_mode: 'Markdown' });
  await ctx.answerCallbackQuery({ text: 'Order cancelled' });
}

export async function showMyOrders(ctx) {
  const telegramId = String(ctx.from.id);
  const orders = query(
    'SELECT * FROM orders WHERE telegram_id = ? ORDER BY id DESC LIMIT 10',
    [telegramId]
  );

  if (orders.length === 0) {
    const text = '📦 *My Orders*\n\nYou have not placed any orders yet. Browse 🛍️ Services to place your first order!';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown' });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    }
    return;
  }

  let text = `📦 *Your Recent Orders (Last 10):*\n\n`;
  for (const ord of orders) {
    const statusEmoji = {
      Pending: '🟡',
      Processing: '⏳',
      Completed: '✅',
      Cancelled: '❌',
      Refunded: '💰'
    }[ord.status] || '⚪';

    text += `🔹 *Order:* \`${ord.order_code}\`\n`;
    text += `   🛍️ Service: ${ord.service_name}\n`;
    text += `   🔢 Qty: ${formatNumber(ord.quantity)} | 💰 ${formatCurrency(ord.amount)}\n`;
    text += `   🔗 Target: \`${ord.target}\`\n`;
    text += `   ${statusEmoji} Status: *${ord.status}*\n`;
    text += `   📅 Date: ${ord.created_at}\n\n`;
  }

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}
