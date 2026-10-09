import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { CONFIG, PERMANENT_SUPER_ADMIN_ID } from './config.js';
import { logger } from './utils/logger.js';

let dbInstance = null;
let SQL = null;
const dbFilePath = path.resolve(process.cwd(), CONFIG.DATABASE_PATH);

export async function initDatabase() {
  if (dbInstance) return dbInstance;

  try {
    SQL = await initSqlJs();
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(dbFilePath)) {
      const fileBuffer = fs.readFileSync(dbFilePath);
      dbInstance = new SQL.Database(fileBuffer);
      logger.info(`Loaded existing SQLite database from ${dbFilePath}`);
    } else {
      dbInstance = new SQL.Database();
      logger.info(`Created fresh SQLite database at ${dbFilePath}`);
    }

    createTables();
    seedInitialData();
    saveDatabase();
    return dbInstance;
  } catch (err) {
    logger.error('Failed to initialize SQLite database:', err);
    throw err;
  }
}

export function saveDatabase() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    logger.error('Error saving SQLite database to disk:', err);
  }
}

function createTables() {
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      balance REAL DEFAULT 0.0,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0.0,
      is_banned INTEGER DEFAULT 0,
      referrer_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price_per_k REAL NOT NULL,
      min_quantity INTEGER NOT NULL DEFAULT 1000,
      max_quantity INTEGER NOT NULL DEFAULT 100000,
      instructions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      service_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      target TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT,
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_code TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method_name TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      proof_file_id TEXT,
      utr_reference TEXT,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      qr_file_id TEXT,
      upi_id TEXT,
      instructions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id TEXT NOT NULL,
      referred_id TEXT UNIQUE NOT NULL,
      reward_amount REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gift_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      reward_amount REAL NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at DATETIME,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gift_code_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_id INTEGER NOT NULL,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      reward_amount REAL NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code_id, telegram_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS force_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_username TEXT UNIQUE NOT NULL,
      channel_title TEXT,
      invite_link TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      telegram_id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe schema migrations for existing databases
  try {
    const adminCols = query("PRAGMA table_info(admins)").map(c => c.name);
    if (!adminCols.includes('name')) {
      dbInstance.run("ALTER TABLE admins ADD COLUMN name TEXT;");
    }
    if (!adminCols.includes('username')) {
      dbInstance.run("ALTER TABLE admins ADD COLUMN username TEXT;");
    }
  } catch (e) {
    logger.warn('Admins table column migration notice:', e.message || e);
  }

  try {
    const depositCols = query("PRAGMA table_info(deposits)").map(c => c.name);
    if (!depositCols.includes('payment_method_name')) {
      dbInstance.run("ALTER TABLE deposits ADD COLUMN payment_method_name TEXT;");
    }
  } catch (e) {
    logger.warn('Deposits table column migration notice:', e.message || e);
  }
}

