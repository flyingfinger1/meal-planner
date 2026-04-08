import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MealType, PlanEntry, Meal } from './types';
import { setPlanEntry, getCalendarEvents } from './api';
import type { CalendarEvent } from './api';
import { usePlan } from './hooks/usePlan';
import Header from './components/Header';
import WeekView from './components/WeekView';
import MealSearch from './components/MealSearch';
import MealEditor from './components/MealEditor';
import ShoppingExport from './components/ShoppingExport';
import CalendarSettings from './components/CalendarSettings';
import QuickLists from './components/QuickLists';
import LoginScreen from './components/LoginScreen';

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

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth/check', { credentials: 'include' })
      .then(res => {
        setAuthenticated(res.ok);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
  };

  if (!authChecked) return null; // loading
  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)} />;

  return <AuthenticatedApp onLogout={handleLogout} />;
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = useMemo(() => addDays(getMonday(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => formatISO(addDays(monday, i))), [monday]);
  const from = days[0];
  const to = days[6];

  const weekLabel = useMemo(() => {
    const m = monday;
    const sun = addDays(m, 6);
    return `${m.getDate()}.${m.getMonth() + 1}. - ${sun.getDate()}.${sun.getMonth() + 1}.`;
  }, [monday]);

  const { entries, refresh } = usePlan(from, to);

  // Calendar events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarVersion, setCalendarVersion] = useState(0);

  useEffect(() => {
    getCalendarEvents(from, to)
      .then(data => setCalendarEvents(data.events))
      .catch(() => setCalendarEvents([]));
  }, [from, to, calendarVersion]);

  // Modal states
  const [searchTarget, setSearchTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const [editMealId, setEditMealId] = useState<number | null>(null);
  const [showShopping, setShowShopping] = useState(false);
  const [showQuickLists, setShowQuickLists] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);

  const handleAddMeal = useCallback((date: string, mealType: MealType) => {
    setSearchTarget({ date, mealType });
  }, []);

  const handleEditMeal = useCallback((entry: PlanEntry) => {
    if (entry.meal_id) setEditMealId(entry.meal_id);
  }, []);

  const handleClearMeal = useCallback(async (date: string, mealType: MealType) => {
    await setPlanEntry(date, mealType, null);
    refresh();
  }, [refresh]);

  const handleSearchDone = useCallback(() => {
    setSearchTarget(null);
    refresh();
  }, [refresh]);

  const handleEditorClose = useCallback(() => {
    setEditMealId(null);
    refresh();
  }, [refresh]);

  const mondayISO = useMemo(() => formatISO(monday), [monday]);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header
        weekLabel={weekLabel}
        onWeekChange={delta => setWeekOffset(prev => prev + delta)}
        onShoppingClick={() => setShowShopping(true)}
        onQuickListsClick={() => setShowQuickLists(true)}
        onSettingsClick={() => setShowCalendarSettings(true)}
        onLogout={onLogout}
      />
      <WeekView
        days={days}
        entries={entries}
        calendarEvents={calendarEvents}
        onAddMeal={handleAddMeal}
        onEditMeal={handleEditMeal}
        onClearMeal={handleClearMeal}
      />

      {searchTarget && (
        <MealSearch
          date={searchTarget.date}
          mealType={searchTarget.mealType}
          onDone={handleSearchDone}
          onEditMeal={(meal: Meal) => setEditMealId(meal.id)}
        />
      )}

      {editMealId && (
        <MealEditor
          mealId={editMealId}
          onClose={handleEditorClose}
          onDeleted={refresh}
        />
      )}

      {showShopping && (
        <ShoppingExport
          initialMonday={mondayISO}
          onClose={() => setShowShopping(false)}
        />
      )}

      {showQuickLists && (
        <QuickLists onClose={() => setShowQuickLists(false)} />
      )}

      {showCalendarSettings && (
        <CalendarSettings
          onClose={() => setShowCalendarSettings(false)}
          onSaved={() => setCalendarVersion(v => v + 1)}
        />
      )}
    </div>
  );
}
