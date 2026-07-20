const fs = require('fs');
let server = fs.readFileSync('api/server.js', 'utf8');

const blanketEnd = server.indexOf('requireAdmin(req, res, next);\n});\n\n');
if (blanketEnd === -1) { console.log('ERROR: blanket middleware not found'); process.exit(1); }

const beforeBlanket = server.substring(0, blanketEnd + 'requireAdmin(req, res, next);\n});\n\n'.length);

const cleanupStart = server.indexOf('// ── Cleanup test accounts');
if (cleanupStart === -1) { console.log('ERROR: cleanup section not found'); process.exit(1); }

const afterBlanket = server.substring(cleanupStart);

// Use anonKey instead of SUPABASE_KEY to avoid redeclaration conflict
const newMiddle = `// ── Admin route modules (registered after blanket auth) ──
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

registerAdminOrdersRoutes({ app, SUPABASE_URL, resend, FROM_EMAIL, REPLY_TO, escapeHtml, auditLog, getAdminEmailFromToken });
registerAdminBlockingRoutes({ app, SUPABASE_URL, SUPABASE_KEY: anonKey, resend, FROM_EMAIL, REPLY_TO, escapeHtml, auditLog, getAdminEmailFromToken, BLOCKED_IPS, BLOCKED_EMAILS });
registerAdminProductRoutes({ app, SUPABASE_URL, auditLog, getAdminEmailFromToken });
registerAdminAuditRoutes({ app, SUPABASE_URL, auditLog, getAdminEmailFromToken });

`;

const newServer = beforeBlanket + newMiddle + afterBlanket;
fs.writeFileSync('api/server.js', newServer);
console.log('OK - old lines: ' + server.split('\n').length + ', new lines: ' + newServer.split('\n').length);
