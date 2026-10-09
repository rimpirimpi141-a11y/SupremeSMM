import { InlineKeyboard } from 'grammy';
import { 
  get, 
  getSetting, 
  isAdminUser, 
  isSuperAdmin, 
  query, 
  run, 
  setSetting 
} from '../database.js';
import { 
  getAdminReplyKeyboard,
  getAdminUsersReplyKeyboard,
  getAdminForceChannelReplyKeyboard,
  getAdminPaymentMethodsReplyKeyboard,
  getAdminAdminsReplyKeyboard,
  getAdminSettingsReplyKeyboard,
  getAdminServicesMenuKeyboard,
  getAdminOrdersMenuKeyboard,
  getAdminDepositsMenuKeyboard,
  getAdminGiftCodesMenuKeyboard,
  getOrderManagementKeyboard,
  getDepositDecisionKeyboard,
  getMainMenuKeyboard
} from '../keyboards.js';
import { formatCurrency, formatNumber } from '../utils/pricing.js';
import { creditBalance, deductBalance } from '../utils/transactions.js';
import { logger } from '../utils/logger.js';
import { CONFIG, PERMANENT_SUPER_ADMIN_ID } from '../config.js';

/* ==========================================================================
   ADMIN ROOT DASHBOARD
   ========================================================================== */
export async function handleAdminCommand(ctx) {
  // Strict private-chat check: NEVER show admin panel or keyboards in groups/channels
  if (ctx.chat?.type !== 'private') {
    return ctx.reply('⚠️ Please open my private chat to use the bot.', {
      reply_markup: { remove_keyboard: true }
    });
  }

  const telegramId = String(ctx.from.id);
  if (!isAdminUser(telegramId)) {
    await ctx.reply('❌ You are not authorized to access the admin panel.');
    return;
  }

  // Clear any existing session step
  if (ctx.session) {
    ctx.session.adminStep = null;
    ctx.session.adminData = {};
  }

  const superAdminFlag = isSuperAdmin(telegramId);
  const text = 
`👑 *${CONFIG.BRAND_NAME} — Admin Dashboard*

Welcome to the central control panel.
👤 *Role:* ${superAdminFlag ? '🌟 Super Admin' : '🛡️ Administrator'}

Select any management category from the bottom menu below:`;

  if (ctx.chat?.type === 'private') {
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: getAdminReplyKeyboard()
    });
  }
}

/* ==========================================================================
   SUBMENU ROUTERS (REPLY KEYBOARDS)
   ========================================================================== */
export async function showAdminUsersMenu(ctx) {
  if (ctx.chat?.type !== 'private') return;
  ctx.session.adminStep = null;
  ctx.session.adminData = {};

  const totalUsers = query('SELECT COUNT(*) as cnt FROM users')[0]?.cnt || 0;
  const bannedUsers = query('SELECT COUNT(*) as cnt FROM users WHERE is_banned = 1')[0]?.cnt || 0;

  const text = 
`👤 *User Management*

👥 *Total Users:* ${formatNumber(totalUsers)}
🚫 *Banned Users:* ${formatNumber(bannedUsers)}

Choose an action from the menu below:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminUsersReplyKeyboard()
  });
}

export async function showAdminForceChannelMenu(ctx) {
  if (ctx.chat?.type !== 'private') return;
  ctx.session.adminStep = null;
  ctx.session.adminData = {};

  const isEnabled = getSetting('force_join_enabled', '0') === '1';
  const channels = query('SELECT * FROM force_channels ORDER BY id ASC');

  let text = 
`📢 *Force Channel Settings*

⚡ *Force Join Status:* ${isEnabled ? '🟢 ENABLED (Active)' : '🔴 DISABLED (Inactive)'}
📋 *Configured Channels:* ${channels.length}\n\n`;

  if (channels.length > 0) {
    for (const ch of channels) {
      const status = ch.is_active ? '🟢' : '🔴';
      text += `${status} *${ch.channel_username}* (${ch.channel_title || 'Channel'})\n`;
    }
  } else {
    text += `_No channels added yet. Click ➕ Add Force Channel to add your first channel._\n`;
  }

  text += `\nSelect an option below:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminForceChannelReplyKeyboard()
  });
}

