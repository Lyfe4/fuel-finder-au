// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { planPrune, REDIRECT_SITE_ID, SITE_NAME } from '../../scripts/lib/deploys.mjs';

/**
 * Which live deploys `pnpm deploys:prune` deletes (scripts/lib/deploys.mjs,
 * round 21, A2). Tested here, beside the backfill script's logic, because
 * Vitest runs only src/, shared/ and netlify/.
 */
const deploy = (
  id: string,
  context: string,
  created: string,
  extra: { state?: string; review_id?: number | null } = {},
) => ({ id, context, created_at: `2026-11-${created}:00Z`, state: 'ready', ...extra });

const DEPLOYS = [
  deploy('p6', 'production', '19T04:46'),
  deploy('p5', 'production', '19T03:35'),
  deploy('p4', 'production', '19T03:31'),
  deploy('p3', 'production', '19T03:11'),
  deploy('p2', 'production', '04T00:47'),
  deploy('p1', 'production', '01T00:29'),
  deploy('cancelled', 'production', '19T05:10', { state: 'error' }),
  deploy('open-a', 'deploy-preview', '19T06:00', { review_id: 37 }),
  deploy('open-b', 'deploy-preview', '19T05:50', { review_id: 37 }),
  deploy('closed', 'deploy-preview', '19T04:33', { review_id: 35 }),
  deploy('branch', 'branch-deploy', '18T10:00'),
];

const plan = (published: string | null, open = new Set([37])) =>
  Object.fromEntries(
    planPrune(DEPLOYS, { publishedId: published, openPullRequests: open }).map((d) => [
      d.deploy.id,
      d.keep ? `keep: ${d.reason}` : `delete: ${d.reason}`,
    ]),
  );

describe('planPrune', () => {
  it('keeps the published deploy, three more for a rollback, and open pull requests’ previews', () => {
    expect(plan('p6')).toEqual({
      'open-a': 'keep: preview of open pull request #37',
      'open-b': 'keep: preview of open pull request #37',
      p6: 'keep: published production',
      p5: 'keep: recent production (rollback)',
      p4: 'keep: recent production (rollback)',
      closed: 'delete: preview of closed pull request #35',
      p3: 'keep: recent production (rollback)',
      branch: 'delete: branch-deploy deploy',
      p2: 'delete: older production',
      p1: 'delete: older production',
    });
  });

  it('never lists a deploy that did not go live', () => {
    expect(plan('p6')).not.toHaveProperty('cancelled');
  });

  it('keeps the published deploy even when it is an old one (after a rollback)', () => {
    const decisions = plan('p1');
    expect(decisions.p1).toBe('keep: published production');
    expect(decisions.p6).toBe('keep: recent production (rollback)');
    expect(decisions.p3).toBe('delete: older production');
  });

  it('deletes every preview once its pull request is closed', () => {
    const decisions = plan('p6', new Set());
    expect(decisions['open-a']).toMatch(/^delete/);
    expect(decisions['open-b']).toMatch(/^delete/);
  });

  it('is only for this site, and names the redirect site to refuse it', () => {
    expect(SITE_NAME).toBe('fuel-finder-au');
    expect(REDIRECT_SITE_ID).toBe('a529d89d-b099-426e-99d1-a9f1dba0ef4c');
  });
});
