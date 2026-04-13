import type { PlanEntry, MealType } from '../types';
import type { CalendarEvent } from '../api';
import DayColumn from './DayColumn';

interface WeekViewProps {
  days: string[];
  entries: PlanEntry[];
  calendarEvents: CalendarEvent[];
  onAddMeal: (date: string, mealType: MealType) => void;
  onEditMeal: (entry: PlanEntry) => void;
  onClearMeal: (entryId: number) => void;
}

export default function WeekView({ days, entries, calendarEvents, onAddMeal, onEditMeal, onClearMeal }: WeekViewProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const eventsByDate = new Map(calendarEvents.map(e => [e.date, e.title]));

  return (
    <div className="p-3 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
      {days.map(date => (
        <DayColumn
          key={date}
          date={date}
          entries={entries.filter(e => e.date === date)}
          isToday={date === today}
          calendarEvent={eventsByDate.get(date)}
          onAddMeal={onAddMeal}
          onEditMeal={onEditMeal}
          onClearMeal={onClearMeal}
        />
      ))}
    </div>
  );
}
