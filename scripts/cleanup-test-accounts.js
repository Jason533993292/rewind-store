#!/usr/bin/env node
// Cleanup test accounts from blocked emails, chat sessions, and orders
const BASE = 'https://rewind-stores.com';
const emails = [
  'test-ai-working@example.com', 'fullerror@example.com', 'errorspy@example.com',
  'debug-save2@example.com', 'now-it-works@example.com', 'final-final@example.com',
  'check@example.com', 'new-test@example.com', 'final-truth@example.com',
  'debug-ai@example.com', 'final-real-test@example.com', 'real-test-now@example.com',
  'longwait@test.com', 'final-test@example.com', 'test-ai@example.com',
  'test-final@example.com', 'test999@example.com', 'test777@example.com',
  'test@example.com', 'spammer@example.com', 'spam@test.com',
];

async function unblock(email) {
  try {
    const r = await fetch(BASE + '/api/admin/unblock-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const d = await r.json();
    console.log(email, d.ok ? '✅' : '❌', d.error || '');
  } catch { console.log(email, '❌ network error'); }
}

async function run() {
  console.log('Unblocking ' + emails.length + ' emails...');
  for (const e of emails) {
    await unblock(e);
  }
  console.log('Done!');
}
run();
