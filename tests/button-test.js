// button-test.js — Re-exports the comprehensive test suite for admin panel integration.
// The admin panel imports this file's runTests() to power the "🧪 Run tests" button.
// The real test suite is in comprehensive.spec.js which includes Playwright browser tests,
// full cart lifecycle, navigation verification, and backend API checks.

export { runTests } from './comprehensive.spec.js';
