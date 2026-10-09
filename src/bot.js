import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Bot, session } from 'grammy';
import { CONFIG } from './config.js';
import { 
  initDatabase, 
  get, 
  run, 
  setSetting, 
  getSetting, 
  isAdminUser, 
  isSuperAdmin,
  query 
} from './database.js';
import { logger } from './utils/logger.js';
import { handleStart } from './handlers/start.js';
import { 
  showPlatformsMenu, 
  handlePlatformSelection, 
  handleServiceDetails, 
  startSearchServices, 
  handleSearchInput 
} from './handlers/services.js';
import { 
  handleStartOrder, 
  handleOrderTargetInput, 
  handleOrderQuantityInput, 
  handleConfirmOrder, 
  handleCancelOrder, 
  showMyOrders 
} from './handlers/orders.js';
import { handleProfile } from './handlers/profile.js';
import { handleReferrals } from './handlers/referrals.js';
import { 
  startDeposit, 
  handleDepositAmountInput, 
  handleSelectPaymentMethod,
  handleDepositScreenshotInput,
  handleDepositUtrInput, 
  handleAdminApproveDeposit, 
  handleAdminRejectDeposit 
} from './handlers/deposits.js';
import { handleSupport } from './handlers/support.js';
import { startRedeemGiftCode, handleGiftCodeInput } from './handlers/giftcodes.js';
import { 
  handleAdminCommand,
  showAdminUsersMenu,
  showAdminForceChannelMenu,
  showAdminPaymentMethodsMenu,
  showAdminManageAdminsMenu,
  showAdminSettingsMenu,
  startAddForceChannel,
  toggleForceJoin,
  listForceChannels,
  promptRemoveForceChannel,
  startAddQrMethod,
  viewAllQrMethods,
  promptEditQrMethod,
  promptDeleteQrMethod,
  startAddAdmin,
  promptRemoveAdmin,
  showAdminList,
  startSearchUser,
  startAddBalance,
  startDeductBalance,
  startBanUser,
  startUnbanUser,
  showUserProfileAdmin,
  showAdminStats, 
  showAdminServices, 
  listAdminServices, 
  startAddService, 
  handleAdminSelectPlatformForAdd, 
  selectServiceToEdit, 
  showServiceEditOptions, 
  showAdminOrders, 
  listAdminPendingOrders, 
  listAdminAllOrders, 
  showOrderAdminDetail, 
  handleAdminChangeOrderStatus, 
  handleAdminRefundOrder, 
  showAdminDeposits, 
  listAdminPendingDeposits, 
  showAdminGiftCodes, 
  listAdminGiftCodes, 
  startCreateGiftCode, 
  startBroadcast, 
  executeBroadcast, 
  toggleMaintenance 
} from './handlers/admin.js';
import { getForceJoinInlineKeyboard } from './keyboards.js';
import { creditBalance, deductBalance } from './utils/transactions.js';
import { formatCurrency } from './utils/pricing.js';

