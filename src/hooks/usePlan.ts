import { useState, useEffect, useCallback } from 'react';
import type { PlanEntry } from '../types';
import { getPlan } from '../api';

export function usePlan(from: string, to: string) {
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlan(from, to);
      setEntries(data);
    } catch (e) {
      console.error('Failed to load plan', e);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refetch when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  return { entries, loading, refresh };
}
