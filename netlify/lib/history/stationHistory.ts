import { z } from 'zod';

import { FUEL_TYPE_CODES, type FuelTypeCode } from '../../../shared/fuelTypes';

import type { HistoryDayRow, HistorySource } from '../../../shared/api';

/**
 * PER-STATION HISTORY, what the chart reads: one small file per station, so a
 * view costs one or two reads of ~15 kB, not 90 reads of a 260 kB day file.
 *
 *   { "version": 2, "code": "972", "source": "snapshots",
 *     "from": "2026-10-23", "through": "2026-10-24",
 *     "fuels": { "U91": [["2026-10-23", 239.9, 241.9, 241.9], ...] } }
 *
 * Two of them per station, never mixed:
 *
 * - `history/v2/backfill/{code}`: from FuelCheck's published monthly history
 *   (CC BY-SA), written once by scripts/build-history-backfill.mjs. That
 *   script writes the same format by hand; its test checks it against this
 *   schema.
 * - `history/v2/live/{code}`: from our own daily files (history/v1/DAY),
 *   folded in by the scheduled job a slice of stations at a time (fold.ts).
 *
 * Kept apart so the job and the backfill never write the same key, and so
 * the licence of each stays visible.
 */
export const STATION_HISTORY_VERSION = 2;

const fuelCodes = FUEL_TYPE_CODES as [FuelTypeCode, ...FuelTypeCode[]];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const row = z.tuple([day, z.number(), z.number(), z.number()]);

export const stationHistorySchema = z.object({
  version: z.literal(STATION_HISTORY_VERSION),
  code: z.string(),
  source: z.enum(['fuelcheck-monthly', 'snapshots']),
  from: day,
  through: day,
  fuels: z.partialRecord(z.enum(fuelCodes), z.array(row)),
});

export type StationHistory = z.infer<typeof stationHistorySchema>;

/** The first day we have our own daily file for (production's history/v1/ starts here). */
export const LIVE_HISTORY_START = '2026-10-23';

/** Days of our own history kept per station: a year and a bit, so ~25 kB at most. */
export const LIVE_DAYS_KEPT = 400;

/** How far back the chart looks. */
export const HISTORY_WINDOW_DAYS = 120;

/** Calendar arithmetic on "YYYY-MM-DD", with no time zone involved. */
export function addDays(dayString: string, days: number): string {
  const date = new Date(`${dayString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * NSW history's licence, per source (round 21, audit 3, A8). FuelCheck's
 * published price history on data.nsw.gov.au is CC BY-SA, so the days
 * adapted from it are shared under CC BY-SA 4.0. Our own days come from the
 * API.NSW Fuel API, whose terms state no open licence (they defer to the
 * authority administering the information), so those days claim none: they
 * are credited and used under API.NSW's terms.
 */
export function nswHistoryLicence(sources: readonly HistorySource[]): string {
  const parts = ['Daily low, high and last price.'];
  for (const source of sources) {
    if (source.kind === 'fuelcheck-monthly') {
      parts.push(
        `${source.from} to ${source.through}: adapted from NSW FuelCheck price history ` +
          '(NSW Fair Trading, data.nsw.gov.au, CC BY-SA); these days are shared under CC BY-SA 4.0.',
      );
    } else {
      parts.push(
        `${source.from} to ${source.through}: from our own snapshots of NSW FuelCheck prices, ` +
          'through the API.NSW Fuel API, used under its terms.',
      );
    }
  }
  return parts.join(' ');
}

/**
 * One fuel's history for the chart: the published history, then our own for
 * the days after it ends. Where both have a day, the published one wins: it
 * has every change, ours only what a 30-minute snapshot saw.
 */
export function mergeHistory(
  backfill: StationHistory | null,
  live: StationHistory | null,
  fuel: FuelTypeCode,
  since: string,
): { days: HistoryDayRow[]; sources: HistorySource[] } {
  const days: HistoryDayRow[] = [];
  const sources: HistorySource[] = [];
  const take = (history: StationHistory | null, after: string | null) => {
    const rows = (history?.fuels[fuel] ?? []).filter(
      ([d]) => d >= since && (after === null || d > after),
    );
    const first = rows[0];
    const last = rows.at(-1);
    if (!history || !first || !last) return;
    days.push(...rows);
    sources.push({ kind: history.source, from: first[0], through: last[0] });
  };
  take(backfill, null);
  take(live, backfill?.through ?? null);
  return { days, sources };
}
