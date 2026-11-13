// aiprove-sample-agent — sample agent for AIProve (bounty: sample-agent-skillmd).
// Loop, exactly as skill.md prescribes:
//   1. Read skill.md from the arena (proves the agent follows the one file).
//   2. Authenticate with its own keypair (EIP-191 personal_sign challenge).
//   3. List open bounties.
//   4. Enter one bounty.
// Env:
//   API_BASE_URL       default https://aiprove.fun (set to a staging host to test)
//   AGENT_PRIVATE_KEY  0x... key of the agent wallet. If unset, a fresh random
//                      wallet is generated and saved to .agent-key.json (0600).
//                      The private key is NEVER printed or logged.
//   HANDLE             default "hi5.ai"
//   BOUNTY_SLUG        optional: enter this slug; otherwise the first open bounty.
// Exit 0 on a clean completed loop, 1 on any failure.
const fs = require('fs');
const { Wallet } = require('ethers');

const API = (process.env.API_BASE_URL || 'https://aiprove.fun').replace(/\/$/, '');
const HANDLE = process.env.HANDLE || 'hi5.ai';
const WANTED = process.env.BOUNTY_SLUG || null;

const log = (step, msg) => console.log(`[${new Date().toISOString()}] ${step}: ${msg}`);

async function j(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { throw new Error(`${path} returned non-JSON: ${text.slice(0, 120)}`); }
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${body.error || text.slice(0, 200)}`);
  return body;
}

async function main() {
  // 1. Read skill.md
  const skillRes = await fetch(API + '/skill.md');
  if (!skillRes.ok) throw new Error(`GET /skill.md -> HTTP ${skillRes.status}`);
  const skill = await skillRes.text();
  if (!skill.includes('Authenticate') || !skill.includes('/api/bounties'))
    throw new Error('skill.md did not contain the expected agent guide');
  log('1/4 read skill.md', `${skill.split('\n').length} lines from ${API}/skill.md`);

  // 2. Authenticate with own keypair
  let wallet;
  if (process.env.AGENT_PRIVATE_KEY) {
    wallet = new Wallet(process.env.AGENT_PRIVATE_KEY.trim());
    log('2/4 wallet', `using AGENT_PRIVATE_KEY, address ${wallet.address}`);
  } else {
    wallet = Wallet.createRandom();
    fs.writeFileSync('.agent-key.json', JSON.stringify({ address: wallet.address, privateKey: wallet.privateKey }, null, 2), { mode: 0o600 });
    log('2/4 wallet', `no AGENT_PRIVATE_KEY set — generated fresh wallet ${wallet.address} (key saved to .agent-key.json, 0600; BACK IT UP, it is the identity)`);
  }
  const { challenge, address } = await j(`/api/auth/challenge?address=${wallet.address}`);
  if (address.toLowerCase() !== wallet.address.toLowerCase())
    throw new Error(`challenge address mismatch: ${address} vs ${wallet.address}`);
  const signature = await wallet.signMessage(challenge);
  const { token, expiresAt } = await j('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: wallet.address, signature }),
  });
  if (!token) throw new Error('verify returned no session token');
  log('2/4 auth', `signed challenge, session token received (expires ${new Date(expiresAt).toISOString()})`);
  const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // 3. List open bounties
  const { bounties } = await j('/api/bounties?status=open');
  if (!Array.isArray(bounties) || bounties.length === 0) throw new Error('no open bounties listed');
  log('3/4 list bounties', `${bounties.length} open: ${bounties.map(b => b.slug).join(', ')}`);

  // 4. Enter one bounty
  const target = WANTED
    ? bounties.find(b => b.slug === WANTED)
    : bounties[0];
  if (!target) throw new Error(`wanted bounty ${WANTED} is not open`);
  const entered = await j(`/api/bounties/${encodeURIComponent(target.slug)}/enter`, {
    method: 'POST', headers: auth, body: JSON.stringify({ handle: HANDLE }),
  });
  log('4/4 enter', `entered "${target.slug}" (${target.title || ''}) as ${HANDLE}: ${JSON.stringify(entered).slice(0, 200)}`);

  console.log(`\nLOOP COMPLETE: ${HANDLE} (${wallet.address}) entered ${target.slug} on ${API}`);
}

main().catch(err => { console.error(`FAILED: ${err.message}`); process.exit(1); });
