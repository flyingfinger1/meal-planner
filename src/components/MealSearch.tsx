import { useState, useEffect, useRef } from 'react';
import type { Meal, MealType } from '../types';
import { searchMeals, createMeal, setPlanEntry } from '../api';
import { useDebounce } from '../hooks/useDebounce';

interface MealSearchProps {
  date: string;
  mealType: MealType;
  onDone: () => void;
  onEditMeal?: (meal: Meal) => void;
}

export default function MealSearch({ date, mealType, onDone, onEditMeal }: MealSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Meal[]>([]);
  const [creating, setCreating] = useState(false);
  const debouncedQuery = useDebounce(query, 200);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      // Show recent meals when empty
      searchMeals('').then(setResults);
      return;
    }
    searchMeals(debouncedQuery).then(setResults);
  }, [debouncedQuery]);

  const selectMeal = async (meal: Meal) => {
    await setPlanEntry(date, mealType, meal.id);
    onDone();
  };

  const createAndSelect = async () => {
    if (!query.trim() || creating) return;
    setCreating(true);
    try {
      const meal = await createMeal(query.trim());
      await setPlanEntry(date, mealType, meal.id);
      onDone();
      if (onEditMeal) onEditMeal(meal);
    } catch (e) {
      console.error('Failed to create meal', e);
      setCreating(false);
    }
  };

  const exactMatch = results.some(m => m.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onDone(); }}>
      <div
        className="bg-white w-full sm:w-96 sm:rounded-xl rounded-t-xl max-h-[80vh] flex flex-col"
      >
        <div className="p-4 border-b border-gray-100">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !exactMatch && query.trim()) createAndSelect();
              if (e.key === 'Escape') onDone();
            }}
            placeholder="Essen suchen oder neu erstellen..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {query.trim() && !exactMatch && (
            <button
              onClick={createAndSelect}
              disabled={creating}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 active:bg-blue-100 text-blue-600 font-medium border-b border-gray-100 disabled:opacity-50"
            >
              {creating ? 'Erstellt...' : <span>+ &ldquo;{query.trim()}&rdquo; neu erstellen</span>}
            </button>
          )}
          {results.map(meal => (
            <button
              key={meal.id}
              onClick={() => selectMeal(meal)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50"
            >
              {meal.name}
            </button>
          ))}
          {results.length === 0 && !query.trim() && (
            <p className="px-4 py-6 text-gray-400 text-center text-sm">
              Noch keine Essen gespeichert. Tippe einen Namen ein.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
