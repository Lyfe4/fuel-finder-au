import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { VisuallyHidden } from '@/components/VisuallyHidden/VisuallyHidden';
import { SearchScreen } from '@/features/search/SearchScreen';
import { ThemeSelect } from '@/features/theme/ThemeSelect';
import { useApplyTheme } from '@/features/theme/useTheme';

import styles from './App.module.css';
import { createQueryClient } from './queryClient';

/**
 * The application shell: providers, page landmarks and attribution. The
 * screen itself is SearchScreen.
 */
export function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  useApplyTheme();

  return (
    <QueryClientProvider client={client}>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Fuel Finder</h1>
          <p className={styles.region}>
            NSW <span aria-hidden="true">·</span>
            <VisuallyHidden>,</VisuallyHidden> ACT <span aria-hidden="true">·</span>
            <VisuallyHidden> and</VisuallyHidden> QLD
          </p>
        </header>
        <main className={styles.main}>
          <SearchScreen />
        </main>
        <footer className={styles.footer}>
          <p>
            NSW and ACT prices from{' '}
            <a href="https://www.fuelcheck.nsw.gov.au/">NSW Government FuelCheck</a>, refreshed
            every 30 minutes.
          </p>
          {/*
           * Round 18. Static, so it stays if Queensland is switched off; the
           * licence notices themselves come with the prices from the API.
           */}
          <p>
            Queensland prices from <a href="https://www.fuelpricesqld.com.au/">Fuel Prices Qld</a>,
            refreshed every 10 minutes. © State of Queensland (Department of Energy and Climate);
            the licence notices are shown with the prices. Not to be republished.
          </p>
          <p>
            NSW price history before 23 October 2026 from{' '}
            <a href="https://data.nsw.gov.au/data/dataset/fuel-check">
              NSW FuelCheck price history
            </a>{' '}
            (NSW Fair Trading), used under{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>. Our daily low,
            high and last prices made from it are shared under the same licence. Queensland price
            history starts on 19 November 2026, from our own records.
          </p>
          <p>
            Suburb and postcode locations based on{' '}
            <a href="https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3">
              Australian Bureau of Statistics ASGS Edition 3 (2021)
            </a>{' '}
            data, used under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          </p>
          <p>
            Map tiles from <a href="https://openfreemap.org/">OpenFreeMap</a>, map data ©{' '}
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
          </p>
          <p>
            No account, cookies or tracking; your location stays rounded and unstored.{' '}
            <a href="/privacy.html">Privacy</a>
          </p>
          <ThemeSelect />
        </footer>
      </div>
    </QueryClientProvider>
  );
}
