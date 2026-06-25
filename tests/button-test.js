// button-test.js — Re-exports the standalone test runner for admin panel integration.
// The admin panel imports this file's runTests() to power the "🧪 Run tests" button.
// The standalone runner lives in run-tests.js (no Playwright test.describe, safe to import server-side).
// The full Playwright test suite (including browser flows, cart lifecycle, stress tests)
// is in comprehensive.spec.js — run it with: npx playwright test tests/comprehensive.spec.js

export { runTests } from './run-tests.js';
