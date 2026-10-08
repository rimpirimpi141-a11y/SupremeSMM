# 🔥 SMM PANEL — Telegram Bot

A production-ready Telegram SMM Panel Bot built using **Node.js (JavaScript)**, **grammY**, and **SQLite**. Supports real-time social media service ordering, automated pricing calculations, deposit verification with proof screenshots, gift codes, referral systems, and a complete Telegram-based Admin Dashboard.

- **Supreme Owner:** `𝐒𝐔𝐏𝐑𝐄𝐌𝐄 𝐇𝐄𝐑𝐄`
- **Bot Name:** `SMM PANEL`
- **Engine:** grammY Framework with Telegram Long Polling
- **Database:** SQLite (ACID compliant with financial transaction safety)

---

## 🚀 Key Features

### 🛍️ User Features
- **Interactive SMM Catalog:** Browse by platform (**📸 Instagram**, **📘 Facebook**, **💬 WhatsApp**).
- **Default Services & Live Pricing:**
  - **Instagram:** Followers (1K = ₹50, 2K = ₹100), Views (1K = ₹20), Likes (1K = ₹30)
  - **Facebook:** Followers (1K = ₹50, 2K = ₹100), Views (1K = ₹25), Likes (1K = ₹35)
  - **WhatsApp:** Followers / Channel Members (1K = ₹50, 2K = ₹100)
- **Automatic Price Calculation:** Automatically calculates total cost based on the quantity and price per 1000.
- **Smart Order Flow:** Multi-step prompt for target link, quantity validation, balance check, and instant receipt generation.
- **📦 My Orders:** View order history with live status updates (*Pending*, *Processing*, *Completed*, *Cancelled*, *Refunded*).
- **👤 Profile:** Displays Name, Telegram ID, Wallet Balance, Total Orders, Referrals count, and Joined Date.
- **💳 Deposit System:** Users enter deposit amount, view admin UPI payment details, and submit screenshot/UTR proof.
- **👥 Referral Program:** Unique referral link (`https://t.me/BOT_USERNAME?start=ref_USER_ID`) with configurable bonus rewards.
- **🎁 Gift Codes:** Redeem promo vouchers with redemption limits and expiry validation.
- **🔎 Search Services:** Fast search by keyword (e.g. `followers`, `likes`, `views`, `instagram`).

---

### 👑 Admin Features (`/admin`)
Only users matching `ADMIN_TELEGRAM_ID` can access the admin control panel:
- **👤 Users Management:** Search users by ID/username, view balances, grant balance bonuses, deduct balances, or ban/unban users.
- **🛍️ Services Management:**
  - ➕ Add new services with custom platform, name, description, price per 1000, min/max limits, and instructions.
  - ✏️ Edit service prices per 1000 without touching source code!
  - 🔴 Enable / Disable / Delete services anytime.
- **📦 Orders Management:** View pending tasks, update status to *Processing*, *Completed*, *Cancelled*, or *Refund* (automatically refunds wallet balance safely).
- **💳 Deposits Management:** Review user deposit proofs directly in Telegram and approve or reject with 1 click.
- **🎁 Gift Codes Management:** Create new gift voucher codes with custom rewards, redemption limits, and expiry.
- **📊 Statistics Dashboard:** View total users, total orders, total order volume, deposits, and user wallet holdings.
- **⚙️ Settings:** Edit UPI ID, minimum deposit amount, referral bonus, support username, and payment instructions.
- **📢 Broadcast:** Send formatted broadcast messages to all registered bot users with live delivery tracking.
- **🔧 Maintenance Mode:** Toggle system maintenance on/off with 1 click.

---

## 🛠️ Installation & Local Setup

### 1. Clone or Download Repository
```bash
git clone https://github.com/your-username/telegram-smm-panel-bot.git
cd telegram-smm-panel-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
ADMIN_TELEGRAM_ID=123456789
NODE_ENV=production
DATABASE_PATH=./data/database.sqlite
```

