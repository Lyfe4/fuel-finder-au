/**
 * Deletes the site's old live deploys (round 21, audit 3, A2).
 *
 *   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... pnpm deploys:prune            (dry run: the list)
 *   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... pnpm deploys:prune --delete   (asks, then deletes)
 *
 * Why: every live deploy keeps its own address, code and /api rate-limit
 * bucket on production's Blobs, so each one shortens how long one address
 * takes to spend the month's function runs (docs/decisions.md, Baseline).
 * What is kept and why is in scripts/lib/deploys.mjs: the published
 * deploy, the newest production deploys for a rollback, and previews of
 * open pull requests. Part of the end-of-round routine (README, Maintenance).
 *
 * Only for the `fuel-finder-au` site: it refuses any other, and above all the
 * `nsw-fuel-finder` redirect site, which must never be touched. Open pull
 * requests are read from GitHub (public; GITHUB_TOKEN is used if set); if
 * that fails, nothing is deleted. A dry run changes nothing. With --delete
 * it lists the same, then deletes only after you type "delete N". Use a
 * personal access token with a short expiry, and revoke it afterwards.
 */
import { createInterface } from 'node:readline/promises';

import { planPrune, REDIRECT_SITE_ID, SITE_NAME } from './lib/deploys.mjs';

const NETLIFY = 'https://api.netlify.com/api/v1';
const REPO = 'Lyfe4/fuel-finder-au';

async function netlify(token, path, init = {}) {
  const response = await fetch(`${NETLIFY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!response.ok)
    throw new Error(`Netlify ${init.method ?? 'GET'} ${path}: HTTP ${String(response.status)}`);
  return response.status === 204 ? null : response.json();
}

async function allDeploys(token, siteId) {
  const deploys = [];
  for (let page = 1; ; page += 1) {
    const batch = await netlify(
      token,
      `/sites/${siteId}/deploys?per_page=100&page=${String(page)}`,
    );
    deploys.push(...batch);
    if (batch.length < 100) return deploys;
  }
}

async function openPullRequests() {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100`,
    {
      headers,
    },
  );
  if (!response.ok) throw new Error(`GitHub: HTTP ${String(response.status)}`);
  return new Set((await response.json()).map((pr) => pr.number));
}

const row = ({ deploy, keep, reason }) =>
  `${keep ? 'keep  ' : 'DELETE'}  ${deploy.id}  ${deploy.created_at.slice(0, 16).replace('T', ' ')}  ` +
  `${deploy.context.padEnd(14)} ${(deploy.commit_ref ?? '').slice(0, 7).padEnd(7)}  ${reason}`;

/**
 * Returns the exit code. Set through process.exitCode rather than
 * process.exit(), which crashes Node on Windows with readline just closed.
 */
async function main() {
  const remove = process.argv.includes('--delete');
  const { NETLIFY_SITE_ID: siteId, NETLIFY_AUTH_TOKEN: token } = process.env;
  if (!siteId || !token) {
    console.error('deploys:prune needs NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN in the environment.');
    return 1;
  }
  if (siteId === REDIRECT_SITE_ID) {
    console.error('That is the nsw-fuel-finder redirect site. It is never pruned.');
    return 1;
  }
  const site = await netlify(token, `/sites/${siteId}`);
  if (site.name !== SITE_NAME) {
    console.error(`This script is only for ${SITE_NAME}; that site is ${String(site.name)}.`);
    return 1;
  }

  const [deploys, open] = await Promise.all([allDeploys(token, siteId), openPullRequests()]);
  const plan = planPrune(deploys, {
    publishedId: site.published_deploy?.id ?? null,
    openPullRequests: open,
  });
  const doomed = plan.filter((decision) => !decision.keep);
  console.log(
    `${site.name}: ${String(plan.length)} live deploys; open pull requests: ${[...open].map((n) => `#${String(n)}`).join(', ') || 'none'}.\n`,
  );
  for (const decision of plan) console.log(row(decision));
  console.log(`\n${String(doomed.length)} to delete, ${String(plan.length - doomed.length)} kept.`);
  if (doomed.length === 0 || !remove) {
    if (!remove && doomed.length > 0)
      console.log('Dry run: nothing deleted. Add --delete to delete them.');
    return 0;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const wanted = `delete ${String(doomed.length)}`;
  const answer = await rl.question(
    `Type "${wanted}" to delete them, anything else to leave them: `,
  );
  rl.close();
  if (answer.trim() !== wanted) {
    console.log('Left as they are.');
    return 0;
  }

  let failed = 0;
  for (const { deploy } of doomed) {
    try {
      await netlify(token, `/sites/${siteId}/deploys/${deploy.id}`, { method: 'DELETE' });
      console.log(`Deleted ${deploy.id}`);
    } catch (error) {
      failed += 1;
      console.error(`Could not delete ${deploy.id}: ${String(error)}`);
    }
  }
  const left = new Set((await allDeploys(token, siteId)).map((deploy) => deploy.id));
  const remaining = doomed.filter(({ deploy }) => left.has(deploy.id)).length;
  console.log(
    remaining === 0
      ? `Done: ${String(doomed.length)} deleted; the published deploy is ${String(site.published_deploy?.id)}.`
      : `${String(remaining)} still listed: check them.`,
  );
  return failed > 0 || remaining > 0 ? 1 : 0;
}

process.exitCode = await main();
