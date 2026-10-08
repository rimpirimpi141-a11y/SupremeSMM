import { query, get } from '../database.js';
import { getPlatformsKeyboard, getServicesKeyboard, getServiceDetailKeyboard } from '../keyboards.js';
import { formatCurrency, formatNumber } from '../utils/pricing.js';

export async function showPlatformsMenu(ctx) {
  const text = 
`🛍️ *Social Media Services Catalog*

Select your desired platform below to view available services, live prices, and instant packages:`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: getPlatformsKeyboard()
      });
      await ctx.answerCallbackQuery();
    } catch (e) {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: getPlatformsKeyboard()
      });
    }
  } else {
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: getPlatformsKeyboard()
    });
  }
}

export async function handlePlatformSelection(ctx, platformName) {
  const services = query(
    'SELECT * FROM services WHERE platform = ? AND is_active = 1 ORDER BY id ASC',
    [platformName]
  );

  if (services.length === 0) {
    await ctx.answerCallbackQuery({ text: `No active services available for ${platformName} yet.` });
    return;
  }

  const icons = {
    Instagram: '📸',
    Facebook: '📘',
    WhatsApp: '💬'
  };
  const icon = icons[platformName] || '🛍️';

  const text = 
`${icon} *${platformName} Services*

Select a service below to view full specifications, instructions, and place an order:`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: getServicesKeyboard(services, platformName)
  });
  await ctx.answerCallbackQuery();
}

export async function handleServiceDetails(ctx, serviceId) {
  const service = get('SELECT * FROM services WHERE id = ?', [serviceId]);

  if (!service) {
    await ctx.answerCallbackQuery({ text: 'Service not found or removed.' });
    return;
  }

  const icons = {
    Instagram: '📸',
    Facebook: '📘',
    WhatsApp: '💬'
  };
  const icon = icons[service.platform] || '🛍️';

  const text = 
`${icon} *Service Details*

🏷️ *Name:* ${service.name}
🌐 *Platform:* ${service.platform}
💰 *Price:* ${formatCurrency(service.price_per_k)} / 1,000 units
📦 *Minimum:* ${formatNumber(service.min_quantity)}
📦 *Maximum:* ${formatNumber(service.max_quantity)}

📝 *Description:*
_${service.description || 'Fast high-quality delivery'}_

📌 *Instructions:*
_${service.instructions || 'Ensure account/link is public before ordering'}_`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: getServiceDetailKeyboard(service.id)
  });
  await ctx.answerCallbackQuery();
}

export async function startSearchServices(ctx) {
  ctx.session.step = 'awaiting_search_query';
  ctx.session.data = {};

  await ctx.reply(
    `🔎 *Search SMM Services*\n\nEnter a keyword to search (e.g. \`followers\`, \`views\`, \`likes\`, \`instagram\`, \`facebook\`, \`whatsapp\`):`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleSearchInput(ctx) {
  const term = ctx.message.text.trim();
  ctx.session.step = null;

  if (term.length < 2) {
    await ctx.reply('⚠️ Please enter at least 2 characters to search.');
    return;
  }

  const results = query(
    `SELECT * FROM services 
     WHERE is_active = 1 
     AND (name LIKE ? OR platform LIKE ? OR description LIKE ?) 
     ORDER BY platform, price_per_k ASC LIMIT 10`,
    [`%${term}%`, `%${term}%`, `%${term}%`]
  );

  if (results.length === 0) {
    await ctx.reply(`❌ No services found matching "*${term}*".\n\nTry browsing all services via 🛍️ Services menu.`, {
      parse_mode: 'Markdown'
    });
    return;
  }

  let text = `🔎 *Search Results for "${term}":*\n\n`;
  for (const s of results) {
    text += `🔹 *#${s.id} ${s.name}*\n`;
    text += `   🌐 Platform: ${s.platform}\n`;
    text += `   💰 Price: ${formatCurrency(s.price_per_k)} / 1K\n`;
    text += `   📦 Min: ${formatNumber(s.min_quantity)} | Max: ${formatNumber(s.max_quantity)}\n\n`;
  }
  text += `👇 _Click below to select a service:_`;

  const kb = getServicesKeyboard(results, 'Search');
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: kb
  });
}
