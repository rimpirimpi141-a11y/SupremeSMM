import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  ShieldCheck, 
  Database, 
  Terminal, 
  CheckCircle2, 
  Copy, 
  Layers, 
  ExternalLink,
  Smartphone,
  CreditCard,
  Gift,
  Users,
  Search,
  ShoppingCart
} from 'lucide-react';

export default function App() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sampleServices = [
    { id: 1, platform: 'Instagram', name: 'Instagram Followers (HQ)', price: '₹50 / 1K', min: '1,000', max: '100,000' },
    { id: 2, platform: 'Instagram', name: 'Instagram Views (Reels/Video)', price: '₹20 / 1K', min: '1,000', max: '500,000' },
    { id: 3, platform: 'Instagram', name: 'Instagram Likes (HQ Real)', price: '₹30 / 1K', min: '1,000', max: '100,000' },
    { id: 4, platform: 'Facebook', name: 'Facebook Followers (Page/Profile)', price: '₹50 / 1K', min: '1,000', max: '100,000' },
    { id: 5, platform: 'Facebook', name: 'Facebook Views (Video/Reels)', price: '₹25 / 1K', min: '1,000', max: '500,000' },
    { id: 6, platform: 'Facebook', name: 'Facebook Likes (Post Likes)', price: '₹35 / 1K', min: '1,000', max: '100,000' },
    { id: 7, platform: 'WhatsApp', name: 'WhatsApp Followers / Members', price: '₹50 / 1K', min: '1,000', max: '50,000' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-white">SMM PANEL</h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">Telegram Bot API</span>
              </div>
              <p className="text-xs text-slate-400">Supreme Owner: <span className="text-amber-400 font-semibold tracking-wider">𝐒𝐔𝐏𝐑𝐄𝐌𝐄 𝐇𝐄𝐑𝐄</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Long Polling Ready
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              ⚡ Production SMM Architecture • Node.js + grammY + SQLite
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Real Telegram SMM Services Ordering Engine
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Complete automated bot with user order flows, balance transactions, manual deposit proofs verification with admin approve/reject buttons, multi-tier gift voucher codes, referral tracking, and a comprehensive in-chat <code className="text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">/admin</code> dashboard.
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Multi-Step Order Flow</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Interactive target link input, live quantity calculation (₹50/1K), real-time balance checks, and atomic order creation.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Deposit & Proof Verification</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Users submit UPI payment screenshot/UTR. Admin receives proof directly in Telegram with instant Approve / Reject buttons.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Strict Financial Safety</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              SQLite ACID transactions, zero negative balances, duplicate refund prevention, and full transaction history audit logs.
            </p>
          </div>
        </div>

        {/* Live Catalog Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Initial Service Catalog (Editable via /admin)
              </h3>
              <p className="text-xs text-slate-400">Admin can change any price, limit, or name inside Telegram without touching code.</p>
            </div>
            <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300">
              {sampleServices.length} Active Services Seeded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 uppercase bg-slate-950/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">#ID</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-4">Price / 1,000</th>
                  <th className="py-3 px-4">Min - Max Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sampleServices.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400">#{s.id}</td>
                    <td className="py-3 px-4 font-sans font-medium text-cyan-300">{s.platform}</td>
                    <td className="py-3 px-4 font-sans text-slate-200">{s.name}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{s.price}</td>
                    <td className="py-3 px-4 text-slate-400">{s.min} - {s.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Launch & Deployment Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Commands */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Bot Commands & Interactions
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <code className="text-cyan-400 font-bold">/start</code>
                  <p className="text-slate-400 mt-0.5">Launches main menu, registers user & checks referral payload</p>
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <code className="text-amber-400 font-bold">/admin</code>
                  <p className="text-slate-400 mt-0.5">Opens master control panel for ADMIN_TELEGRAM_ID</p>
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <code className="text-purple-400 font-bold">/orders</code> & <code className="text-purple-400 font-bold">/profile</code>
                  <p className="text-slate-400 mt-0.5">Inspect user wallet balance, stats, and real-time order states</p>
                </div>
              </div>
            </div>
          </div>

          {/* Render & GitHub Deploy */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              Render & GitHub Deployment
            </h3>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>1. Push this repository to your GitHub account.</p>
              <p>2. Create a new <strong>Background Worker</strong> (or Web Service) on Render.</p>
              <p>3. Set Build Command: <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono">npm install</code></p>
              <p>4. Set Start Command: <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono">npm start</code></p>
              <p>5. Add Environment Variables:</p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                <div>BOT_TOKEN=your_botfather_token</div>
                <div>ADMIN_TELEGRAM_ID=your_telegram_id</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>SMM PANEL Bot • Brand: <span className="text-slate-300 font-medium">𝐒𝐔𝐏𝐑𝐄𝐌𝐄 𝐇𝐄𝐑𝐄</span> • Powered by grammY & SQLite</p>
      </footer>
    </div>
  );
}
