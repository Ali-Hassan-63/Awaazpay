/* AwaazPay — demo-data.js
 * ALL DATA HERE IS FICTIONAL. Nothing is connected to a real bank, wallet or biller.
 * Names, reference numbers and amounts exist only to demonstrate the interface.
 */
(function (global) {
  'use strict';

  const DEMO = {
    account: {
      holder: { ur: 'ڈیمو صارف', en: 'Demo User' },
      number: 'DEMO-0000-1234',
      startBalance: 48500
    },

    limits: {
      maxAmount: 100000,   // simulated per-action limit (Rs)
      refLength: 8         // fictional bill reference numbers are 8 digits
    },

    /* One fictional bill per category. `ref` is what the user "finds" on a bill. */
    billers: {
      electricity: {
        id: 'electricity', icon: 'bolt',
        label: { ur: 'بجلی', en: 'Electricity' },
        name: { ur: 'فرضی بجلی کمپنی', en: 'Demo Electric Co.' },
        ref: '10010001', amount: 3450,
        due: { ur: '25 اکتوبر', en: '25 October' }
      },
      gas: {
        id: 'gas', icon: 'flame',
        label: { ur: 'گیس', en: 'Gas' },
        name: { ur: 'فرضی گیس لمیٹڈ', en: 'Demo Gas Ltd.' },
        ref: '20020002', amount: 1280,
        due: { ur: '28 اکتوبر', en: '28 October' }
      },
      water: {
        id: 'water', icon: 'drop',
        label: { ur: 'پانی', en: 'Water' },
        name: { ur: 'فرضی واٹر بورڈ', en: 'Demo Water Board' },
        ref: '30030003', amount: 450,
        due: { ur: '30 اکتوبر', en: '30 October' }
      },
      internet: {
        id: 'internet', icon: 'wifi',
        label: { ur: 'انٹرنیٹ', en: 'Internet' },
        name: { ur: 'فرضی نیٹ براڈ بینڈ', en: 'Demo Net Broadband' },
        ref: '40040004', amount: 2200,
        due: { ur: '2 نومبر', en: '2 November' }
      }
    },
    billerOrder: ['electricity', 'gas', 'water', 'internet'],

    recipients: [
      { id: 'ahmed',  name: { ur: 'احمد خان',     en: 'Ahmed Khan' },   relation: { ur: 'بیٹا',     en: 'Son' },      account: 'DEMO-AC-0101' },
      { id: 'fatima', name: { ur: 'فاطمہ بی بی', en: 'Fatima Bibi' },  relation: { ur: 'بہن',      en: 'Sister' },   account: 'DEMO-AC-0102' },
      { id: 'bilal',  name: { ur: 'بلال سٹور',   en: 'Bilal Store' },  relation: { ur: 'دکاندار',  en: 'Shopkeeper' }, account: 'DEMO-AC-0103' },
      { id: 'ayesha', name: { ur: 'عائشہ نور',   en: 'Ayesha Noor' },  relation: { ur: 'پڑوسی',    en: 'Neighbour' }, account: 'DEMO-AC-0104' }
    ],

    /* Negative = money out, positive = money in. status: completed | failed */
    transactions: [
      { id: 'seed-1', date: '2026-10-09', type: 'transfer', amount: -2000,  status: 'completed', desc: { ur: 'فاطمہ بی بی کو رقم بھیجی',   en: 'Sent to Fatima Bibi' } },
      { id: 'seed-2', date: '2026-10-07', type: 'bill',     amount: -1150,  status: 'completed', desc: { ur: 'گیس کا بل — فرضی گیس لمیٹڈ',   en: 'Gas bill — Demo Gas Ltd.' } },
      { id: 'seed-3', date: '2026-10-05', type: 'deposit',  amount: 25000,  status: 'completed', desc: { ur: 'ڈیمو رقم موصول ہوئی',          en: 'Demo deposit received' } },
      { id: 'seed-4', date: '2026-10-02', type: 'bill',     amount: -450,   status: 'completed', desc: { ur: 'پانی کا بل — فرضی واٹر بورڈ',  en: 'Water bill — Demo Water Board' } },
      { id: 'seed-5', date: '2026-09-28', type: 'transfer', amount: -800,   status: 'completed', desc: { ur: 'بلال سٹور کو رقم بھیجی',       en: 'Sent to Bilal Store' } },
      { id: 'seed-6', date: '2026-09-25', type: 'bill',     amount: -2200,  status: 'failed',    desc: { ur: 'انٹرنیٹ کا بل — مکمل نہیں ہوا (کوئی رقم نہیں کٹی)', en: 'Internet bill — not completed (no money was taken)' } }
    ]
  };

  global.DEMO = DEMO;
})(typeof window !== 'undefined' ? window : globalThis);