### 4. How to Get Your Credentials
1. **Create Bot & Get `BOT_TOKEN`:**
   - Open Telegram and message [@BotFather](https://t.me/BotFather).
   - Send `/newbot` and follow prompts to pick a name and username.
   - Copy the API token provided by BotFather.
2. **Get Your `ADMIN_TELEGRAM_ID`:**
   - Message [@userinfobot](https://t.me/userinfobot) or [@raw_data_bot](https://t.me/raw_data_bot) on Telegram.
   - Copy your numerical Telegram ID (e.g. `987654321`).

### 5. Start the Bot
```bash
npm start
```

---

## ☁️ Render Deployment (Long Polling)

Deploying to [Render](https://render.com) takes under 3 minutes:

### Option A: Deploy as a Background Worker (Recommended)
1. Push your code to a GitHub repository.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** and select **Background Worker**.
4. Connect your GitHub repository.
5. Configure the build settings:
   - **Name:** `smm-panel-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Scroll down to **Environment Variables** and add:
   - `BOT_TOKEN` = `your_bot_token_from_botfather`
   - `ADMIN_TELEGRAM_ID` = `your_numerical_telegram_id`
   - `NODE_ENV` = `production`
7. Click **Create Background Worker**. Render will build and run your bot continuously using Telegram Long Polling!

### Option B: Deploy as a Web Service
If deploying as a Web Service on Render:
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- Add `BOT_TOKEN` and `ADMIN_TELEGRAM_ID` in Environment Variables.

---

## 📂 Project Structure

```
.
├── src/
│   ├── bot.js               # Main bot entry point & long polling listener
│   ├── database.js          # SQLite database schema, seeding & queries
│   ├── config.js            # Environment config & brand constants
│   ├── keyboards.js         # Telegram Reply & Inline keyboards
│   ├── handlers/
│   │   ├── start.js         # /start command & deep-link referral processing
│   │   ├── services.js      # Service catalog browsing & search
│   │   ├── orders.js        # Multi-step order flow & My Orders list
│   │   ├── profile.js       # User profile with wallet balance & stats
│   │   ├── referrals.js     # Referral link generator & reward tracking
│   │   ├── deposits.js      # Manual deposit flow & payment proof handler
│   │   ├── giftcodes.js     # Gift code redemption logic
│   │   └── admin.js         # Comprehensive /admin dashboard
│   └── utils/
│       ├── pricing.js       # Price calculations & currency formatters
│       ├── transactions.js  # Strict financial safety & balance deductions
│       └── logger.js        # Formatted console logger
├── data/
│   └── database.sqlite      # SQLite persistent storage
├── .env.example             # Environment variable template
├── package.json             # NPM scripts & dependencies
└── README.md                # Documentation & setup guide
```

---

## 💰 How Service Prices Can Be Changed

There are two easy ways to edit service prices:

### Method 1: Directly inside Telegram via Admin Panel (Recommended)
1. Send `/admin` in Telegram.
2. Click **🛍️ Services** -> **✏️ Edit / Change Price**.
3. Select any service from the list (e.g. `Instagram Followers`).
4. Click **💰 Change Price (1K)**.
5. Type the new price (e.g. `45` or `120`) and send. The price updates instantly!

### Method 2: Initial Seed Defaults in Code
Initial seed values are defined in `src/database.js` under `seedInitialData()`:
```javascript
{
  platform: 'Instagram',
  name: 'Instagram Followers (HQ)',
  price_per_k: 50.0,
  min_quantity: 1000,
  max_quantity: 100000,
}
```

---

## 🛡️ Financial Safety & ACID Guarantees
- **Atomic Balance Updates:** Uses SQLite transactions for all balance modifications.
- **Zero Negative Balance:** Strict check ensures orders cannot proceed if funds are insufficient.
- **Audit Logging:** Every credit, deduction, refund, and bonus is recorded in the `transactions` table with `balance_before` and `balance_after`.
- **Double-Action Prevention:** Deposits and orders cannot be approved or refunded multiple times.

---

## 📜 License
Distributed under the MIT License. Built for **𝐒𝐔𝐏𝐑𝐄𝐌𝐄 𝐇𝐄𝐑𝐄**.
