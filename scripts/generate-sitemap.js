// Generates public/sitemap.xml from the product catalogue so search engines can
// discover every /product/:id route, not just the homepage.
// Runs automatically as the "postbuild" npm script; can also be run manually:
//   node scripts/generate-sitemap.js
import { REWIND_PRODUCTS } from '../src/data.js';
import { writeFileSync } from 'fs';

const urls = [
  { loc: 'https://rewind-stores.com/', priority: '1.0' },
  ...REWIND_PRODUCTS.map((p) => ({ loc: `https://rewind-stores.com/product/${p.id}`, priority: '0.8' })),
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((u) => `  <url><loc>${u.loc}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`)
    .join('\n') +
  `\n</urlset>\n`;

writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml written with ${urls.length} URLs (1 homepage + ${REWIND_PRODUCTS.length} products).`);
