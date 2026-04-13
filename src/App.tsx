import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MealType, PlanEntry, Meal, User, Group } from './types';
import { addPlanEntry, deletePlanEntry, getCalendarEvents, checkAuth, getAuthProviders, switchGroup, getGroups } from './api';
import type { CalendarEvent } from './api';
import { usePlan } from './hooks/usePlan';
import Header from './components/Header';
import WeekView from './components/WeekView';
import MealSearch from './components/MealSearch';
import MealEditor from './components/MealEditor';
import ShoppingExport from './components/ShoppingExport';
import QuickLists from './components/QuickLists';
import LoginScreen from './components/LoginScreen';
import GroupOnboarding from './components/GroupOnboarding';
import InviteHandler from './components/InviteHandler';
import GroupSettings from './components/GroupSettings';

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

function isInviteUrl(): boolean {
  return window.location.pathname.includes('/invite/');
}

interface AuthState {
  user: User;
  groupId: number | null;
  smtpEnabled: boolean;
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      checkAuth().catch(() => null),
      getAuthProviders().catch(() => ({ google: false })),
    ]).then(([authData, providers]) => {
      if (authData?.authenticated && authData.user) {
        setAuth({
          user: authData.user,
          groupId: authData.groupId ?? null,
          smtpEnabled: authData.smtpEnabled ?? false,
        });
      }
      setGoogleEnabled(providers.google);
      setAuthChecked(true);
    });
  }, []);

  const handleLogin = (user: User, groupId: number | null) => {
    setAuth({ user, groupId, smtpEnabled: false });
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuth(null);
  };

  const handleGroupReady = (groupId: number) => {
    setAuth(prev => prev ? { ...prev, groupId } : null);
  };

  const handleGroupChange = (newGroupId: number) => {
    setAuth(prev => prev ? { ...prev, groupId: newGroupId } : null);
  };

  const handleGroupLost = async () => {
    try {
      const remaining = await getGroups();
      if (remaining.length > 0) {
        await switchGroup(remaining[0].id);
        setAuth(prev => prev ? { ...prev, groupId: remaining[0].id } : null);
      } else {
        // No groups left — clear the groupId in the cookie so F5 lands on Onboarding
        await fetch('/api/auth/clear-group', { method: 'POST', credentials: 'include' });
        setAuth(prev => prev ? { ...prev, groupId: null } : null);
      }
    } catch {
      setAuth(prev => prev ? { ...prev, groupId: null } : null);
    }
  };

  if (!authChecked) return null; // loading

  // Invite URL — show InviteHandler regardless of auth state
  if (isInviteUrl()) {
    return (
      <InviteHandler
        currentUser={auth?.user ?? null}
        googleEnabled={googleEnabled}
        onJoined={(groupId) => {
          handleGroupChange(groupId);
        }}
        onLogin={(user, groupId) => {
          handleLogin(user, groupId);
        }}
      />
    );
  }

  if (!auth) {
    return <LoginScreen onLogin={handleLogin} googleEnabled={googleEnabled} />;
  }

  if (auth.groupId === null) {
    return (
      <GroupOnboarding
        user={auth.user}
        onGroupReady={handleGroupReady}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <AuthenticatedApp
      key={auth.groupId}
      user={auth.user}
      groupId={auth.groupId}
      smtpEnabled={auth.smtpEnabled}
      onLogout={handleLogout}
      onGroupChange={handleGroupChange}
      onGroupLost={handleGroupLost}
    />
  );
}

interface AuthenticatedAppProps {
  user: User;
  groupId: number;
  smtpEnabled: boolean;
  onLogout: () => void;
  onGroupChange: (newGroupId: number) => void;
  onGroupLost: () => void;
}

function AuthenticatedApp({ user, groupId, smtpEnabled, onLogout, onGroupChange, onGroupLost }: AuthenticatedAppProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [groups, setGroups] = useState<(Group & { role: string })[]>([]);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

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

  // Fetch groups list
  useEffect(() => {
    getGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [groupId]);

  // Calendar events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    getCalendarEvents(from, to)
      .then(data => setCalendarEvents(data.events))
      .catch(() => setCalendarEvents([]));
  }, [from, to]);

  // Modal states
  const [searchTarget, setSearchTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const [editMealId, setEditMealId] = useState<number | null>(null);
  const [showShopping, setShowShopping] = useState(false);
  const [showQuickLists, setShowQuickLists] = useState(false);

  const handleAddMeal = useCallback((date: string, mealType: MealType) => {
    setSearchTarget({ date, mealType });
  }, []);

  const handleEditMeal = useCallback((entry: PlanEntry) => {
    if (entry.meal_id) setEditMealId(entry.meal_id);
  }, []);

  const handleClearMeal = useCallback(async (entryId: number) => {
    await deletePlanEntry(entryId);
    refresh();
  }, [refresh]);

  const handleMealSelect = useCallback(async (meal: Meal) => {
    if (!searchTarget) return;
    const { date, mealType } = searchTarget;
    setSearchTarget(null); // close immediately — no waiting
    await addPlanEntry(date, mealType, meal.id);
    refresh();
  }, [searchTarget, refresh]);

  const handleSearchClose = useCallback(() => {
    setSearchTarget(null);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditMealId(null);
    refresh();
  }, [refresh]);

  const handleGroupSwitch = useCallback(async (newGroupId: number) => {
    await switchGroup(newGroupId);
    onGroupChange(newGroupId);
  }, [onGroupChange]);

  const mondayISO = useMemo(() => formatISO(monday), [monday]);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header
        weekLabel={weekLabel}
        onWeekChange={delta => setWeekOffset(prev => prev + delta)}
        onShoppingClick={() => setShowShopping(true)}
        onQuickListsClick={() => setShowQuickLists(true)}
        onLogout={onLogout}
        user={user}
        groups={groups}
        currentGroupId={groupId}
        smtpEnabled={smtpEnabled}
        onGroupSwitch={handleGroupSwitch}
        onGroupSettings={() => setShowGroupSettings(true)}
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
          onClose={handleSearchClose}
          onSelect={handleMealSelect}
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

      {showGroupSettings && (
        <GroupSettings
          groupId={groupId}
          user={user}
          smtpEnabled={smtpEnabled}
          onClose={() => setShowGroupSettings(false)}
          onGroupDeleted={() => {
            setShowGroupSettings(false);
            onGroupLost();
          }}
          onLeft={() => {
            setShowGroupSettings(false);
            onGroupLost();
          }}
        />
      )}
    </div>
  );
}
