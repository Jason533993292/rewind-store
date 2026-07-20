// Load env vars from .env for local development (Railway/Prod set them in the environment).
import 'dotenv/config';

// Local development entry point — delegates to api/server.js
// For Vercel deployment, api/server.js is used directly.
import app from './api/server.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`REWIND server running on :${PORT}`));
