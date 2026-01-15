'use client';

import { useEffect } from 'react';

export default function DevSeedLoader() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    import('../../scripts/seed-dev-data').catch((error) => {
      console.warn('Dev seed helpers failed to load:', error);
    });
  }, []);

  return null;
}
