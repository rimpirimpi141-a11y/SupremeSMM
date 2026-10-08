import { InlineKeyboard, Keyboard } from 'grammy';

export function getMainMenuKeyboard() {
  return new Keyboard()
    .text('🛍️ Services').text('👥 Refer').row()
    .text('👤 Profile').text('💳 Deposit').row()
    .text('📦 My Orders').text('🎁 Gift Code').row()
    .text('🔎 Search').text('🆘 Support').row()
    .text('🏠 Main Menu')
    .resized();
}

export function getCancelKeyboard() {
  return new Keyboard()
    .text('❌ Cancel Action')
    .resized()
    .oneTime();
}

export function getPlatformsKeyboard() {
  return new InlineKeyboard()
    .text('📸 Instagram', 'platform_Instagram').row()
    .text('📘 Facebook', 'platform_Facebook').row()
    .text('💬 WhatsApp', 'platform_WhatsApp');
}

export function getServicesKeyboard(services, platform) {
  const kb = new InlineKeyboard();
  for (const s of services) {
    kb.text(`${s.name} (₹${s.price_per_k}/1K)`, `svc_${s.id}`).row();
  }
  kb.text('🔙 Back to Platforms', 'nav_platforms');
  return kb;
}

export function getServiceDetailKeyboard(serviceId) {
  return new InlineKeyboard()
    .text('🛒 Order Now', `order_start_${serviceId}`).row()
    .text('🔙 Back to Services', 'nav_services_back');
}

export function getOrderConfirmKeyboard(draftId) {
  return new InlineKeyboard()
    .text('✅ Confirm Order', `order_confirm_${draftId}`)
    .text('❌ Cancel', `order_cancel_${draftId}`);
}

export function getDepositPromptKeyboard() {
  return new InlineKeyboard()
    .text('💳 Deposit Balance', 'nav_deposit');
}

export function getProfileKeyboard() {
  return new InlineKeyboard()
    .text('📦 My Orders', 'user_my_orders')
    .text('💳 Deposit', 'nav_deposit').row()
    .text('🎁 Redeem Code', 'nav_giftcode')
    .text('👥 My Referrals', 'nav_referrals');
}

export function getPaymentMethodsKeyboard(methods) {
  const kb = new InlineKeyboard();
  for (const m of methods) {
    kb.text(`💳 ${m.name}`, `dep_method_${m.id}`).row();
  }
  kb.text('❌ Cancel', 'dep_cancel');
  return kb;
}

export function getSkipUtrKeyboard() {
  return new InlineKeyboard()
    .text('⏭️ Skip UTR (Submit Screenshot Only)', 'dep_skip_utr').row()
    .text('❌ Cancel Deposit', 'dep_cancel');
}

export function getSupportKeyboard(supportUsername) {
  const username = (supportUsername || 'SUPREMEXAURA01').replace('@', '');
  return new InlineKeyboard()
    .url('💬 Contact Support directly', `https://t.me/${username}`).row()
    .text('💳 Deposit Funds', 'nav_deposit')
    .text('🛍️ Browse Services', 'nav_platforms');
}

/* ==========================================================================
   ADMIN BOTTOM REPLY KEYBOARDS (CLEAN 2-COLUMN LAYOUT)
   ========================================================================== */
export function getAdminReplyKeyboard() {
  return new Keyboard()
    .text('👤 Users').text('🛍️ Services').row()
    .text('📦 Orders').text('💳 Deposits').row()
    .text('🎁 Gift Codes').text('👥 Referrals').row()
    .text('📊 Statistics').text('📢 Broadcast').row()
    .text('📢 Force Channel').text('💳 Payment Methods').row()
    .text('👑 Manage Admins').text('⚙️ Settings').row()
    .text('🔧 Maintenance').text('🏠 Exit Admin')
    .resized();
}

