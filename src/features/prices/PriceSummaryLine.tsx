import { useEffect, useId, useRef, useState } from 'react';

import { Icon } from '@/components/Icon/Icon';
import { Info } from '@/components/Icon/icons';
import { VisuallyHidden } from '@/components/VisuallyHidden/VisuallyHidden';
import { formatPrice } from '@/lib/format';

import { FILL_LITRES, formatDollars, priceSummary } from './fillSaving';
import styles from './PriceSummaryLine.module.css';

import type { StationPrice } from '../../../shared/api';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** What "save $3.02 on 50 L" means, behind the ⓘ beside it (round 21). */
export const SAVING_EXPLANATION = `Filling ${String(FILL_LITRES)} litres (about one tank) at the cheapest station here, instead of at the average price of the stations shown.`;

/**
 * Beside the heading, the docket's total in a few words: "save $3.02 on
 * 50 L", or "average 239.9" when the saving is too small to mention. The
 * cheapest price is already the first row's.
 *
 * Screen readers get the whole sentence instead, as one piece of plain text:
 * "Cheapest 189.9, average 201.3 cents a litre. Filling 50 litres at the
 * cheapest saves $5.70 on the average." The short visible version is hidden
 * from them, and the sentence has no inline elements, so VoiceOver on iOS
 * reads it in one swipe (round 8 saw it read in five fragments).
 *
 * Of the stations shown, after any filters. No saving under 50 cents: "saves
 * $0.20" is noise.
 */
export function PriceSummaryLine({ stations }: { stations: readonly StationPrice[] }) {
  const summary = priceSummary(stations);
  if (!summary) return null;
  const cheapest = formatPrice(summary.cheapest);
  const average = formatPrice(summary.average);
  const saving = summary.saving >= 0.5 ? formatDollars(summary.saving) : null;
  const savingText = saving
    ? ` Filling ${String(FILL_LITRES)} litres at the cheapest saves ${saving} on the average.`
    : '';
  return (
    <p className={styles.summary}>
      <span aria-hidden="true">
        {saving ? (
          <>
            save <strong className={styles.figure}>{saving}</strong> on {FILL_LITRES} L
          </>
        ) : (
          <>
            average <strong className={styles.figure}>{average}</strong>
          </>
        )}
      </span>
      <VisuallyHidden>
        {`Cheapest ${cheapest}, average ${average} cents a litre.${savingText}`}
      </VisuallyHidden>
      {saving && (
        <>
          {' '}
          <SavingInfo />
        </>
      )}
    </p>
  );
}

/**
 * The ⓘ beside a saving (round 21): a real button with aria-expanded that
 * shows the explanation, not a hover-only tooltip. A tap or a click toggles
 * it, as do Enter and Space; a mouse resting on it shows it until the
 * mouse leaves, and a click then keeps it open. Escape, or a press anywhere
 * else, closes it. The explanation is laid over the page below the heading
 * line (absolutely positioned), so opening it moves nothing: no layout shift.
 */
function SavingInfo() {
  const [open, setOpen] = useState<false | 'hover' | 'pinned'>(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPress = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
    };
  }, [open]);

  const mouse = (event: ReactPointerEvent) => event.pointerType === 'mouse';
  return (
    <span
      ref={wrap}
      // Leaving the button for its explanation keeps it open; leaving both closes it.
      onPointerLeave={(event) => {
        if (mouse(event)) setOpen((was) => (was === 'hover' ? false : was));
      }}
    >
      <button
        type="button"
        className={styles.info}
        aria-expanded={open !== false}
        aria-controls={id}
        onPointerEnter={(event) => {
          if (mouse(event)) setOpen((was) => was || 'hover');
        }}
        // A click after the mouse already opened it keeps it open, rather than closing it.
        onClick={() => {
          setOpen((was) => (was === 'pinned' ? false : 'pinned'));
        }}
      >
        <Icon icon={Info} />
        <VisuallyHidden>What this saving means</VisuallyHidden>
      </button>
      <span id={id} className={styles.tip} hidden={open === false}>
        {SAVING_EXPLANATION}
      </span>
    </span>
  );
}