async function main() {
  logger.info(`Starting ${CONFIG.BOT_NAME} for ${CONFIG.BRAND_NAME}...`);

  // Initialize SQLite Database
  await initDatabase();

  // Start lightweight health check HTTP server for Render Web Services / Uptime monitoring
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: CONFIG.BOT_NAME,
      brand: CONFIG.BRAND_NAME,
      botConfigured: Boolean(CONFIG.BOT_TOKEN),
      timestamp: new Date().toISOString()
    }));
  });

  const port = process.env.PORT || 3000;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.info(`Port ${port} already in use; Telegram bot continues long polling smoothly.`);
    } else {
      logger.warn('Health check server notice:', err.message || err);
    }
  });

  server.listen(port, () => {
    logger.info(`🌐 Health check HTTP server listening on port ${port}`);
  });

  if (!CONFIG.BOT_TOKEN) {
    logger.warn('⚠️  BOT_TOKEN is not defined in environment variables!');
    logger.warn('Please add BOT_TOKEN to your .env file or Render Environment Variables to run the live Telegram Bot.');
    logger.info('Database initialized successfully. Standing by for BOT_TOKEN configuration.');
    return;
  }

  const bot = new Bot(CONFIG.BOT_TOKEN);

  // Session middleware
  bot.use(
    session({
      initial: () => ({
        step: null,
        data: {},
        adminStep: null,
        adminData: {}
      })
    })
  );

  /* ==========================================================================
     0. STRICT PRIVATE CHAT ENFORCEMENT MIDDLEWARE
     ==========================================================================
     Rules:
     1. User menu & Admin panel work ONLY in private 1-to-1 chats (ctx.chat.type === 'private').
     2. NEVER send ReplyKeyboardMarkup, user menu, admin menu, or interactive UI into groups/channels.
     3. If the bot is added as administrator/member to a group or channel, do NOT trigger any UI or send keyboards.
     4. If a user sends /start or another command in a group, send a plain notice without keyboard and stop processing.
     5. Force Channel verification uses Telegram's membership API only without posting keyboards in the channel.
  */
  bot.use(async (ctx, next) => {
    // If update doesn't have a chat object, proceed
    if (!ctx.chat) return next();

    // Private chats proceed through normal flow
    if (ctx.chat.type === 'private') {
      return next();
    }

    // --- ALL NON-PRIVATE CHATS (group, supergroup, channel) ---

    // A. Ignore bot membership changes and group service messages without sending anything
    if (
      ctx.myChatMember ||
      ctx.chatMember ||
      ctx.message?.new_chat_members ||
      ctx.message?.left_chat_member ||
      ctx.message?.group_chat_created ||
      ctx.message?.supergroup_chat_created ||
      ctx.message?.channel_chat_created ||
      ctx.channelPost ||
      ctx.editedChannelPost
    ) {
      logger.info(`Ignored non-private event in ${ctx.chat.type} (${ctx.chat.id})`);
      return; // Do NOT reply, do NOT send any menu or keyboard
    }

    // B. Callback queries originating from groups
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({
          text: '⚠️ Please open my private chat to use the bot.',
          show_alert: true
        });
      } catch (e) {}
      return; // Stop processing
    }

    // C. Check if message is a command
    const msg = ctx.message;
    if (msg) {
      const text = msg.text || '';
      const isCommand = text.startsWith('/') ||
        msg.entities?.some((e) => e.type === 'bot_command' && e.offset === 0);

      if (isCommand) {
        try {
          // Send plain text notice with remove_keyboard to ensure any existing keyboard is cleared
          await ctx.reply('⚠️ Please open my private chat to use the bot.', {
            reply_markup: { remove_keyboard: true }
          });
        } catch (e) {
          logger.warn(`Could not send private chat notice to ${ctx.chat.type} ${ctx.chat.id}: ${e.message || e}`);
        }
        return; // Stop processing immediately
      }
    }

    // D. All regular group conversation, media, stickers, etc. - silently ignore and DO NOT process
    return;
  });

  // Explicit handler for bot status updates in chats/channels
  bot.on('my_chat_member', async (ctx) => {
    logger.info(`Bot status updated in ${ctx.chat.type} (${ctx.chat.id}): ${ctx.myChatMember?.new_chat_member?.status}`);
  });

  // 1. Maintenance & Ban Check Middleware
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const telegramId = String(ctx.from.id);
      const user = get('SELECT is_banned FROM users WHERE telegram_id = ?', [telegramId]);
      if (user && user.is_banned === 1 && !isAdminUser(telegramId)) {
        await ctx.reply('⛔ *Your account has been suspended by the administrator.*', { parse_mode: 'Markdown' });
        return;
      }

      const maintenance = getSetting('maintenance_mode', '0');
      if (maintenance === '1' && !isAdminUser(telegramId)) {
        if (ctx.message?.text === '/start' || ctx.callbackQuery) {
          await ctx.reply(
            '🔧 *System Maintenance in Progress*\n\nWe are currently performing routine upgrades. Service will resume shortly. Thank you for your patience!',
            { parse_mode: 'Markdown' }
          );
          if (ctx.callbackQuery) await ctx.answerCallbackQuery();
          return;
        }
      }
    }
    await next();
  });

  // 2. Force Channel Verification Middleware
  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();

    const telegramId = String(ctx.from.id);

    // Never block Super Admin or Administrators from using their own bot
    if (isAdminUser(telegramId)) {
      return next();
    }

    const forceJoinEnabled = getSetting('force_join_enabled', '0');
    if (forceJoinEnabled === '1') {
      const channels = query('SELECT * FROM force_channels WHERE is_active = 1');

      if (channels.length > 0) {
        // If checking join, let callback handle verification
        if (ctx.callbackQuery?.data === 'check_force_join') {
          return next();
        }

        const missingChannels = [];
        for (const ch of channels) {
          try {
            const member = await ctx.api.getChatMember(ch.channel_username, ctx.from.id);
            const valid = ['creator', 'administrator', 'member', 'restricted'];
            if (!valid.includes(member.status)) {
              missingChannels.push(ch);
            }
          } catch (e) {
            const errMsg = String(e.message || e);
            if (errMsg.includes('member list is inaccessible') || errMsg.includes('chat not found') || errMsg.includes('bot is not a member')) {
              logger.warn(`⚠️ Bot lacks administrator privileges in ${ch.channel_username}. Grant bot admin rights in the channel to enforce verification.`);
            } else {
              missingChannels.push(ch);
            }
          }
        }

        if (missingChannels.length > 0) {
          const forceText = 
`📢 *Please join our channel first!*

To access our SMM Panel services and features, you must join our required channel(s) below.

Once you have joined, click the *Check Join* button to proceed:`;

          if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({ text: 'Please join our channel first to use this bot!', show_alert: true });
            try {
              await ctx.editMessageText(forceText, {
                parse_mode: 'Markdown',
                reply_markup: getForceJoinInlineKeyboard(missingChannels)
              });
            } catch (e) {}
          } else {
            await ctx.reply(forceText, {
              parse_mode: 'Markdown',
              reply_markup: getForceJoinInlineKeyboard(missingChannels)
            });
          }
          return;
        }
      }
    }

    await next();
  });

  /* ==========================================================================
     COMMANDS
     ========================================================================== */
  bot.command('start', handleStart);
  bot.command('admin', handleAdminCommand);
  bot.command('support', handleSupport);
  bot.command('services', (ctx) => showPlatformsMenu(ctx));
  bot.command('profile', (ctx) => handleProfile(ctx));
  bot.command('orders', (ctx) => showMyOrders(ctx));
  bot.command('deposit', (ctx) => startDeposit(ctx));
  bot.command('refer', (ctx) => handleReferrals(ctx));
  bot.command('gift', (ctx) => startRedeemGiftCode(ctx));
  bot.command('search', (ctx) => startSearchServices(ctx));
  bot.command('cancel', async (ctx) => {
    ctx.session.step = null;
    ctx.session.data = {};
    ctx.session.adminStep = null;
    ctx.session.adminData = {};
    await ctx.reply('❌ Current operation cancelled.', { parse_mode: 'Markdown' });
  });

  /* ==========================================================================
     USER MAIN REPLY KEYBOARD HEURISTICS
     ========================================================================== */
  bot.hears('🛍️ Services', showPlatformsMenu);
  bot.hears('👥 Refer', handleReferrals);
  bot.hears('👤 Profile', handleProfile);
  bot.hears('💳 Deposit', startDeposit);
  bot.hears('📦 My Orders', showMyOrders);
  bot.hears('🎁 Gift Code', startRedeemGiftCode);
  bot.hears('🔎 Search', startSearchServices);
  bot.hears('🔎 Search Services', startSearchServices);
  bot.hears('🆘 Support', handleSupport);
  bot.hears('🏠 Main Menu', handleStart);
  bot.hears('❌ Cancel Action', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;
    ctx.session.step = null;
    ctx.session.data = {};
    ctx.session.adminStep = null;
    ctx.session.adminData = {};
    await ctx.reply('❌ Operation cancelled.', { parse_mode: 'Markdown' });
    await handleStart(ctx);
  });

  /* ==========================================================================
     ADMIN REPLY KEYBOARDS (SUBMENUS & ACTIONS)
     ========================================================================== */
  bot.hears('🏠 Admin Home', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;
    if (isAdminUser(ctx.from?.id)) return handleAdminCommand(ctx);
  });
  bot.hears('🔙 Back', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;
    if (isAdminUser(ctx.from?.id)) return handleAdminCommand(ctx);
  });
  bot.hears('🏠 Exit Admin', async (ctx) => {
    if (ctx.chat?.type !== 'private') return;
    if (isAdminUser(ctx.from?.id)) {
      await ctx.reply('👋 Exited admin panel. Back to user mode.');
      return handleStart(ctx);
    }
  });

  // Admin Root Menu Navigation
  bot.hears('👤 Users', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminUsersMenu(ctx);
  });
  bot.hears('📢 Force Channel', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminForceChannelMenu(ctx);
  });
  bot.hears('💳 Payment Methods', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminPaymentMethodsMenu(ctx);
  });
  bot.hears('👑 Manage Admins', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminManageAdminsMenu(ctx);
  });
  bot.hears('⚙️ Settings', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminSettingsMenu(ctx);
  });
  bot.hears('📊 Statistics', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminStats(ctx);
  });
  bot.hears('📢 Broadcast', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startBroadcast(ctx);
  });
  bot.hears('🔧 Maintenance', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return toggleMaintenance(ctx);
  });

  // Admin Users Submenu
  bot.hears('🔎 Search User', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startSearchUser(ctx);
  });
  bot.hears('💰 Add Balance', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startAddBalance(ctx);
  });
  bot.hears('➖ Deduct Balance', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startDeductBalance(ctx);
  });
  bot.hears('🚫 Ban User', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startBanUser(ctx);
  });
  bot.hears('✅ Unban User', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startUnbanUser(ctx);
  });
  bot.hears('📋 View User', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startSearchUser(ctx);
  });

  // Admin Force Channel Submenu
  bot.hears('➕ Add Force Channel', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startAddForceChannel(ctx);
  });
  bot.hears('📋 Channel List', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return listForceChannels(ctx);
  });
  bot.hears('🔛 Toggle Force Join', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return toggleForceJoin(ctx);
  });
  bot.hears('🗑️ Remove Channel', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return promptRemoveForceChannel(ctx);
  });

  // Admin Payment Methods Submenu
  bot.hears('➕ Add QR', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startAddQrMethod(ctx);
  });
  bot.hears('📋 View QR', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return viewAllQrMethods(ctx);
  });
  bot.hears('✏️ Edit QR', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return promptEditQrMethod(ctx);
  });
  bot.hears('🗑️ Delete QR', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return promptDeleteQrMethod(ctx);
  });

  // Admin Manage Admins Submenu
  bot.hears('➕ Add Admin', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return startAddAdmin(ctx);
  });
  bot.hears('➖ Remove Admin', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return promptRemoveAdmin(ctx);
  });
  bot.hears('📋 Admin List', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) return showAdminList(ctx);
  });

  // Admin Settings Submenu
  bot.hears('🆘 Support Username', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) {
      ctx.session.adminStep = 'awaiting_set_support';
      await ctx.reply('💬 Enter Telegram Support Username (without @):');
    }
  });
  bot.hears('💰 Min Deposit', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) {
      ctx.session.adminStep = 'awaiting_set_mindep';
      await ctx.reply('💰 Enter new Minimum Deposit amount in ₹:');
    }
  });
  bot.hears('💵 Referral Commission', async (ctx) => {
    if (isAdminUser(ctx.from?.id)) {
      ctx.session.adminStep = 'awaiting_set_refcommission';
      await ctx.reply('💵 Enter new Referral Commission Percentage (e.g. `10`):');
    }
  });

  /* ==========================================================================
     INLINE CALLBACK QUERIES
     ========================================================================== */
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    try {
      // Force Join Verification
      if (data === 'check_force_join') {
        const channels = query('SELECT * FROM force_channels WHERE is_active = 1');
        const missing = [];

        for (const ch of channels) {
          try {
            const member = await ctx.api.getChatMember(ch.channel_username, ctx.from.id);
            if (!['creator', 'administrator', 'member', 'restricted'].includes(member.status)) {
              missing.push(ch);
            }
          } catch (e) {
            const errMsg = String(e.message || e);
            if (!errMsg.includes('member list is inaccessible') && !errMsg.includes('chat not found') && !errMsg.includes('bot is not a member')) {
              missing.push(ch);
            }
          }
        }

        if (missing.length === 0) {
          await ctx.answerCallbackQuery({ text: '✅ Verification successful! Welcome.' });
          await ctx.reply('🎉 *Thank you for joining our channel! Access granted.*', { parse_mode: 'Markdown' });
          return handleStart(ctx);
        } else {
          return ctx.answerCallbackQuery({
            text: '⚠️ You have not joined all required channels yet! Please join and click Check Join again.',
            show_alert: true
          });
        }
      }

      // User Navigation
      if (data === 'nav_home') return handleStart(ctx);
      if (data === 'nav_platforms') return showPlatformsMenu(ctx);
      if (data === 'nav_deposit') return startDeposit(ctx);
      if (data === 'nav_giftcode') return startRedeemGiftCode(ctx);
      if (data === 'nav_referrals') return handleReferrals(ctx);
      if (data === 'user_my_orders') return showMyOrders(ctx);
      if (data === 'nav_services_back') return showPlatformsMenu(ctx);

      // Deposit payment method & skip UTR
      if (data.startsWith('dep_method_')) {
        const methodId = parseInt(data.replace('dep_method_', ''), 10);
        return handleSelectPaymentMethod(ctx, methodId);
      }
      if (data === 'dep_skip_utr') {
        return handleDepositUtrInput(ctx, true);
      }
      if (data === 'dep_cancel') {
        ctx.session.step = null;
        ctx.session.data = {};
        await ctx.editMessageText('❌ Deposit cancelled.');
        await ctx.answerCallbackQuery({ text: 'Deposit cancelled' });
        return;
      }

      // Platform selection
      if (data.startsWith('platform_')) {
        const platform = data.replace('platform_', '');
        return handlePlatformSelection(ctx, platform);
      }

      // Service detail
      if (data.startsWith('svc_')) {
        const svcId = parseInt(data.replace('svc_', ''), 10);
        return handleServiceDetails(ctx, svcId);
      }

      // Order start
      if (data.startsWith('order_start_')) {
        const svcId = parseInt(data.replace('order_start_', ''), 10);
        return handleStartOrder(ctx, svcId);
      }

      // Order confirmation
      if (data.startsWith('order_confirm_')) {
        const draftId = data.replace('order_confirm_', '');
        return handleConfirmOrder(ctx, draftId);
      }

      // Order cancellation
      if (data.startsWith('order_cancel_')) {
        const draftId = data.replace('order_cancel_', '');
        return handleCancelOrder(ctx, draftId);
      }

      /* =================== ADMIN CALLBACKS =================== */
      if (isAdminUser(ctx.from.id)) {
        // Force Channel removal
        if (data.startsWith('adm_fc_del_')) {
          const chId = parseInt(data.replace('adm_fc_del_', ''), 10);
          run('DELETE FROM force_channels WHERE id = ?', [chId]);
          await ctx.answerCallbackQuery({ text: 'Channel removed!' });
          return listForceChannels(ctx);
        }

        // Admin removal
        if (data.startsWith('adm_admin_del_')) {
          const targetTid = data.replace('adm_admin_del_', '').trim();
          if (String(targetTid) === String(CONFIG.ADMIN_TELEGRAM_ID).trim()) {
            await ctx.answerCallbackQuery({ text: 'Super Admin cannot be removed!' });
            return;
          }
          run('DELETE FROM admins WHERE telegram_id = ?', [targetTid]);
          await ctx.answerCallbackQuery({ text: `Admin ${targetTid} removed!` });
          return showAdminList(ctx);
        }

        // Payment method delete
        if (data.startsWith('adm_pm_del_confirm_')) {
          const pmId = parseInt(data.replace('adm_pm_del_confirm_', ''), 10);
          run('DELETE FROM payment_methods WHERE id = ?', [pmId]);
          await ctx.answerCallbackQuery({ text: `Payment method #${pmId} deleted!` });
          return viewAllQrMethods(ctx);
        }

        // Services
        if (data === 'adm_svc_list') return listAdminServices(ctx);
        if (data === 'adm_svc_add') return startAddService(ctx);
        if (data.startsWith('adm_addplat_')) {
          const plat = data.replace('adm_addplat_', '');
          return handleAdminSelectPlatformForAdd(ctx, plat);
        }
        if (data === 'adm_svc_edit_select') return selectServiceToEdit(ctx);
        if (data.startsWith('adm_svcedit_price_')) {
          const id = parseInt(data.replace('adm_svcedit_price_', ''), 10);
          ctx.session.adminStep = 'awaiting_edit_price';
          ctx.session.adminData = { serviceId: id };
          await ctx.reply(`💰 Enter new price per 1000 units (in ₹) for Service #${id}:`);
          await ctx.answerCallbackQuery();
          return;
        }
        if (data.startsWith('adm_svcedit_name_')) {
          const id = parseInt(data.replace('adm_svcedit_name_', ''), 10);
          ctx.session.adminStep = 'awaiting_edit_name';
          ctx.session.adminData = { serviceId: id };
          await ctx.reply(`🏷️ Enter new name for Service #${id}:`);
          await ctx.answerCallbackQuery();
          return;
        }
        if (data.startsWith('adm_svcedit_toggle_')) {
          const id = parseInt(data.replace('adm_svcedit_toggle_', ''), 10);
          const svc = get('SELECT is_active FROM services WHERE id = ?', [id]);
          const nextState = svc?.is_active === 1 ? 0 : 1;
          run('UPDATE services SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextState, id]);
          await ctx.answerCallbackQuery({ text: `Service #${id} is now ${nextState ? 'Active' : 'Disabled'}` });
          return showServiceEditOptions(ctx, id);
        }
        if (data.startsWith('adm_svcedit_limits_')) {
          const id = parseInt(data.replace('adm_svcedit_limits_', ''), 10);
          ctx.session.adminStep = 'awaiting_edit_limits';
          ctx.session.adminData = { serviceId: id };
          await ctx.reply(`📦 Enter min and max quantity separated by space (e.g. \`1000 50000\`):`, { parse_mode: 'Markdown' });
          await ctx.answerCallbackQuery();
          return;
        }
        if (data.startsWith('adm_svcedit_delete_')) {
          const id = parseInt(data.replace('adm_svcedit_delete_', ''), 10);
          run('DELETE FROM services WHERE id = ?', [id]);
          await ctx.answerCallbackQuery({ text: `Service #${id} deleted!` });
          return listAdminServices(ctx);
        }
        if (data.startsWith('adm_svcedit_')) {
          const id = parseInt(data.replace('adm_svcedit_', ''), 10);
          return showServiceEditOptions(ctx, id);
        }

        // Orders
        if (data === 'adm_ord_pending') return listAdminPendingOrders(ctx);
        if (data === 'adm_ord_all') return listAdminAllOrders(ctx);
        if (data.startsWith('adm_ord_view_')) {
          const id = parseInt(data.replace('adm_ord_view_', ''), 10);
          return showOrderAdminDetail(ctx, id);
        }
        if (data.startsWith('adm_ord_status_')) {
          const parts = data.replace('adm_ord_status_', '').split('_');
          const ordId = parseInt(parts[0], 10);
          const status = parts[1];
          return handleAdminChangeOrderStatus(ctx, ordId, status);
        }
        if (data.startsWith('adm_ord_refund_')) {
          const ordId = parseInt(data.replace('adm_ord_refund_', ''), 10);
          return handleAdminRefundOrder(ctx, ordId);
        }

        // Deposits
        if (data === 'adm_dep_pending') return listAdminPendingDeposits(ctx);
        if (data.startsWith('adm_dep_approve_')) {
          const depId = parseInt(data.replace('adm_dep_approve_', ''), 10);
          return handleAdminApproveDeposit(ctx, depId);
        }
        if (data.startsWith('adm_dep_reject_')) {
          const depId = parseInt(data.replace('adm_dep_reject_', ''), 10);
          return handleAdminRejectDeposit(ctx, depId);
        }

        // Payment Methods
        if (data.startsWith('adm_pmedit_')) {
          const id = parseInt(data.replace('adm_pmedit_', ''), 10);
          const pm = get('SELECT * FROM payment_methods WHERE id = ?', [id]);
          if (pm) {
            const nextState = pm.is_active === 1 ? 0 : 1;
            run('UPDATE payment_methods SET is_active = ? WHERE id = ?', [nextState, id]);
            await ctx.answerCallbackQuery({ text: `Payment method #${id} is now ${nextState ? 'Active' : 'Disabled'}` });
            return viewAllQrMethods(ctx);
          }
        }

        // Users
        if (data.startsWith('adm_usr_addbal_')) {
          const tid = data.replace('adm_usr_addbal_', '');
          ctx.session.adminStep = 'awaiting_user_addbal_amount';
          ctx.session.adminData = { targetTelegramId: tid };
          await ctx.reply(`➕ Enter the amount in ₹ to add to user \`${tid}\`:`, { parse_mode: 'Markdown' });
          await ctx.answerCallbackQuery();
          return;
        }
        if (data.startsWith('adm_usr_dedbal_')) {
          const tid = data.replace('adm_usr_dedbal_', '');
          ctx.session.adminStep = 'awaiting_user_dedbal_amount';
          ctx.session.adminData = { targetTelegramId: tid };
          await ctx.reply(`➖ Enter the amount in ₹ to deduct from user \`${tid}\`:`, { parse_mode: 'Markdown' });
          await ctx.answerCallbackQuery();
          return;
        }
        if (data.startsWith('adm_usr_toggleban_')) {
          const tid = data.replace('adm_usr_toggleban_', '');
          const usr = get('SELECT is_banned FROM users WHERE telegram_id = ?', [tid]);
          const nextBan = usr?.is_banned === 1 ? 0 : 1;
          run('UPDATE users SET is_banned = ? WHERE telegram_id = ?', [nextBan, tid]);
          await ctx.answerCallbackQuery({ text: `User ${tid} is now ${nextBan ? 'Banned' : 'Unbanned'}` });
          return showUserProfileAdmin(ctx, tid);
        }
      }

      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('Callback query handler error:', err);
      try {
        await ctx.answerCallbackQuery({ text: 'An error occurred. Please try again.' });
      } catch (e) {}
    }
  });

  /* ==========================================================================
     MEDIA & PHOTO HANDLER (Deposits Proofs & Admin QR Uploads)
     ========================================================================== */
  bot.on(['message:photo', 'message:document'], async (ctx) => {
    // User Deposit Proof Screenshot
    if (ctx.session.step === 'awaiting_deposit_screenshot') {
      return handleDepositScreenshotInput(ctx);
    }

    // Admin Uploading QR Code
    if (isAdminUser(ctx.from?.id)) {
      if (ctx.session.adminStep === 'awaiting_pm_qr') {
        const photo = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1] : null;
        const fileId = photo ? photo.file_id : (ctx.message.document?.file_id || null);
        ctx.session.adminData.qr_file_id = fileId;
        ctx.session.adminStep = 'awaiting_pm_upi';
        await ctx.reply('✅ *QR Image uploaded successfully!*\n\nStep 3/4: Enter *UPI ID / Payment ID* (or type `/skip`):', { parse_mode: 'Markdown' });
        return;
      }
    }
  });

  /* ==========================================================================
     TEXT MESSAGE HANDLER (MULTI-STEP FLOWS)
     ========================================================================== */
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();

    // User Multi-Step States
    if (ctx.session.step === 'awaiting_search_query') {
      return handleSearchInput(ctx);
    }
    if (ctx.session.step === 'awaiting_order_target') {
      return handleOrderTargetInput(ctx);
    }
    if (ctx.session.step === 'awaiting_order_quantity') {
      return handleOrderQuantityInput(ctx);
    }
    if (ctx.session.step === 'awaiting_deposit_amount') {
      return handleDepositAmountInput(ctx);
    }
    if (ctx.session.step === 'awaiting_deposit_utr') {
      return handleDepositUtrInput(ctx, false);
    }
    if (ctx.session.step === 'awaiting_gift_code') {
      return handleGiftCodeInput(ctx);
    }

    // Admin Multi-Step States
    if (isAdminUser(ctx.from?.id) && ctx.session.adminStep) {
      const step = ctx.session.adminStep;

      // 1. Force Channel username
      if (step === 'awaiting_fc_username') {
        let username = text.trim();
        if (!username.startsWith('@')) username = `@${username}`;

        try {
          const chat = await ctx.api.getChat(username);
          run(
            `INSERT INTO force_channels (channel_username, channel_title, is_active)
             VALUES (?, ?, 1)
             ON CONFLICT(channel_username) DO UPDATE SET channel_title = excluded.channel_title, is_active = 1`,
            [username, chat.title || username]
          );

          ctx.session.adminStep = null;
          ctx.session.adminData = {};
          await ctx.reply(`✅ *Force Channel added successfully!*\n\nChannel: \`${username}\`\nTitle: *${chat.title || 'Channel'}*`, { parse_mode: 'Markdown' });
          return showAdminForceChannelMenu(ctx);
        } catch (e) {
          logger.warn('Failed to verify channel via getChat:', e.message || e);
          // Insert anyway
          run(
            `INSERT INTO force_channels (channel_username, channel_title, is_active)
             VALUES (?, ?, 1)
             ON CONFLICT(channel_username) DO UPDATE SET is_active = 1`,
            [username, username]
          );

          ctx.session.adminStep = null;
          ctx.session.adminData = {};
          await ctx.reply(`✅ *Channel registered as ${username}!*\n\n⚠️ _Note: Ensure the bot is an Administrator in this channel so it can verify subscriber status._`, { parse_mode: 'Markdown' });
          return showAdminForceChannelMenu(ctx);
        }
      }

      // 2. Add Payment Method & QR
      if (step === 'awaiting_pm_name') {
        ctx.session.adminData.name = text;
        ctx.session.adminStep = 'awaiting_pm_qr';
        await ctx.reply(`Step 2/4: Please *upload the QR Image* for \`${text}\`\n(Or send \`/skip\` if no image is needed):`, { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_pm_qr') {
        if (text === '/skip' || text.toLowerCase() === 'skip') {
          ctx.session.adminData.qr_file_id = null;
          ctx.session.adminStep = 'awaiting_pm_upi';
          await ctx.reply('Step 3/4: Enter *UPI ID / Payment ID* (or send `/skip`):', { parse_mode: 'Markdown' });
          return;
        } else {
          await ctx.reply('⚠️ Please send a photo of the QR code, or type `/skip`:');
          return;
        }
      }
      if (step === 'awaiting_pm_upi') {
        ctx.session.adminData.upi_id = (text === '/skip' || text.toLowerCase() === 'skip') ? null : text;
        ctx.session.adminStep = 'awaiting_pm_instr';
        await ctx.reply('Step 4/4: Enter *Payment Instructions* for user (or send `/skip`):', { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_pm_instr') {
        const instr = (text === '/skip' || text.toLowerCase() === 'skip') ? 'Pay and upload payment screenshot.' : text;
        const pData = ctx.session.adminData;

        run(
          `INSERT INTO payment_methods (name, qr_file_id, upi_id, instructions, is_active)
           VALUES (?, ?, ?, ?, 1)`,
          [pData.name, pData.qr_file_id, pData.upi_id, instr]
        );

        ctx.session.adminStep = null;
        ctx.session.adminData = {};

        await ctx.reply(
          `🎉 *QR Payment Method Added!*\n\n` +
          `💳 *Name:* ${pData.name}\n` +
          `📷 *QR Image:* ${pData.qr_file_id ? '✅ Attached' : '❌ None'}\n` +
          `📱 *UPI:* \`${pData.upi_id || 'N/A'}\`\n` +
          `📝 *Instructions:* ${instr}`,
          { parse_mode: 'Markdown' }
        );
        return showAdminPaymentMethodsMenu(ctx);
      }

      // 3. Add Administrator (Super Admin Only)
      if (step === 'awaiting_newadmin_id') {
        const targetId = text.trim();
        if (!/^\d+$/.test(targetId)) {
          await ctx.reply('⚠️ Please enter a valid numerical Telegram ID (e.g. `123456789`):');
          return;
        }
        ctx.session.adminData.newAdminId = targetId;
        ctx.session.adminStep = 'awaiting_newadmin_name';
        await ctx.reply(`Step 2/2: Enter identification Name or Handle for this Admin (or send \`/skip\`):`);
        return;
      }
      if (step === 'awaiting_newadmin_name') {
        const targetId = ctx.session.adminData.newAdminId;
        const adminName = (text === '/skip' || text.toLowerCase() === 'skip') ? 'Administrator' : text;

        run(
          `INSERT INTO admins (telegram_id, name, role)
           VALUES (?, ?, 'admin')
           ON CONFLICT(telegram_id) DO UPDATE SET name = excluded.name, role = 'admin'`,
          [targetId, adminName]
        );

        ctx.session.adminStep = null;
        ctx.session.adminData = {};

        await ctx.reply(`🎉 *Administrator Added Successfully!*\n\nID: \`${targetId}\`\nName: *${adminName}*\nThey can now access \`/admin\`.`, { parse_mode: 'Markdown' });
        return showAdminManageAdminsMenu(ctx);
      }

      // 4. User balance modification
      if (step === 'awaiting_user_addbal_id') {
        const usr = get('SELECT * FROM users WHERE telegram_id = ?', [text]);
        if (!usr) {
          await ctx.reply(`❌ User \`${text}\` not found. Please enter a valid user ID:`, { parse_mode: 'Markdown' });
          return;
        }
        ctx.session.adminData.targetId = text;
        ctx.session.adminStep = 'awaiting_user_addbal_amount';
        await ctx.reply(`💰 Enter amount in ₹ to add to user \`${text}\` (Current Balance: ${formatCurrency(usr.balance)}):`, { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_user_addbal_amount') {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt <= 0) {
          await ctx.reply('⚠️ Please enter a valid numerical amount:');
          return;
        }
        const tid = ctx.session.adminData.targetId || ctx.session.adminData.targetTelegramId;
        const res = creditBalance(tid, amt, 'ADMIN_BONUS', 'Admin manual credit');
        ctx.session.adminStep = null;
        ctx.session.adminData = {};
        if (res.success) {
          await ctx.reply(`✅ *Credited ${formatCurrency(amt)} to user \`${tid}\`!*\nNew Balance: *${formatCurrency(res.balanceAfter)}*`, { parse_mode: 'Markdown' });
          try {
            await ctx.api.sendMessage(tid, `🎁 *Balance Added!*\n\nThe admin credited *${formatCurrency(amt)}* to your account.\n💰 New Balance: *${formatCurrency(res.balanceAfter)}*`, { parse_mode: 'Markdown' });
          } catch (e) {}
        } else {
          await ctx.reply('❌ Failed to add balance.');
        }
        return;
      }
      if (step === 'awaiting_user_dedbal_id') {
        const usr = get('SELECT * FROM users WHERE telegram_id = ?', [text]);
        if (!usr) {
          await ctx.reply(`❌ User \`${text}\` not found. Please enter a valid user ID:`, { parse_mode: 'Markdown' });
          return;
        }
        ctx.session.adminData.targetId = text;
        ctx.session.adminStep = 'awaiting_user_dedbal_amount';
        await ctx.reply(`➖ Enter amount in ₹ to deduct from user \`${text}\` (Current Balance: ${formatCurrency(usr.balance)}):`, { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_user_dedbal_amount') {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt <= 0) {
          await ctx.reply('⚠️ Please enter a valid numerical amount:');
          return;
        }
        const tid = ctx.session.adminData.targetId || ctx.session.adminData.targetTelegramId;
        const res = deductBalance(tid, amt, 'ADMIN_DEDUCTION', 'Admin manual deduction');
        ctx.session.adminStep = null;
        ctx.session.adminData = {};
        if (res.success) {
          await ctx.reply(`✅ *Deducted ${formatCurrency(amt)} from user \`${tid}\`!*\nNew Balance: *${formatCurrency(res.balanceAfter)}*`, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(`❌ Failed to deduct balance: ${res.message}`);
        }
        return;
      }
      if (step === 'awaiting_user_ban_id') {
        run('UPDATE users SET is_banned = 1 WHERE telegram_id = ?', [text]);
        ctx.session.adminStep = null;
        ctx.session.adminData = {};
        await ctx.reply(`🚫 *User \`${text}\` has been BANNED.*`, { parse_mode: 'Markdown' });
        return showAdminUsersMenu(ctx);
      }
      if (step === 'awaiting_user_unban_id') {
        run('UPDATE users SET is_banned = 0 WHERE telegram_id = ?', [text]);
        ctx.session.adminStep = null;
        ctx.session.adminData = {};
        await ctx.reply(`✅ *User \`${text}\` has been UNBANNED.*`, { parse_mode: 'Markdown' });
        return showAdminUsersMenu(ctx);
      }
      if (step === 'awaiting_user_search') {
        ctx.session.adminStep = null;
        return showUserProfileAdmin(ctx, text.replace('@', ''));
      }

      // 5. Settings: Referral Commission & Minimum Deposit & Support
      if (step === 'awaiting_set_refcommission') {
        const percent = parseFloat(text);
        if (isNaN(percent) || percent < 0 || percent > 100) {
          await ctx.reply('⚠️ Please enter a valid percentage between 0 and 100:');
          return;
        }
        setSetting('referral_commission_percent', String(percent));
        ctx.session.adminStep = null;
        await ctx.reply(`✅ *Referral commission updated to:* *${percent}% on every deposit!*`, { parse_mode: 'Markdown' });
        return showAdminSettingsMenu(ctx);
      }
      if (step === 'awaiting_set_mindep') {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt <= 0) {
          await ctx.reply('⚠️ Enter a valid number:');
          return;
        }
        setSetting('min_deposit', String(amt));
        ctx.session.adminStep = null;
        await ctx.reply(`✅ *Minimum deposit updated to:* *${formatCurrency(amt)}*`, { parse_mode: 'Markdown' });
        return showAdminSettingsMenu(ctx);
      }
      if (step === 'awaiting_set_support') {
        setSetting('support_username', text.replace('@', ''));
        ctx.session.adminStep = null;
        await ctx.reply(`✅ *Support username updated to:* @${text.replace('@', '')}`, { parse_mode: 'Markdown' });
        return showAdminSettingsMenu(ctx);
      }

      // Add service steps
      if (step === 'awaiting_svc_name') {
        ctx.session.adminData.name = text;
        ctx.session.adminStep = 'awaiting_svc_desc';
        await ctx.reply('Step 2/6: Enter *Description* (e.g. `High quality instant delivery`):', { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_svc_desc') {
        ctx.session.adminData.description = text;
        ctx.session.adminStep = 'awaiting_svc_price';
        await ctx.reply('Step 3/6: Enter *Price per 1,000 units* in ₹ (e.g. `50`):', { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_svc_price') {
        const p = parseFloat(text);
        if (isNaN(p) || p <= 0) {
          await ctx.reply('⚠️ Please enter a valid numerical price:');
          return;
        }
        ctx.session.adminData.price_per_k = p;
        ctx.session.adminStep = 'awaiting_svc_min';
        await ctx.reply('Step 4/6: Enter *Minimum Quantity* (e.g. `1000`):', { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_svc_min') {
        const min = parseInt(text, 10);
        if (isNaN(min) || min <= 0) {
          await ctx.reply('⚠️ Please enter a valid minimum quantity:');
          return;
        }
        ctx.session.adminData.min_quantity = min;
        ctx.session.adminStep = 'awaiting_svc_max';
        await ctx.reply('Step 5/6: Enter *Maximum Quantity* (e.g. `100000`):', { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_svc_max') {
        const max = parseInt(text, 10);
        if (isNaN(max) || max <= 0) {
          await ctx.reply('⚠️ Please enter a valid maximum quantity:');
          return;
        }
        ctx.session.adminData.max_quantity = max;
        ctx.session.adminStep = 'awaiting_svc_instr';
        await ctx.reply('Step 6/6: Enter *Order Instructions* (e.g. `Public profile link only`):', { parse_mode: 'Markdown' });
        return;
      }
      if (step === 'awaiting_svc_instr') {
        const data = ctx.session.adminData;
        data.instructions = text;

        run(
          `INSERT INTO services (platform, name, description, price_per_k, min_quantity, max_quantity, instructions, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [data.platform, data.name, data.description, data.price_per_k, data.min_quantity, data.max_quantity, data.instructions]
        );

        ctx.session.adminStep = null;
        ctx.session.adminData = {};

        await ctx.reply(
          `🎉 *Service Added Successfully!*\n\n` +
          `🏷️ *Name:* ${data.name}\n` +
          `🌐 *Platform:* ${data.platform}\n` +
          `💰 *Price:* ${formatCurrency(data.price_per_k)} / 1K\n` +
          `📦 *Limits:* ${data.min_quantity} - ${data.max_quantity}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Edit price
      if (step === 'awaiting_edit_price') {
        const p = parseFloat(text);
        if (isNaN(p) || p <= 0) {
          await ctx.reply('⚠️ Invalid price. Enter a valid number:');
          return;
        }
        const svcId = ctx.session.adminData.serviceId;
        run('UPDATE services SET price_per_k = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [p, svcId]);
        ctx.session.adminStep = null;
        await ctx.reply(`✅ *Price Updated to ${formatCurrency(p)} / 1K!*`, { parse_mode: 'Markdown' });
        return;
      }

      // Edit name
      if (step === 'awaiting_edit_name') {
        const svcId = ctx.session.adminData.serviceId;
        run('UPDATE services SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [text, svcId]);
        ctx.session.adminStep = null;
        await ctx.reply(`✅ *Service Name Updated!*`, { parse_mode: 'Markdown' });
        return;
      }

      // Edit limits
      if (step === 'awaiting_edit_limits') {
        const parts = text.split(/\s+/);
        const min = parseInt(parts[0], 10);
        const max = parseInt(parts[1], 10);
        if (isNaN(min) || isNaN(max) || min <= 0 || max < min) {
          await ctx.reply('⚠️ Format: `1000 50000` (min and max):', { parse_mode: 'Markdown' });
          return;
        }
        const svcId = ctx.session.adminData.serviceId;
        run('UPDATE services SET min_quantity = ?, max_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [min, max, svcId]);
        ctx.session.adminStep = null;
        await ctx.reply(`✅ *Limits updated to Min: ${min} | Max: ${max}*`, { parse_mode: 'Markdown' });
        return;
      }

      // Create gift code
      if (step === 'awaiting_gift_codename') {
        ctx.session.adminData.code = text.toUpperCase().replace(/\s+/g, '');
        ctx.session.adminStep = 'awaiting_gift_amount';
        await ctx.reply('Enter the *Reward Amount* in ₹ for this gift code:');
        return;
      }
      if (step === 'awaiting_gift_amount') {
        const amt = parseFloat(text);
        if (isNaN(amt) || amt <= 0) {
          await ctx.reply('⚠️ Please enter a valid reward amount:');
          return;
        }
        ctx.session.adminData.reward_amount = amt;
        ctx.session.adminStep = 'awaiting_gift_uses';
        await ctx.reply('Enter the *Maximum Number of Redemptions* (e.g. `50`):');
        return;
      }
      if (step === 'awaiting_gift_uses') {
        const maxUses = parseInt(text, 10);
        if (isNaN(maxUses) || maxUses <= 0) {
          await ctx.reply('⚠️ Please enter a valid number of uses:');
          return;
        }
        const gData = ctx.session.adminData;
        run(
          `INSERT INTO gift_codes (code, reward_amount, max_uses, used_count, is_active)
           VALUES (?, ?, ?, 0, 1)`,
          [gData.code, gData.reward_amount, maxUses]
        );
        ctx.session.adminStep = null;
        ctx.session.adminData = {};
        await ctx.reply(
          `🎉 *Gift Code Created!*\n\nCode: \`${gData.code}\`\nReward: *${formatCurrency(gData.reward_amount)}*\nMax Uses: *${maxUses}*`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Broadcast message
      if (step === 'awaiting_broadcast_message') {
        ctx.session.adminStep = null;
        return executeBroadcast(ctx, text);
      }
    }
  });

  // Global Error Handler
  bot.catch((err) => {
    logger.error('Telegram Bot uncaught error in middleware/handler:', err.error || err);
  });

  // Start Long Polling with auto-reconnect on network disconnects
  let conflictCount = 0;
  while (true) {
    try {
      logger.success(`Telegram Bot connecting! Listening via Long Polling...`);
      await bot.start({
        drop_pending_updates: false,
        onStart: (info) => {
          conflictCount = 0;
          logger.success(`🚀 @${info.username} is ONLINE and ready to receive requests!`);
        }
      });
      break;
    } catch (pollingErr) {
      const errMsg = String(pollingErr?.message || pollingErr?.description || '');
      const isConflict = pollingErr?.error_code === 409 || errMsg.includes('409') || errMsg.includes('Conflict');

      if (isConflict) {
        conflictCount++;
        const backoffSeconds = conflictCount > 2 ? 60 : 20;
        logger.warn('⚠️  409 Conflict: Another active bot instance is polling with this BOT_TOKEN.');
        logger.warn(`Waiting ${backoffSeconds}s to avoid disrupting the other active instance...`);
        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
      } else {
        conflictCount = 0;
        logger.error('Long polling connection error, reconnecting in 5 seconds...', pollingErr);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}

// Global Process Exception Handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception caught:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection caught at:', promise, 'reason:', reason);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully (SIGINT)...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully (SIGTERM)...');
  process.exit(0);
});

// Run bot with infinite auto-restart on fatal error
async function runForever() {
  while (true) {
    try {
      await main();
      break;
    } catch (err) {
      logger.error('Fatal initialization error. Restarting in 5s...', err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

runForever();