export function getAdminUsersReplyKeyboard() {
  return new Keyboard()
    .text('🔎 Search User').text('💰 Add Balance').row()
    .text('➖ Deduct Balance').text('🚫 Ban User').row()
    .text('✅ Unban User').text('📋 View User').row()
    .text('🔙 Back').text('🏠 Admin Home')
    .resized();
}

export function getAdminForceChannelReplyKeyboard() {
  return new Keyboard()
    .text('➕ Add Force Channel').text('📋 Channel List').row()
    .text('🔛 Toggle Force Join').text('🗑️ Remove Channel').row()
    .text('🔙 Back').text('🏠 Admin Home')
    .resized();
}

export function getAdminPaymentMethodsReplyKeyboard() {
  return new Keyboard()
    .text('➕ Add QR').text('📋 View QR').row()
    .text('✏️ Edit QR').text('🗑️ Delete QR').row()
    .text('🔙 Back').text('🏠 Admin Home')
    .resized();
}

export function getAdminAdminsReplyKeyboard() {
  return new Keyboard()
    .text('➕ Add Admin').text('➖ Remove Admin').row()
    .text('📋 Admin List').row()
    .text('🔙 Back').text('🏠 Admin Home')
    .resized();
}

export function getAdminSettingsReplyKeyboard() {
  return new Keyboard()
    .text('📢 Force Channel').text('💳 Payment Methods').row()
    .text('🆘 Support Username').text('💰 Min Deposit').row()
    .text('💵 Referral Commission').row()
    .text('🔙 Back').text('🏠 Admin Home')
    .resized();
}

/* ==========================================================================
   FORCE JOIN INLINE KEYBOARD
   ========================================================================== */
export function getForceJoinInlineKeyboard(channels) {
  const kb = new InlineKeyboard();
  for (const ch of channels) {
    const username = ch.channel_username.replace('@', '');
    const title = ch.channel_title || `@${username}`;
    const url = ch.invite_link || `https://t.me/${username}`;
    kb.url(`📢 Join ${title}`, url).row();
  }
  kb.text('✅ Check Join', 'check_force_join');
  return kb;
}

/* ==========================================================================
   ADMIN INLINE KEYBOARDS FOR SPECIFIC ACTIONS
   ========================================================================== */
export function getDepositDecisionKeyboard(depositId) {
  return new InlineKeyboard()
    .text('✅ Approve Deposit', `adm_dep_approve_${depositId}`)
    .text('❌ Reject Deposit', `adm_dep_reject_${depositId}`);
}

export function getOrderManagementKeyboard(orderId) {
  return new InlineKeyboard()
    .text('⏳ In Progress', `adm_ord_status_${orderId}_Processing`)
    .text('✅ Completed', `adm_ord_status_${orderId}_Completed`).row()
    .text('❌ Cancel', `adm_ord_status_${orderId}_Cancelled`)
    .text('💰 Refund', `adm_ord_refund_${orderId}`).row()
    .text('🔙 Back to Orders', 'admin_orders');
}

export function getAdminServicesMenuKeyboard() {
  return new InlineKeyboard()
    .text('➕ Add Service', 'adm_svc_add').text('📋 List Services', 'adm_svc_list').row()
    .text('✏️ Edit Price / Service', 'adm_svc_edit_select');
}

export function getAdminOrdersMenuKeyboard() {
  return new InlineKeyboard()
    .text('⏳ Pending Orders', 'adm_ord_pending').text('📋 Recent Orders', 'adm_ord_all');
}

export function getAdminDepositsMenuKeyboard() {
  return new InlineKeyboard()
    .text('⏳ Pending Deposits', 'adm_dep_pending').text('📋 Recent Deposits', 'adm_dep_all');
}

export function getAdminGiftCodesMenuKeyboard() {
  return new InlineKeyboard()
    .text('➕ Create Gift Code', 'adm_gift_add').text('📋 Active Codes', 'adm_gift_list');
}
