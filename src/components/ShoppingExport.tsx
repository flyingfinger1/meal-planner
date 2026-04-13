import { useState, useEffect, useMemo } from 'react';
import type { ShoppingItem } from '../types';
import { getPlan, getShoppingList, createShareToken } from '../api';

interface ShoppingExportProps {
  initialMonday: string; // ISO date of the current week's Monday
  onClose: () => void;
}

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(date: string) {
  const d = new Date(date + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function weekLabel(monday: Date): string {
  const sun = addDays(monday, 6);
  return `${monday.getDate()}.${monday.getMonth() + 1}. - ${sun.getDate()}.${sun.getMonth() + 1}.`;
}

interface WeekData {
  date: string;
  hasMeals: boolean;
}

export default function ShoppingExport({ initialMonday, onClose }: ShoppingExportProps) {
  // Track which weeks are visible (can show multiple)
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = useMemo(() => addDays(new Date(initialMonday + 'T00:00:00'), weekOffset * 7), [initialMonday, weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => formatISO(addDays(monday, i))), [monday]);

  // Load plan entries for visible week
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  useEffect(() => {
    const from = weekDays[0];
    const to = weekDays[6];
    getPlan(from, to).then(entries => {
      setWeekData(weekDays.map(date => ({
        date,
        hasMeals: entries.some(e => e.date === date && e.meal_id),
      })));
    });
  }, [weekDays]);

  // Selected dates persist across week changes
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Auto-select days with meals on first load
  useEffect(() => {
    if (initialLoaded || weekData.length === 0) return;
    setSelectedDates(new Set(weekData.filter(d => d.hasMeals).map(d => d.date)));
    setInitialLoaded(true);
  }, [weekData, initialLoaded]);

  // Shopping items based on all selected dates
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dates = Array.from(selectedDates);
    if (!dates.length) {
      setItems([]);
      return;
    }
    setLoading(true);
    getShoppingList(dates).then(data => {
      setItems(data.ingredients);
      setLoading(false);
    });
  }, [selectedDates]);

  const toggleDate = (date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      const visibleWithMeals = weekData.filter(d => d.hasMeals).map(d => d.date);
      const allSelected = visibleWithMeals.every(d => next.has(d));
      if (allSelected) {
        visibleWithMeals.forEach(d => next.delete(d));
      } else {
        visibleWithMeals.forEach(d => next.add(d));
      }
      return next;
    });
  };

  const ingredientText = items
    .map(i => i.amount ? `${i.name} (${i.amount})` : i.name)
    .join('\n');

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(ingredientText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [sendingToBring, setSendingToBring] = useState(false);

  const openInBring = async () => {
    const dates = Array.from(selectedDates);
    if (!dates.length) return;

    setSendingToBring(true);
    try {
      const { token } = await createShareToken(dates);
      const recipeUrl = `${window.location.origin}/api/recipe/shopping/${token}`;
      const bringUrl = `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent(recipeUrl)}&source=web`;
      window.open(bringUrl, '_blank');
    } catch {
      if (navigator.share) {
        navigator.share({ title: 'Einkaufsliste', text: ingredientText }).catch(() => {});
      } else {
        copyToClipboard();
      }
    } finally {
      setSendingToBring(false);
    }
  };

  // Group items by category
  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'Sonstiges';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  // Count selected dates not in current visible week (to show badge)
  const selectedFromOtherWeeks = Array.from(selectedDates).filter(d => !weekDays.includes(d)).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="bg-white w-full sm:w-[28rem] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">Einkaufsliste</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Day selector with week pager */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset(o => o - 1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                &larr;
              </button>
              <span className="text-sm font-medium text-gray-600 min-w-[110px] text-center">
                {weekLabel(monday)}
              </span>
              <button
                onClick={() => setWeekOffset(o => o + 1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                &rarr;
              </button>
            </div>
            <button onClick={selectAllVisible} className="text-xs text-blue-600 hover:text-blue-800">
              {weekData.filter(d => d.hasMeals).every(d => selectedDates.has(d.date)) ? 'Keine' : 'Alle'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {weekData.map(day => {
              const selected = selectedDates.has(day.date);
              return (
                <button
                  key={day.date}
                  onClick={() => day.hasMeals && toggleDate(day.date)}
                  disabled={!day.hasMeals}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    selected
                      ? 'bg-green-600 text-white'
                      : day.hasMeals
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {formatDate(day.date)}
                </button>
              );
            })}
          </div>
          {selectedFromOtherWeeks > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              + {selectedFromOtherWeeks} Tag{selectedFromOtherWeeks > 1 ? 'e' : ''} aus anderen Wochen ausgewählt
            </p>
          )}
        </div>

        {/* Ingredient list */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-gray-400 text-center py-4">Lädt...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-400 text-center py-4">
              {selectedDates.size === 0 ? 'Wähle Tage aus' : 'Keine Zutaten hinterlegt'}
            </p>
          ) : (
            Object.entries(grouped).map(([category, catItems]) => (
              <div key={category} className="mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">{category}</h3>
                {catItems.map((item, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span>{item.name}</span>
                    <span className="text-gray-500">{item.amount}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Action buttons */}
        {items.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
            >
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
            <button
              onClick={openInBring}
              disabled={sendingToBring}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
            >
              {sendingToBring ? 'Wird gesendet...' : 'An Bring! senden'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