export async function showAdminPaymentMethodsMenu(ctx) {
  if (ctx.chat?.type !== 'private') return;
  ctx.session.adminStep = null;
  ctx.session.adminData = {};

  const methods = query('SELECT * FROM payment_methods ORDER BY id ASC');

  let text = 
`💳 *Payment Methods & QR Settings*

Configured options shown to users under 💳 Deposit:
📊 *Total Methods:* ${methods.length}\n\n`;

  for (const m of methods) {
    const status = m.is_active ? '🟢' : '🔴';
    const hasQr = m.qr_file_id ? '📷 QR Attached' : '❌ No QR';
    text += `${status} *#${m.id} ${m.name}* (${hasQr})\n`;
    if (m.upi_id) text += `   UPI: \`${m.upi_id}\`\n`;
  }

  text += `\nSelect an option below:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminPaymentMethodsReplyKeyboard()
  });
}

export async function showAdminManageAdminsMenu(ctx) {
  if (ctx.chat?.type !== 'private') return;
  const telegramId = String(ctx.from.id);
  if (!isSuperAdmin(telegramId)) {
    await ctx.reply('⛔ *Access Denied:* Only the Super Admin can manage administrators.', { parse_mode: 'Markdown' });
    return;
  }

  ctx.session.adminStep = null;
  ctx.session.adminData = {};

  const superAdminId = String(CONFIG.ADMIN_TELEGRAM_ID || PERMANENT_SUPER_ADMIN_ID).trim();
  const admins = query('SELECT * FROM admins ORDER BY added_at ASC');

  let text = 
`👑 *Manage Administrators*

🌟 *Super Admin ID:* \`${superAdminId}\`
🛡️ *Regular Admins:* ${admins.filter(a => String(a.telegram_id).trim() !== superAdminId).length}\n\n`;

  for (const a of admins) {
    const isOwner = String(a.telegram_id).trim() === superAdminId || a.role === 'owner';
    const roleIcon = isOwner ? '🌟' : '🛡️';
    text += `${roleIcon} \`${a.telegram_id}\` ${a.name ? `(${a.name})` : ''} ${a.username ? `[@${a.username.replace('@', '')}]` : ''} ${isOwner ? '_(Super Admin)_' : ''}\n`;
  }

  text += `\nSelect an option below:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminAdminsReplyKeyboard()
  });
}

export async function showAdminSettingsMenu(ctx) {
  if (ctx.chat?.type !== 'private') return;
  ctx.session.adminStep = null;
  ctx.session.adminData = {};

  const forceJoin = getSetting('force_join_enabled', '0') === '1' ? '🟢 ENABLED' : '🔴 DISABLED';
  const minDep = getSetting('min_deposit', String(CONFIG.DEFAULT_MIN_DEPOSIT));
  const refPercent = getSetting('referral_commission_percent', '10');
  const supportUser = getSetting('support_username', CONFIG.SUPPORT_USERNAME || 'SUPREMEXAURA01');

  const text = 
`⚙️ *System Settings*

📢 *Force Join:* ${forceJoin}
💵 *Referral Commission:* *${refPercent}% on Every Deposit*
💰 *Min Deposit:* *${formatCurrency(minDep)}*
🆘 *Support Username:* @${supportUser}

Select a setting below to edit:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminSettingsReplyKeyboard()
  });
}

/* ==========================================================================
   FORCE CHANNEL MANAGEMENT
   ========================================================================== */
export async function startAddForceChannel(ctx) {
  ctx.session.adminStep = 'awaiting_fc_username';
  ctx.session.adminData = {};

  await ctx.reply(
    `➕ *Add Force Channel*\n\nPlease send the *Channel Username* (e.g. \`@MyChannel\` or \`MyChannel\`):\n\n_Make sure the bot has been added as an Administrator in that channel so it can verify member subscriptions._`,
    { parse_mode: 'Markdown' }
  );
}

export async function toggleForceJoin(ctx) {
  const current = getSetting('force_join_enabled', '0');
  const next = current === '1' ? '0' : '1';
  setSetting('force_join_enabled', next);

  const statusMsg = next === '1' ? '🟢 *Force Join has been ENABLED!* Users must join required channels before using the bot.' : '🔴 *Force Join has been DISABLED!* All users can access without restriction.';

  await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
  await showAdminForceChannelMenu(ctx);
}

