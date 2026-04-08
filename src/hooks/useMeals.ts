import { useState, useCallback } from 'react';
import type { Meal } from '../types';
import { searchMeals } from '../api';
import { useDebounce } from './useDebounce';

export function useMealSearch(query: string) {
  const [results, setResults] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  const search = useCallback(async () => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchMeals(debouncedQuery);
      setResults(data);
    } catch (e) {
      console.error('Search failed', e);
    }
    setLoading(false);
  }, [debouncedQuery]);

  // Auto-search when debounced query changes
  useState(() => { search(); });

  return { results, loading, search };
}
