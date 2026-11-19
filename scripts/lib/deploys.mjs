/**
 * Which of the site's live deploys `pnpm deploys:prune` deletes, and why
 * (round 21, audit 3, A2). Pure, so it is tested (netlify/lib/deploysPrune.test.ts).
 *
 * Every live deploy answers at its own address with its own code, reads
 * production's Blobs, and has its own /api rate-limit bucket (120 a minute
 * per address AND per domain), so each one shortens how long a single
 * address takes to spend the month's function runs. Kept:
 *
 * - the published production deploy, always;
 * - the newest few production deploys, for a rollback;
 * - every preview of a pull request that is still open (CI checks them).
 *
 * Everything else that is live goes: older production deploys, previews of
 * closed pull requests, branch deploys. Deploys that never went live
 * (cancelled, failed) serve nothing and are left alone.
 */

/** The site this is for, by name; anything else is refused. */
export const SITE_NAME = 'fuel-finder-au';

/**
 * The old name's redirect-only site (round 20). Never pruned, never
 * deleted: it holds `nsw-fuel-finder.netlify.app` so nobody else can claim it.
 */
export const REDIRECT_SITE_ID = 'a529d89d-b099-426e-99d1-a9f1dba0ef4c';

/** Production deploys kept for a rollback, the published one aside. */
export const KEEP_PRODUCTION = 3;

/**
 * @param {readonly { id: string; state: string; context: string; created_at: string; review_id?: number | null }[]} deploys
 * @param {{ publishedId: string | null; openPullRequests: ReadonlySet<number>; keepProduction?: number }} options
 */
export function planPrune(
  deploys,
  { publishedId, openPullRequests, keepProduction = KEEP_PRODUCTION },
) {
  const live = deploys
    .filter((deploy) => deploy.state === 'ready')
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  const recent = new Set(
    live
      .filter((deploy) => deploy.context === 'production' && deploy.id !== publishedId)
      .slice(0, keepProduction)
      .map((deploy) => deploy.id),
  );
  return live.map((deploy) => {
    const pr = deploy.review_id ?? null;
    if (deploy.id === publishedId) return { deploy, keep: true, reason: 'published production' };
    if (recent.has(deploy.id))
      return { deploy, keep: true, reason: 'recent production (rollback)' };
    if (deploy.context === 'deploy-preview' && pr !== null && openPullRequests.has(pr)) {
      return { deploy, keep: true, reason: `preview of open pull request #${String(pr)}` };
    }
    if (deploy.context === 'production') return { deploy, keep: false, reason: 'older production' };
    if (deploy.context === 'deploy-preview') {
      return {
        deploy,
        keep: false,
        reason: `preview of closed pull request #${String(pr ?? '?')}`,
      };
    }
    return { deploy, keep: false, reason: `${deploy.context} deploy` };
  });
}