function seedInitialData() {
  // Check if services exist
  const countRes = query('SELECT COUNT(*) as cnt FROM services');
  const serviceCount = countRes[0]?.cnt || 0;

  if (serviceCount === 0) {
    logger.info('Seeding initial service catalog...');
    const initialServices = [
      // Instagram
      {
        platform: 'Instagram',
        name: 'Instagram Followers (HQ)',
        description: 'High Quality Instagram followers with instant start and high retention.',
        price_per_k: 50.0,
        min_quantity: 1000,
        max_quantity: 100000,
        instructions: 'Provide Instagram public profile link (e.g., https://instagram.com/username)'
      },
      {
        platform: 'Instagram',
        name: 'Instagram Views (Video/Reels)',
        description: 'Ultra-fast video & reels views for algorithm boost.',
        price_per_k: 20.0,
        min_quantity: 1000,
        max_quantity: 500000,
        instructions: 'Provide public Reel or Video link'
      },
      {
        platform: 'Instagram',
        name: 'Instagram Likes (HQ Real)',
        description: 'Instant delivery high quality likes for posts and reels.',
        price_per_k: 30.0,
        min_quantity: 1000,
        max_quantity: 100000,
        instructions: 'Provide post or reel link'
      },
      // Facebook
      {
        platform: 'Facebook',
        name: 'Facebook Followers (Page/Profile)',
        description: 'Global Facebook followers for public pages and profiles.',
        price_per_k: 50.0,
        min_quantity: 1000,
        max_quantity: 100000,
        instructions: 'Provide Facebook public page or profile link'
      },
      {
        platform: 'Facebook',
        name: 'Facebook Views (Video/Reels)',
        description: 'Fast Facebook video watch views for public posts.',
        price_per_k: 25.0,
        min_quantity: 1000,
        max_quantity: 500000,
        instructions: 'Provide Facebook public video link'
      },
      {
        platform: 'Facebook',
        name: 'Facebook Likes (Post Likes)',
        description: 'Active likes for Facebook public posts and photos.',
        price_per_k: 35.0,
        min_quantity: 1000,
        max_quantity: 100000,
        instructions: 'Provide Facebook post link'
      },
      // WhatsApp
      {
        platform: 'WhatsApp',
        name: 'WhatsApp Followers / Channel Members',
        description: 'Real WhatsApp Channel followers to grow your channel audience.',
        price_per_k: 50.0,
        min_quantity: 1000,
        max_quantity: 50000,
        instructions: 'Provide WhatsApp Channel invite link'
      }
    ];

    for (const s of initialServices) {
      run(
        `INSERT INTO services (platform, name, description, price_per_k, min_quantity, max_quantity, instructions, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [s.platform, s.name, s.description, s.price_per_k, s.min_quantity, s.max_quantity, s.instructions]
      );
    }
  }

  // Seed default settings
  const defaultSettings = [
    { key: 'min_deposit', value: String(CONFIG.DEFAULT_MIN_DEPOSIT) },
    { key: 'referral_bonus', value: String(CONFIG.DEFAULT_REFERRAL_BONUS) },
    { key: 'upi_id', value: CONFIG.DEFAULT_UPI_ID },
    { key: 'payment_instructions', value: CONFIG.DEFAULT_PAYMENT_INSTRUCTIONS },
    { key: 'maintenance_mode', value: '0' },
    { key: 'support_username', value: CONFIG.DEFAULT_SUPPORT_USERNAME },
    { key: 'broadcast_pin', value: '0' },
    { key: 'force_join_enabled', value: '0' },
    { key: 'referral_commission_percent', value: '10' },
  ];

  for (const item of defaultSettings) {
    const exists = get('SELECT key FROM settings WHERE key = ?', [item.key]);
    if (!exists) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [item.key, item.value]);
    }
  }

  // Permanent Super Admin Ownership Migration & Seeding
  const ownerId = String(CONFIG.ADMIN_TELEGRAM_ID || PERMANENT_SUPER_ADMIN_ID).trim();
  
  // Demote or remove any old owner who is not the permanent super admin
  run("UPDATE admins SET role = 'admin' WHERE role = 'owner' AND telegram_id != ?", [ownerId]);
  run("DELETE FROM admins WHERE telegram_id = '8838351233' AND telegram_id != ?", [ownerId]);

  // Ensure the permanent Super Admin is registered as 'owner'
  const adminRow = get('SELECT role FROM admins WHERE telegram_id = ?', [ownerId]);
  if (!adminRow) {
    run('INSERT INTO admins (telegram_id, role, name) VALUES (?, ?, ?)', [ownerId, 'owner', 'Super Admin']);
    logger.info(`Super Admin registered: ${ownerId}`);
  } else if (adminRow.role !== 'owner') {
    run("UPDATE admins SET role = 'owner' WHERE telegram_id = ?", [ownerId]);
    logger.info(`Super Admin promoted to owner: ${ownerId}`);
  }

  // Pre-seed the two required Force Join destinations
  const defaultForceChannels = [
    {
      username: '@unlimitedbaatkaro',
      title: 'UNLIMITED BAATCHIT',
      link: 'https://t.me/unlimitedbaatkaro'
    },
    {
      username: '@auraescow',
      title: 'AURA+ ESCROW SERVICE',
      link: 'https://t.me/auraescow'
    }
  ];

  for (const fc of defaultForceChannels) {
    const exists = get('SELECT id FROM force_channels WHERE channel_username = ?', [fc.username]);
    if (!exists) {
      run(
        `INSERT INTO force_channels (channel_username, channel_title, invite_link, is_active)
         VALUES (?, ?, ?, 1)`,
        [fc.username, fc.title, fc.link]
      );
      logger.info(`Seeded required force channel: ${fc.username} (${fc.title})`);
    } else {
      // Ensure active and title/link are set
      run(
        `UPDATE force_channels SET is_active = 1, channel_title = ?, invite_link = ? WHERE channel_username = ?`,
        [fc.title, fc.link, fc.username]
      );
    }
  }

  // Ensure force_join_enabled defaults to '1' (enabled) so verification is active
  const currentForceJoinSetting = getSetting('force_join_enabled');
  if (!currentForceJoinSetting || currentForceJoinSetting === '0') {
    setSetting('force_join_enabled', '1');
    logger.info('Enabled force join requirement by default for required channels.');
  }

  // Seed default payment method if none exists
  const pmCount = query('SELECT COUNT(*) as cnt FROM payment_methods');
  if ((pmCount[0]?.cnt || 0) === 0) {
    run(
      `INSERT INTO payment_methods (name, qr_file_id, upi_id, instructions, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [
        'UPI QR / Direct Transfer',
        null,
        CONFIG.DEFAULT_UPI_ID,
        'Scan QR or pay directly to the UPI ID. Upload payment screenshot after transfer.'
      ]
    );
  }
}

export function query(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized. Call initDatabase() first.');
  try {
    const stmt = dbInstance.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    logger.error(`Database query error: [${sql}]`, err);
    throw err;
  }
}

export function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;

export function run(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized. Call initDatabase() first.');
  try {
    dbInstance.run(sql, params);
    if (!inTransaction) {
      saveDatabase();
    }
    return { success: true };
  } catch (err) {
    logger.error(`Database run error: [${sql}]`, err);
    throw err;
  }
}

export function transaction(fn) {
  if (!dbInstance) throw new Error('Database not initialized. Call initDatabase() first.');
  if (inTransaction) {
    // Nested transaction support
    return fn();
  }

  inTransaction = true;
  try {
    dbInstance.exec('BEGIN TRANSACTION;');
    const result = fn();
    dbInstance.exec('COMMIT;');
    inTransaction = false;
    saveDatabase();
    return result;
  } catch (err) {
    try {
      dbInstance.exec('ROLLBACK;');
    } catch (e) {
      // ignore rollback failure if transaction was not active
    }
    inTransaction = false;
    logger.error('Transaction failed and rolled back:', err);
    throw err;
  }
}

export function getSetting(key, fallback = '') {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
}

export function isSuperAdmin(telegramId) {
  if (!telegramId) return false;
  const strId = String(telegramId).trim();
  const configuredOwner = String(CONFIG.ADMIN_TELEGRAM_ID || '').trim();
  const permanentOwner = String(PERMANENT_SUPER_ADMIN_ID || '').trim();
  
  // Explicitly deny previous owner if someone accidentally passed it
  if (strId === '8838351233' && permanentOwner !== '8838351233') {
    return false;
  }

  // True if matches permanent owner or configured owner
  return Boolean(
    (permanentOwner && strId === permanentOwner) ||
    (configuredOwner && strId === configuredOwner)
  );
}

export function isAdminUser(telegramId) {
  if (!telegramId) return false;
  const strId = String(telegramId).trim();

  // Explicitly deny previous owner if not authorized
  if (strId === '8838351233') {
    return false;
  }

  if (isSuperAdmin(strId)) {
    return true;
  }
  const row = get('SELECT telegram_id FROM admins WHERE telegram_id = ?', [strId]);
  return !!row;
}
