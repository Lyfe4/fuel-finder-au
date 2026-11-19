import type { HandlerDeps } from './router';
import type { InvocationContext } from '../../lib/snapshot/context';

type GateDeps = Pick<HandlerDeps, 'qldEnv' | 'qldSwitch'>;

/**
 * THE QUEENSLAND GATE, per request: QLD_PUBLIC, the published production
 * deploy, and the owner's kill switch, all three (deps.ts says why each).
 * The switch is read only when the first two hold, so no other deploy, and
 * no deploy built with QLD_PUBLIC off, reads it for a route that serves data.
 */
export async function qldFor(
  deps: GateDeps,
  context: InvocationContext | undefined,
): Promise<boolean> {
  if (!deps.qldEnv || context?.deploy?.published !== true) return false;
  return (await deps.qldSwitch?.()) ?? false;
}

/**
 * Round 21 (audit 3, A4): the owner's switch says "serve Queensland", but
 * this published production deploy cannot, because it was built without
 * QLD_PUBLIC=true (the variable deleted or mistyped, then a rebuild).
 * Queensland would then vanish with /api/status still 200, so nobody hears
 * of it. Only /api/status asks, and only on the published deploy: a preview
 * or an old deploy never serves Queensland, by design, and is not this
 * case. The switch's record is the owner's stated intent; reading it
 * publishes nothing of Queensland's data.
 */
export async function qldIntendedButShut(
  deps: GateDeps,
  served: boolean,
  context: InvocationContext | undefined,
): Promise<boolean> {
  if (served || deps.qldEnv || context?.deploy?.published !== true || !deps.qldSwitch) {
    return false;
  }
  return deps.qldSwitch();
}
