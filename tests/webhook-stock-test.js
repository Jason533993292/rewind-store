// Tests for Stripe webhook stock decrement logic
// Run: node tests/webhook-stock-test.js

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ ${msg}`);
  }
}

// ── Stock decrement logic (extracted from webhook handler) ──

function computeNewStock(currentStock, qty) {
  const safeStock = currentStock ?? 0;
  if (qty > safeStock) {
    console.warn(`  ⚠ insufficient stock (have ${safeStock}, need ${qty}) — clamping to 0`);
  }
  return Math.max(0, safeStock - qty);
}

function stripSizeSuffix(name) {
  return name.replace(/\s*\(.*?\)\s*$/, '').trim();
}

// ── Tests ──

console.log('\n📦 Stock Decrement Tests\n');

console.log('── computeNewStock ──');
assert(computeNewStock(5, 2) === 3, 'stock 5, qty 2 → 3');
assert(computeNewStock(1, 1) === 0, 'stock 1, qty 1 → 0');
assert(computeNewStock(0, 1) === 0, 'stock 0, qty 1 → 0 (no negative)');
assert(computeNewStock(3, 10) === 0, 'stock 3, qty 10 → 0 (clamped)');
assert(computeNewStock(null, 2) === 0, 'stock null → treated as 0');
assert(computeNewStock(undefined, 2) === 0, 'stock undefined → treated as 0');
assert(computeNewStock(10, 0) === 10, 'qty 0 → no change');
assert(computeNewStock(3, 2) === 1, 'stock 3, qty 2 → 1');

console.log('\n── stripSizeSuffix ──');
assert(stripSizeSuffix('Vintage Nike Windbreaker (M)') === 'Vintage Nike Windbreaker', 'strips (M) suffix');
assert(stripSizeSuffix('Vintage Nike Windbreaker (XL)') === 'Vintage Nike Windbreaker', 'strips (XL) suffix');
assert(stripSizeSuffix('Vintage Nike Windbreaker') === 'Vintage Nike Windbreaker', 'no size suffix → unchanged');
assert(stripSizeSuffix('Champion Hoodie (L) extra') === 'Champion Hoodie (L) extra', 'size in middle → unchanged');
assert(stripSizeSuffix('Item (One Size)') === 'Item', 'strips (One Size) suffix');
assert(stripSizeSuffix('') === '', 'empty string → empty');
assert(stripSizeSuffix('  Spaces Around (M)  ') === 'Spaces Around', 'trims spaces');

console.log('\n── Integration Scenarios ──\n');

// Scenario 1: Normal flow
console.log('Scenario 1: Normal decrement');
const items1 = [
  { name: 'Vintage Nike Windbreaker (M)', price: 45, qty: 1 },
  { name: 'Levi 501 Jeans (32x34)', price: 60, qty: 2 },
];
const products1 = {
  'Vintage Nike Windbreaker': { stock: 5 },
  'Levi 501 Jeans': { stock: 3 },
};
for (const it of items1) {
  if (!it.name || !it.qty) continue;
  const productName = stripSizeSuffix(it.name);
  const p = products1[productName];
  if (!p) continue;
  const newStock = computeNewStock(p.stock, it.qty);
  p.stock = newStock; // simulate PATCH
}
assert(products1['Vintage Nike Windbreaker'].stock === 4, 'Nike Windbreaker: 5 - 1 = 4');
assert(products1['Levi 501 Jeans'].stock === 1, 'Levi 501 Jeans: 3 - 2 = 1');

// Scenario 2: Product not found
console.log('Scenario 2: Product not found (skip)');
const items2 = [{ name: 'Unknown Item', qty: 1 }];
const products2 = {};
let skipped = false;
for (const it of items2) {
  if (!it.name || !it.qty) continue;
  const productName = stripSizeSuffix(it.name);
  if (!products2[productName]) {
    skipped = true;
    continue;
  }
}
assert(skipped, 'unknown product → skipped with warning');

// Scenario 3: Insufficient stock with warning
console.log('Scenario 3: Insufficient stock');
const items3 = [{ name: 'Rare Sneakers', qty: 3 }];
const products3 = { 'Rare Sneakers': { stock: 1 } };
let warned = false;
const origWarn = console.warn;
console.warn = (msg) => { if (msg.includes('insufficient')) warned = true; };
for (const it of items3) {
  if (!it.name || !it.qty) continue;
  const productName = stripSizeSuffix(it.name);
  const p = products3[productName];
  const newStock = computeNewStock(p.stock, it.qty);
  p.stock = newStock;
}
console.warn = origWarn;
assert(warned, 'insufficient stock triggers warning');
assert(products3['Rare Sneakers'].stock === 0, 'stock clamped to 0');

// Scenario 4: Item with no name or no qty
console.log('Scenario 4: Skip invalid items');
let skippedInvalid = 0;
const items4 = [
  { name: '', qty: 1 },
  { name: 'Valid Item', qty: 0 },
  { name: 'Good Item', qty: 2 },
];
for (const it of items4) {
  if (!it.name || !it.qty) { skippedInvalid++; continue; }
  // would decrement here
}
assert(skippedInvalid === 2, 'two invalid items skipped');

// ── Summary ──
console.log(`\n${'─'.repeat(40)}`);
const total = passed + failed;
console.log(`\n📊 Results: ${passed}/${total} passed, ${failed}/${total} failed\n`);
process.exit(failed > 0 ? 1 : 0);
