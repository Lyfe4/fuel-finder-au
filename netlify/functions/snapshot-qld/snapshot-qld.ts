/**
 * Queensland's scheduled job: every 10 minutes (from :03), fetch every Queensland price
 * from the Fuel Prices Qld API into Netlify Blobs, under `qld/`. The only
 * code that calls that API. Separate from the NSW job (snapshot.ts) so that
 * neither's failure, retry or lockout can touch the other: see
 * netlify/lib/qld/run.ts and docs/qld-plan.md.
 *
 * Writing the data is not publishing it: the API serves Queensland only
 * when QLD_PUBLIC is on (docs/qld-plan.md, "What has to happen before QLD
 * prices go public").
 *
 * Locally: `netlify dev`, then `netlify functions:invoke snapshot-qld`. Each
 * run makes real calls with the real token.
 */
import { qldRunResponse, runQldSnapshot } from '../../lib/qld/run';
import { runsIn, type InvocationContext } from '../../lib/snapshot/context';
import { blobStore } from '../../lib/store';

export default async (_request: Request, context?: InvocationContext): Promise<Response> => {
  if (!runsIn(context)) {
    const message = `Not run: the QLD snapshot job runs in production only (this is a ${String(context?.deploy?.context)}).`;
    console.info(message);
    return new Response(JSON.stringify({ ok: false, skipped: message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const summary = await runQldSnapshot({
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    store: blobStore(),
    token: () => process.env.QLD_FPD_TOKEN ?? null,
  });

  // One line per run in the function log, success or not. Never the token.
  if (summary.ok) console.info('qld snapshot ok', JSON.stringify(summary));
  else console.error('qld snapshot failed', JSON.stringify(summary));

  // Always 200: Netlify is never asked to retry (qldRunResponse, round 18).
  return qldRunResponse(summary);
};

/*
 * Must be a string literal: Netlify reads it from the source without running
 * it. Cron is UTC. Every 10 minutes from :03 (round 18): off the hour and
 * half hour, when the Aggregator is busiest and the NSW job (:00, :30) runs.
 * A test checks it is every QLD_SNAPSHOT_INTERVAL_MINUTES and never on a
 * minute of NSW's.
 */
export const config = {
  schedule: '3,13,23,33,43,53 * * * *',
};
