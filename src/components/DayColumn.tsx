import { useState } from 'react';
import type { PlanEntry, MealType } from '../types';
import { MEAL_TYPES } from '../types';
import MealSlot from './MealSlot';

interface DayColumnProps {
  date: string;
  entries: PlanEntry[];
  isToday: boolean;
  calendarEvent?: string;
  onAddMeal: (date: string, mealType: MealType) => void;
  onEditMeal: (entry: PlanEntry) => void;
  onClearMeal: (entryId: number) => void;
}

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export default function DayColumn({ date, entries, isToday, calendarEvent, onAddMeal, onEditMeal, onClearMeal }: DayColumnProps) {
  const [expanded, setExpanded] = useState(false);
  const d = new Date(date + 'T00:00:00');
  const dayName = DAY_NAMES[d.getDay()];
  const dayNum = d.getDate();
  const monthNum = d.getMonth() + 1;

  const getEntries = (type: MealType) => entries.filter(e => e.meal_type === type);

  // Always show dinner, show lunch/breakfast if expanded or if they have entries
  const visibleTypes = MEAL_TYPES.filter(t =>
    t.key === 'dinner' || expanded || getEntries(t.key).length > 0
  );

  const hasExtraEntries = MEAL_TYPES.some(t => t.key !== 'dinner' && getEntries(t.key).length > 0);

  const borderClass = calendarEvent
    ? 'border-orange-400 bg-orange-50/30'
    : isToday
      ? 'border-blue-400 bg-blue-50/30'
      : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-xl border p-3 min-w-0 ${borderClass}`}>
      {calendarEvent && (
        <div className="mb-1.5 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium truncate">
          {calendarEvent}
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1">
          <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{dayName}</span>
          <span className={`text-lg font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{dayNum}.{monthNum}.</span>
        </div>
        {!expanded && !hasExtraEntries && (
          <button onClick={() => setExpanded(true)} className="text-xs text-gray-400 hover:text-gray-600">
            mehr
          </button>
        )}
        {expanded && (
          <button onClick={() => setExpanded(false)} className="text-xs text-gray-400 hover:text-gray-600">
            weniger
          </button>
        )}
      </div>
      <div className="space-y-1">
        {visibleTypes.map(t => {
          const typeEntries = getEntries(t.key);
          return (
            <div key={t.key}>
              {typeEntries.map((entry, i) => (
                <MealSlot
                  key={entry.id}
                  entry={entry}
                  mealType={t.key}
                  label={t.label}
                  showLabel={i === 0}
                  onEdit={() => onEditMeal(entry)}
                  onClear={() => onClearMeal(entry.id)}
                />
              ))}
              {/* Always show one empty add-slot at the end */}
              <MealSlot
                key={`${t.key}-add`}
                entry={undefined}
                mealType={t.key}
                label={t.label}
                showLabel={typeEntries.length === 0}
                onAdd={() => onAddMeal(date, t.key)}
                onEdit={() => {}}
                onClear={() => {}}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