export async function listForceChannels(ctx) {
  const channels = query('SELECT * FROM force_channels ORDER BY id ASC');

  if (channels.length === 0) {
    await ctx.reply('📋 *No force channels configured yet.*', { parse_mode: 'Markdown' });
    return;
  }

  let text = `📋 *Force Channels List (${channels.length}):*\n\n`;
  for (const ch of channels) {
    const status = ch.is_active ? '🟢 Active' : '🔴 Inactive';
    text += `🔹 *ID #${ch.id}:* ${ch.channel_username}\n`;
    text += `   Title: ${ch.channel_title || 'N/A'}\n`;
    text += `   Status: ${status}\n\n`;
  }

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function promptRemoveForceChannel(ctx) {
  const channels = query('SELECT * FROM force_channels ORDER BY id ASC');

  if (channels.length === 0) {
    await ctx.reply('📋 *No force channels available to remove.*', { parse_mode: 'Markdown' });
    return;
  }

  const kb = new InlineKeyboard();
  for (const ch of channels) {
    kb.text(`🗑️ Remove ${ch.channel_username}`, `adm_fc_del_${ch.id}`).row();
  }

  await ctx.reply('🗑️ *Select a force channel to remove:*', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
}

/* ==========================================================================
   PAYMENT METHODS & QR
   ========================================================================== */
export async function startAddQrMethod(ctx) {
  ctx.session.adminStep = 'awaiting_pm_name';
  ctx.session.adminData = {};

  await ctx.reply(
    `➕ *Add QR Payment Method*\n\nStep 1/4: Enter the *Payment Method Name* (e.g. \`Google Pay / PhonePe QR\`):`,
    { parse_mode: 'Markdown' }
  );
}

export async function viewAllQrMethods(ctx) {
  const methods = query('SELECT * FROM payment_methods ORDER BY id ASC');

  if (methods.length === 0) {
    await ctx.reply('📋 *No payment methods configured yet.*', { parse_mode: 'Markdown' });
    return;
  }

  for (const m of methods) {
    const caption = 
`💳 *Payment Method #${m.id}: ${m.name}*

⚡ *Status:* ${m.is_active ? '🟢 Active' : '🔴 Inactive'}
📱 *UPI ID:* \`${m.upi_id || 'None'}\`
📝 *Instructions:* ${m.instructions || 'Scan QR / transfer and upload screenshot.'}`;

    if (m.qr_file_id) {
      try {
        await ctx.api.sendPhoto(ctx.chat.id, m.qr_file_id, {
          caption,
          parse_mode: 'Markdown'
        });
      } catch (e) {
        await ctx.reply(caption, { parse_mode: 'Markdown' });
      }
    } else {
      await ctx.reply(caption, { parse_mode: 'Markdown' });
    }
  }
}

export async function promptEditQrMethod(ctx) {
  const methods = query('SELECT * FROM payment_methods ORDER BY id ASC');

  if (methods.length === 0) {
    await ctx.reply('📋 *No payment methods available to edit.*', { parse_mode: 'Markdown' });
    return;
  }

  const kb = new InlineKeyboard();
  for (const m of methods) {
    const status = m.is_active ? '🟢' : '🔴';
    kb.text(`${status} #${m.id} ${m.name}`, `adm_pmedit_${m.id}`).row();
  }

  await ctx.reply('✏️ *Select a Payment Method to Edit:*', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
}

export async function promptDeleteQrMethod(ctx) {
  const methods = query('SELECT * FROM payment_methods ORDER BY id ASC');

  if (methods.length === 0) {
    await ctx.reply('📋 *No payment methods available to delete.*', { parse_mode: 'Markdown' });
    return;
  }

  const kb = new InlineKeyboard();
  for (const m of methods) {
    kb.text(`🗑️ Delete #${m.id} ${m.name}`, `adm_pm_del_confirm_${m.id}`).row();
  }

  await ctx.reply('🗑️ *Select a Payment Method to Delete:*', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
}

/* ==========================================================================
   MANAGE ADMINS (SUPER ADMIN ONLY)
   ========================================================================== */
export async function startAddAdmin(ctx) {
  if (!isSuperAdmin(ctx.from.id)) {
    await ctx.reply('⛔ *Only the Super Admin can add administrators.*', { parse_mode: 'Markdown' });
    return;
  }

  ctx.session.adminStep = 'awaiting_newadmin_id';
  ctx.session.adminData = {};

  await ctx.reply(
    `➕ *Add New Administrator*\n\nEnter the *numerical Telegram ID* of the user you want to grant admin access to:\n_(e.g. \`123456789\`)_`,
    { parse_mode: 'Markdown' }
  );
}

export async function promptRemoveAdmin(ctx) {
  if (!isSuperAdmin(ctx.from.id)) {
    await ctx.reply('⛔ *Only the Super Admin can remove administrators.*', { parse_mode: 'Markdown' });
    return;
  }

  const superAdminId = String(CONFIG.ADMIN_TELEGRAM_ID || PERMANENT_SUPER_ADMIN_ID).trim();
  const admins = query('SELECT * FROM admins ORDER BY added_at ASC');
  const removable = admins.filter(a => {
    const tid = String(a.telegram_id).trim();
    return tid !== superAdminId && tid !== String(PERMANENT_SUPER_ADMIN_ID).trim() && a.role !== 'owner';
  });

  if (removable.length === 0) {
    await ctx.reply('📋 *No regular administrators to remove.*', { parse_mode: 'Markdown' });
    return;
  }

  const kb = new InlineKeyboard();
  for (const a of removable) {
    kb.text(`🗑️ Remove ${a.name || a.telegram_id}`, `adm_admin_del_${a.telegram_id}`).row();
  }

  await ctx.reply('🗑️ *Select an Administrator to Remove:*', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
}

export async function showAdminList(ctx) {
  const superAdminId = String(CONFIG.ADMIN_TELEGRAM_ID || PERMANENT_SUPER_ADMIN_ID).trim();
  const admins = query('SELECT * FROM admins ORDER BY added_at ASC');

  let text = `📋 *Administrator Directory:*\n\n`;
  text += `🌟 *Super Admin:* \`${superAdminId}\` (Protected - Permanent)\n\n`;

  for (const a of admins) {
    const tid = String(a.telegram_id).trim();
    if (tid === superAdminId || tid === String(PERMANENT_SUPER_ADMIN_ID).trim() || a.role === 'owner') continue;
    text += `🛡️ *Admin ID:* \`${a.telegram_id}\`\n`;
    text += `   Name: ${a.name || 'Not specified'}\n`;
    text += `   Username: ${a.username ? `@${a.username.replace('@', '')}` : 'N/A'}\n`;
    text += `   Added Date: ${a.added_at}\n\n`;
  }

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

/* ==========================================================================
   USER MANAGEMENT (SEARCH, BALANCE, BAN)
   ========================================================================== */
export async function startSearchUser(ctx) {
  ctx.session.adminStep = 'awaiting_user_search';
  ctx.session.adminData = {};

  await ctx.reply(
    `🔎 *Search User*\n\nEnter the *Telegram numerical ID* or *Username* of the user to inspect:`,
    { parse_mode: 'Markdown' }
  );
}

export async function startAddBalance(ctx) {
  ctx.session.adminStep = 'awaiting_user_addbal_id';
  ctx.session.adminData = {};

  await ctx.reply(
    `💰 *Add User Balance*\n\nEnter the *numerical Telegram ID* of the user:`,
    { parse_mode: 'Markdown' }
  );
}

export async function startDeductBalance(ctx) {
  ctx.session.adminStep = 'awaiting_user_dedbal_id';
  ctx.session.adminData = {};

  await ctx.reply(
    `➖ *Deduct User Balance*\n\nEnter the *numerical Telegram ID* of the user:`,
    { parse_mode: 'Markdown' }
  );
}

export async function startBanUser(ctx) {
  ctx.session.adminStep = 'awaiting_user_ban_id';
  ctx.session.adminData = {};

  await ctx.reply(
    `🚫 *Ban User*\n\nEnter the *numerical Telegram ID* of the user to suspend:`,
    { parse_mode: 'Markdown' }
  );
}

export async function startUnbanUser(ctx) {
  ctx.session.adminStep = 'awaiting_user_unban_id';
  ctx.session.adminData = {};

  await ctx.reply(
    `✅ *Unban User*\n\nEnter the *numerical Telegram ID* of the user to restore:`,
    { parse_mode: 'Markdown' }
  );
}

export async function showUserProfileAdmin(ctx, targetTelegramId) {
  const user = get('SELECT * FROM users WHERE telegram_id = ? OR username = ?', [String(targetTelegramId), `@${String(targetTelegramId).replace('@', '')}`]);

  if (!user) {
    await ctx.reply(`❌ User \`${targetTelegramId}\` not found in database.`, { parse_mode: 'Markdown' });
    return;
  }

  const ordCount = query('SELECT COUNT(*) as cnt FROM orders WHERE telegram_id = ?', [user.telegram_id])[0]?.cnt || 0;
  const refCount = query('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?', [user.telegram_id])[0]?.cnt || 0;

  const text = 
`👤 *User Details: ${user.telegram_id}*

🏷️ *Name:* ${user.first_name || ''} ${user.last_name || ''} ${user.username ? `(${user.username})` : ''}
💰 *Balance:* *${formatCurrency(user.balance)}*
📦 *Total Orders:* ${formatNumber(ordCount)}
💵 *Total Spent:* ${formatCurrency(user.total_spent)}
👥 *Referrals:* ${formatNumber(refCount)}
⚡ *Status:* ${user.is_banned ? '🔴 BANNED' : '🟢 ACTIVE'}
📅 *Joined Date:* ${user.created_at}`;

  const kb = new InlineKeyboard()
    .text('➕ Add Balance', `adm_usr_addbal_${user.telegram_id}`)
    .text('➖ Deduct Balance', `adm_usr_dedbal_${user.telegram_id}`).row()
    .text(user.is_banned ? '🟢 Unban User' : '🔴 Ban User', `adm_usr_toggleban_${user.telegram_id}`);

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

/* ==========================================================================
   STATISTICS & SERVICES & ORDERS
   ========================================================================== */
export async function showAdminStats(ctx) {
  const usersCount = query('SELECT COUNT(*) as cnt FROM users')[0]?.cnt || 0;
  const ordersCount = query('SELECT COUNT(*) as cnt FROM orders')[0]?.cnt || 0;
  const pendingOrders = query("SELECT COUNT(*) as cnt FROM orders WHERE status = 'Pending'")[0]?.cnt || 0;
  
  const volumeRow = query("SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status != 'Cancelled' AND status != 'Refunded'")[0];
  const totalVolume = volumeRow?.total || 0;

  const depositsRow = query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'Approved'")[0];
  const totalDeposits = depositsRow?.total || 0;

  const pendingDeposits = query("SELECT COUNT(*) as cnt FROM deposits WHERE status = 'Pending'")[0]?.cnt || 0;

  const balanceRow = query("SELECT COALESCE(SUM(balance), 0) as total FROM users")[0];
  const totalBalance = balanceRow?.total || 0;

  const refCommissionRow = query("SELECT COALESCE(SUM(reward_amount), 0) as total FROM referrals")[0];
  const totalRefCommission = refCommissionRow?.total || 0;

  const text = 
`📊 *SMM Panel System Statistics*

👥 *Total Users:* ${formatNumber(usersCount)}
📦 *Total Orders:* ${formatNumber(ordersCount)}
⏳ *Pending Orders:* ${formatNumber(pendingOrders)}
💰 *Total Order Volume:* ${formatCurrency(totalVolume)}

💳 *Total Approved Deposits:* ${formatCurrency(totalDeposits)}
⏳ *Pending Deposits:* ${formatNumber(pendingDeposits)}
🏦 *Total User Balances Held:* ${formatCurrency(totalBalance)}
🎁 *Total Referral Commissions Distributed:* ${formatCurrency(totalRefCommission)}

⚙️ *Maintenance Mode:* ${getSetting('maintenance_mode', '0') === '1' ? '🔴 ACTIVE' : '🟢 NORMAL'}`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function showAdminServices(ctx) {
  const text = 
`🛍️ *Services Management*

Manage the catalog, adjust prices, edit descriptions, or add new packages:`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getAdminServicesMenuKeyboard()
  });
}

export async function listAdminServices(ctx) {
  const services = query('SELECT * FROM services ORDER BY platform, id ASC');

  if (services.length === 0) {
    await ctx.reply('📋 No services configured yet.', { parse_mode: 'Markdown' });
    return;
  }

  let text = `📋 *All Configured Services (${services.length}):*\n\n`;
  for (const s of services) {
    const status = s.is_active ? '🟢' : '🔴';
    text += `${status} *#${s.id} ${s.name}*\n`;
    text += `   🌐 ${s.platform} | 💰 *${formatCurrency(s.price_per_k)}* / 1K\n`;
    text += `   📦 Min: ${formatNumber(s.min_quantity)} | Max: ${formatNumber(s.max_quantity)}\n\n`;
  }

  const kb = new InlineKeyboard()
    .text('➕ Add Service', 'adm_svc_add')
    .text('✏️ Edit / Change Price', 'adm_svc_edit_select');

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

export async function startAddService(ctx) {
  ctx.session.adminStep = 'awaiting_svc_platform';
  ctx.session.adminData = {};

  const kb = new InlineKeyboard()
    .text('Instagram', 'adm_addplat_Instagram')
    .text('Facebook', 'adm_addplat_Facebook')
    .text('WhatsApp', 'adm_addplat_WhatsApp');

  await ctx.reply('➕ *Add New Service*\n\nSelect the platform for the new service:', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
}

export async function handleAdminSelectPlatformForAdd(ctx, platform) {
  ctx.session.adminData = { platform };
  ctx.session.adminStep = 'awaiting_svc_name';

  await ctx.reply(
    `➕ *Adding ${platform} Service*\n\nStep 1/6: Please type the *Service Name* (e.g. \`Instagram Followers Real High Retention\`):`,
    { parse_mode: 'Markdown' }
  );
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

export async function selectServiceToEdit(ctx) {
  const services = query('SELECT * FROM services ORDER BY platform, id ASC');
  const kb = new InlineKeyboard();

  for (const s of services) {
    const status = s.is_active ? '🟢' : '🔴';
    kb.text(`${status} #${s.id} ${s.name} (₹${s.price_per_k})`, `adm_svcedit_${s.id}`).row();
  }

  await ctx.reply('✏️ *Select a service to edit price, description, or status:*', {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

export async function showServiceEditOptions(ctx, serviceId) {
  const service = get('SELECT * FROM services WHERE id = ?', [serviceId]);
  if (!service) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Service not found.' });
    return;
  }

  const text = 
`✏️ *Manage Service #${service.id}*

🏷️ *Name:* ${service.name}
🌐 *Platform:* ${service.platform}
💰 *Price per 1000:* *${formatCurrency(service.price_per_k)}*
📦 *Min:* ${formatNumber(service.min_quantity)} | *Max:* ${formatNumber(service.max_quantity)}
⚡ *Status:* ${service.is_active ? '🟢 Active' : '🔴 Inactive'}
📝 *Description:* ${service.description || 'None'}`;

  const kb = new InlineKeyboard()
    .text('💰 Change Price (1K)', `adm_svcedit_price_${service.id}`)
    .text('🏷️ Change Name', `adm_svcedit_name_${service.id}`).row()
    .text(service.is_active ? '🔴 Disable Service' : '🟢 Enable Service', `adm_svcedit_toggle_${service.id}`).row()
    .text('📦 Change Min/Max', `adm_svcedit_limits_${service.id}`)
    .text('🗑️ Delete Service', `adm_svcedit_delete_${service.id}`);

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

/* ==========================================================================
   ORDERS MANAGEMENT
   ========================================================================== */
export async function showAdminOrders(ctx) {
  await ctx.reply(
    `📦 *Orders Management*\n\nView pending tasks, mark orders completed, or refund cancelled orders:`,
    {
      parse_mode: 'Markdown',
      reply_markup: getAdminOrdersMenuKeyboard()
    }
  );
}

export async function listAdminPendingOrders(ctx) {
  const orders = query("SELECT * FROM orders WHERE status = 'Pending' ORDER BY id ASC LIMIT 10");

  if (orders.length === 0) {
    await ctx.reply('✅ *No pending orders at the moment!*', { parse_mode: 'Markdown' });
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
    return;
  }

  let text = `⏳ *Pending Orders (${orders.length}):*\n\n`;
  const kb = new InlineKeyboard();

  for (const ord of orders) {
    text += `🔹 *${ord.order_code}* | ${ord.service_name}\n`;
    text += `   👤 User: \`${ord.telegram_id}\` | 🔢 Qty: ${formatNumber(ord.quantity)} | 💰 ${formatCurrency(ord.amount)}\n`;
    text += `   🔗 Target: \`${ord.target}\`\n\n`;

    kb.text(`Manage ${ord.order_code}`, `adm_ord_view_${ord.id}`).row();
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

export async function listAdminAllOrders(ctx) {
  const orders = query("SELECT * FROM orders ORDER BY id DESC LIMIT 10");

  if (orders.length === 0) {
    await ctx.reply('📋 No orders recorded yet.', { parse_mode: 'Markdown' });
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
    return;
  }

  let text = `📋 *Recent Orders (Last 10):*\n\n`;
  const kb = new InlineKeyboard();

  for (const ord of orders) {
    text += `🔹 *${ord.order_code}* [${ord.status}]\n`;
    text += `   ${ord.service_name} | Qty: ${formatNumber(ord.quantity)} | 💰 ${formatCurrency(ord.amount)}\n`;
    text += `   🔗 Target: \`${ord.target}\`\n\n`;

    kb.text(`Manage ${ord.order_code}`, `adm_ord_view_${ord.id}`).row();
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

export async function showOrderAdminDetail(ctx, orderId) {
  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Order not found.' });
    return;
  }

  const text = 
`📦 *Order Details: ${order.order_code}*

👤 *User Telegram ID:* \`${order.telegram_id}\`
🛍️ *Service:* ${order.service_name}
🌐 *Platform:* ${order.platform}
🔗 *Target Link:* \`${order.target}\`
🔢 *Quantity:* ${formatNumber(order.quantity)}
💰 *Amount:* *${formatCurrency(order.amount)}*
⏳ *Status:* *${order.status}*
📅 *Placed At:* ${order.created_at}

👇 *Update Status:*`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getOrderManagementKeyboard(order.id)
  });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

export async function handleAdminChangeOrderStatus(ctx, orderId, newStatus) {
  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Order not found.' });
    return;
  }

  run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, orderId]);

  // Notify User
  try {
    const statusEmoji = newStatus === 'Completed' ? '✅' : newStatus === 'Processing' ? '⏳' : '❌';
    await ctx.api.sendMessage(
      order.telegram_id,
      `${statusEmoji} *Order Update!*\n\n` +
      `🆔 *Order ID:* \`${order.order_code}\`\n` +
      `🛍️ *Service:* ${order.service_name}\n` +
      `📌 *New Status:* *${newStatus}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    logger.error('Failed to notify user of order update:', e);
  }

  if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: `Order ${order.order_code} marked as ${newStatus}` });
  await showOrderAdminDetail(ctx, orderId);
}

export async function handleAdminRefundOrder(ctx, orderId) {
  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Order not found.' });
    return;
  }

  if (order.status === 'Refunded') {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Order has already been refunded.' });
    return;
  }

  // Refund balance atomically
  const refundRes = creditBalance(
    order.telegram_id,
    order.amount,
    'ORDER_REFUND',
    `Refund for order ${order.order_code}`,
    order.order_code
  );

  if (!refundRes.success) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Failed to process refund.' });
    return;
  }

  run("UPDATE orders SET status = 'Refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [orderId]);

  // Notify user
  try {
    await ctx.api.sendMessage(
      order.telegram_id,
      `💰 *Order Refunded!*\n\n` +
      `Your order \`${order.order_code}\` has been refunded.\n` +
      `💵 *Amount Credited:* *${formatCurrency(order.amount)}*\n` +
      `💳 *New Balance:* *${formatCurrency(refundRes.balanceAfter)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    logger.error('Failed to notify user of refund:', e);
  }

  if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: `Refund of ${formatCurrency(order.amount)} issued successfully.` });
  await showOrderAdminDetail(ctx, orderId);
}

/* ==========================================================================
   DEPOSITS MANAGEMENT
   ========================================================================== */
export async function showAdminDeposits(ctx) {
  await ctx.reply(
    `💳 *Deposits Management*\n\nReview pending payment proofs and deposit requests:`,
    {
      parse_mode: 'Markdown',
      reply_markup: getAdminDepositsMenuKeyboard()
    }
  );
}

export async function listAdminPendingDeposits(ctx) {
  const deposits = query("SELECT * FROM deposits WHERE status = 'Pending' ORDER BY id ASC LIMIT 10");

  if (deposits.length === 0) {
    await ctx.reply('✅ *No pending deposits at the moment!*', { parse_mode: 'Markdown' });
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
    return;
  }

  let text = `⏳ *Pending Deposits (${deposits.length}):*\n\n`;
  const kb = new InlineKeyboard();

  for (const dep of deposits) {
    text += `🔹 *${dep.deposit_code}* | *${formatCurrency(dep.amount)}*\n`;
    text += `   👤 User: \`${dep.telegram_id}\` | 📝 Note: \`${dep.utr_reference || 'N/A'}\`\n\n`;

    kb.text(`✅ Approve ${dep.deposit_code}`, `adm_dep_approve_${dep.id}`)
      .text(`❌ Reject`, `adm_dep_reject_${dep.id}`).row();
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

/* ==========================================================================
   GIFT CODES MANAGEMENT
   ========================================================================== */
export async function showAdminGiftCodes(ctx) {
  await ctx.reply(
    `🎁 *Gift Codes Management*\n\nCreate promo vouchers and view active codes:`,
    {
      parse_mode: 'Markdown',
      reply_markup: getAdminGiftCodesMenuKeyboard()
    }
  );
}

export async function listAdminGiftCodes(ctx) {
  const codes = query('SELECT * FROM gift_codes ORDER BY id DESC LIMIT 15');

  if (codes.length === 0) {
    await ctx.reply('🎁 No gift codes created yet.', { parse_mode: 'Markdown' });
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
    return;
  }

  let text = `🎁 *Active & Recent Gift Codes:*\n\n`;
  for (const c of codes) {
    const status = c.is_active ? '🟢 Active' : '🔴 Inactive';
    text += `🔹 *Code:* \`${c.code}\`\n`;
    text += `   💰 Reward: ${formatCurrency(c.reward_amount)}\n`;
    text += `   👥 Uses: ${c.used_count}/${c.max_uses} | ${status}\n\n`;
  }

  await ctx.reply(text, { parse_mode: 'Markdown' });
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

export async function startCreateGiftCode(ctx) {
  ctx.session.adminStep = 'awaiting_gift_codename';
  ctx.session.adminData = {};

  await ctx.reply(
    `🎁 *Create New Gift Code*\n\nEnter the code name (e.g. \`BONUS50\` or \`FESTIVE100\`):`,
    { parse_mode: 'Markdown' }
  );
  if (ctx.callbackQuery) await ctx.answerCallbackQuery();
}

/* ==========================================================================
   BROADCAST
   ========================================================================== */
export async function startBroadcast(ctx) {
  ctx.session.adminStep = 'awaiting_broadcast_message';
  ctx.session.adminData = {};

  await ctx.reply(
    `📢 *Broadcast Message to All Users*\n\n` +
    `Send the message you want to broadcast to all registered users.\n` +
    `Supports Telegram formatting, links, and emojis.\n\n` +
    `_Send your message now or type /cancel to abort:_`,
    { parse_mode: 'Markdown' }
  );
}

export async function executeBroadcast(ctx, broadcastText) {
  const users = query('SELECT telegram_id FROM users');
  await ctx.reply(`🚀 Starting broadcast to ${users.length} users...`);

  let success = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await ctx.api.sendMessage(u.telegram_id, broadcastText, { parse_mode: 'Markdown' });
      success++;
    } catch (e) {
      failed++;
    }
    // Rate limit delay
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  await ctx.reply(
    `📢 *Broadcast Completed!*\n\n` +
    `✅ *Successfully Sent:* ${success}\n` +
    `❌ *Failed / Blocked:* ${failed}\n` +
    `👥 *Total Reached:* ${success + failed}`,
    { parse_mode: 'Markdown' }
  );
}

/* ==========================================================================
   MAINTENANCE MODE
   ========================================================================== */
export async function toggleMaintenance(ctx) {
  const current = getSetting('maintenance_mode', '0');
  const next = current === '1' ? '0' : '1';
  setSetting('maintenance_mode', next);

  const statusText = next === '1' ? '🔴 *Maintenance Mode ENABLED*' : '🟢 *Maintenance Mode DISABLED (Normal Operation)*';

  await ctx.reply(
    `🔧 *System Maintenance*\n\n${statusText}\n\nWhen maintenance mode is active, non-admin users will see a maintenance notice.`,
    { parse_mode: 'Markdown' }
  );
}
