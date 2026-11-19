/** Types for deploys.mjs, so its TypeScript test is checked. */

export const SITE_NAME: string;
export const REDIRECT_SITE_ID: string;
export const KEEP_PRODUCTION: number;

export interface Deploy {
  id: string;
  state: string;
  context: string;
  created_at: string;
  review_id?: number | null;
}

export interface PruneDecision<D extends Deploy = Deploy> {
  deploy: D;
  keep: boolean;
  reason: string;
}

export function planPrune<D extends Deploy>(
  deploys: readonly D[],
  options: {
    publishedId: string | null;
    openPullRequests: ReadonlySet<number>;
    keepProduction?: number;
  },
): PruneDecision<D>[];
