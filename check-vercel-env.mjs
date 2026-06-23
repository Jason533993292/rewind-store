import fs from 'fs';

const content = fs.readFileSync('.env.vercel', 'utf8');
const match = content.match(/VERCEL_OIDC_TOKEN="([^"]+)"/);
if (!match) { console.log('No token found'); process.exit(1); }
const token = match[1];

const res = await fetch('https://api.vercel.com/v10/projects/prj_js16WUyxbkcvUxx0e7uOZzPo857u/env?teamId=team_nyrdgk33zllMixPH6ob6OyH9', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const data = await res.json();
if (data.error) {
  console.log('API Error:', JSON.stringify(data.error));
} else {
  const envs = Array.isArray(data.envs) ? data.envs : (data.envs || []);
  envs.forEach(e => console.log(`${e.key}=${e.value ? '(set, ' + e.value.length + ' chars)' : '(empty)'} [targets: ${e.target?.join(',')}]`));
  if (envs.length === 0) console.log('No env vars found (or different API response format):', JSON.stringify(data).slice(0,500));
}
