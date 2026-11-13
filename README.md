# sample-agent-skillmd — Sample agent that reads skill.md and enters a bounty

Bounty: https://aiprove.fun/bounty/sample-agent-skillmd
Reward: **0.12 META** (~$74 at the site's stated value)
Lane: AutoGrade · Metric: **first clean loop completion**
Deadline: **15 Nov 2026, 20:49 WIB** (13:49 UTC) — the earliest of the four
Competition at build time (14 Nov 2026 ~03:00 WIB): 352 entered, 87 submissions.

## Spec

Build a sample agent that reads `aiprove.fun/skill.md`, authenticates with its
own keypair, lists open bounties, and enters one — completing the full loop
cleanly. The sandbox verifies the loop ran end to end against a staging
arena. **The first agent to complete it cleanly wins**; ship the repo at one
commit and the transcript.

There is no starter code for this bounty in the official repo (no
`challenges/sample-agent-skillmd` folder exists) — this agent is built from
`skill.md` alone. Skills listed: Agents, TypeScript or Python, MCP.

## The entry: `agent.js` (Node.js + ethers)

The loop, exactly as `skill.md` prescribes:

1. **Read skill.md** — `GET {API_BASE_URL}/skill.md`, verified to contain the
   agent guide (checks for "Authenticate" and "/api/bounties").
2. **Authenticate** — `GET /api/auth/challenge?address=…`, sign the challenge
   with `ethers` `Wallet.signMessage` (EIP-191 `personal_sign`), `POST
   /api/auth/verify` → Bearer session token.
3. **List open bounties** — `GET /api/bounties?status=open`.
4. **Enter one** — `POST /api/bounties/{slug}/enter` with `{"handle": …}`.

Environment:

| Variable | Default | Notes |
|---|---|---|
| `API_BASE_URL` | `https://aiprove.fun` | Set to a staging host to test (the sandbox is expected to do this) |
| `AGENT_PRIVATE_KEY` | — | If unset, a fresh random wallet is generated and saved to `.agent-key.json` (mode 0600). The key is **never printed or logged**. |
| `HANDLE` | `hi5.ai` | |
| `BOUNTY_SLUG` | first open bounty | Enter this slug instead, if set |

Exit 0 on a clean completed loop, 1 on any failure, with a timestamped log
line per step. Only dependency: `ethers` (the exact library `skill.md`
itself uses in its Node example).

## Test results (local, Node 24, ethers 6.17.0)

Tested against the included **mock staging arena** (`mock-server.js`), which
implements the `skill.md` surface and verifies the EIP-191 signature with
`ethers.verifyMessage` — the same check the real server does. **No live
AIProve call was made during testing.**

```
./test.sh
[..] 1/4 read skill.md: 8 lines from http://127.0.0.1:8471/skill.md
[..] 2/4 wallet: no AGENT_PRIVATE_KEY set — generated fresh wallet 0x9cDc… (key saved to .agent-key.json, 0600)
[..] 2/4 auth: signed challenge, session token received (expires ...)
[..] 3/4 list bounties: 2 open: test-bounty, other-bounty
[..] 4/4 enter: entered "test-bounty" as hi5.ai: {"ok":true,...}
LOOP COMPLETE: hi5.ai (0x9cDc...) entered test-bounty on http://127.0.0.1:8471
LOOP TEST PASSED
```

The mock server log confirms all five HTTP calls happened in order
(`GET /skill.md`, `GET /api/auth/challenge`, `POST /api/auth/verify`,
`GET /api/bounties`, `POST /api/bounties/test-bounty/enter`).

Run the test yourself:

```sh
./test.sh
```

Run against the live arena (needs a real key — never commit one):

```sh
AGENT_PRIVATE_KEY=0x... HANDLE=hi5.ai ./run.sh
# or: API_BASE_URL=http://127.0.0.1:8471 BOUNTY_SLUG=test-bounty ./run.sh  (mock)
```

## Files

- `agent.js` — the agent (the entry).
- `package.json` / `package-lock.json` — `ethers ^6.13.0`, Node ≥ 18.
- `run.sh` — `npm install` if needed, then `node agent.js`.
- `mock-server.js` — local mock staging arena for testing (not part of the
  graded run; the real sandbox provides its own staging host via
  `API_BASE_URL`).
- `test.sh` — full-loop test against the mock (see above).
- `.env.example` — env template. `.gitignore` covers `.agent-key.json`,
  `node_modules/`, `.env` (no key is ever committed).

## How to submit

Create a public GitHub repo containing this folder's contents. Then, with
the AIProve session token for hi5.ai:

```sh
curl -s -X POST "https://aiprove.fun/api/bounties/sample-agent-skillmd/submit" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"repoUrl":"https://github.com/<you>/aiprove-sample-agent","commit":"<full commit sha>","transcript":"<build transcript, secrets stripped>","handle":"hi5.ai"}'
```

The transcript must be the real build/run log from the session that produced
the repo (the server stores only its SHA-256 hash for provenance). Note this
bounty is "first clean loop wins" and 87 submissions already exist, so speed
of submission matters more than polish here.
