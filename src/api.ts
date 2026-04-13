import type { Meal, Ingredient, PlanEntry, ShoppingItem, QuickList, QuickListItem, User, Group, GroupMember } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Meals
export const searchMeals = (q: string) =>
  request<Meal[]>(`/api/meals?q=${encodeURIComponent(q)}`);

export const getMeal = (id: number) =>
  request<Meal>(`/api/meals/${id}`);

export const createMeal = (name: string) =>
  request<Meal>('/api/meals', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const updateMeal = (id: number, name: string) =>
  request<Meal>(`/api/meals/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });

export const deleteMeal = (id: number) =>
  request<void>(`/api/meals/${id}`, { method: 'DELETE' });

export const saveIngredients = (mealId: number, ingredients: Omit<Ingredient, 'id' | 'meal_id'>[]) =>
  request<Ingredient[]>(`/api/meals/${mealId}/ingredients`, {
    method: 'PUT',
    body: JSON.stringify({ ingredients }),
  });

// Plan
export const getPlan = (from: string, to: string) =>
  request<PlanEntry[]>(`/api/plan?from=${from}&to=${to}`);

export const addPlanEntry = (date: string, meal_type: string, meal_id: number, notes?: string) =>
  request<void>('/api/plan', {
    method: 'POST',
    body: JSON.stringify({ date, meal_type, meal_id, notes }),
  });

export const updatePlanEntry = (id: number, meal_id: number, notes?: string) =>
  request<PlanEntry>(`/api/plan/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ meal_id, notes }),
  });

export const deletePlanEntry = (id: number) =>
  request<void>(`/api/plan/${id}`, { method: 'DELETE' });

// Shopping
export const getShoppingList = (dates: string[]) =>
  request<{ ingredients: ShoppingItem[] }>(`/api/shopping?dates=${dates.join(',')}`);

export const createShareToken = (dates: string[]) =>
  request<{ token: string }>('/api/shopping/share-token', {
    method: 'POST',
    body: JSON.stringify({ dates }),
  });

// Quick Lists
export const getQuickLists = () =>
  request<QuickList[]>('/api/quick-lists');

export const getQuickList = (id: number) =>
  request<QuickList>(`/api/quick-lists/${id}`);

export const createQuickList = (name: string) =>
  request<QuickList>('/api/quick-lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const updateQuickList = (id: number, name: string) =>
  request<QuickList>(`/api/quick-lists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });

export const deleteQuickList = (id: number) =>
  request<void>(`/api/quick-lists/${id}`, { method: 'DELETE' });

export const saveQuickListItems = (id: number, items: Omit<QuickListItem, 'id' | 'list_id'>[]) =>
  request<QuickListItem[]>(`/api/quick-lists/${id}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });

// Calendar
export interface CalendarEvent {
  date: string;
  title: string;
}

export interface CalendarSettings {
  ical_url: string;
  ical_label: string;
}

export const getCalendarEvents = (from: string, to: string) =>
  request<{ events: CalendarEvent[] }>(`/api/calendar/events?from=${from}&to=${to}`);

export const getCalendarSettings = () =>
  request<CalendarSettings>('/api/calendar/settings');

export const saveCalendarSettings = (settings: Partial<CalendarSettings>) =>
  request<{ ok: boolean }>('/api/calendar/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

// Auth
export const register = (email: string, name: string, password: string) =>
  request<{ user: User; groupId: number }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, name, password }),
  });

export const login = (email: string, password: string) =>
  request<{ user: User; groupId: number | null }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const checkAuth = () =>
  request<{ authenticated: boolean; user?: User; groupId?: number | null; smtpEnabled?: boolean }>('/api/auth/check');

export const getAuthProviders = () =>
  request<{ google: boolean }>('/api/auth/providers');

export const switchGroup = (groupId: number) =>
  request<{ ok: boolean }>('/api/auth/switch-group', {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  });

// Groups
export const getGroups = () =>
  request<(Group & { role: string })[]>('/api/groups');

export const createGroup = (name: string) =>
  request<Group>('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const getGroup = (id: number) =>
  request<Group & { members: GroupMember[] }>(`/api/groups/${id}`);

export const updateGroup = (id: number, name: string) =>
  request<Group>(`/api/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });

export const deleteGroup = (id: number) =>
  request<void>(`/api/groups/${id}`, { method: 'DELETE' });

export const leaveGroup = (id: number) =>
  request<void>(`/api/groups/${id}/leave`, { method: 'POST' });

export const removeMember = (groupId: number, userId: number) =>
  request<void>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });

export const transferOwnership = (groupId: number, targetUserId: number) =>
  request<{ ok: boolean }>(`/api/groups/${groupId}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });

export const regenerateInviteCode = (groupId: number) =>
  request<{ invite_code: string }>(`/api/groups/${groupId}/regenerate-invite`, { method: 'POST' });

export const getGroupByInviteCode = (inviteCode: string) =>
  request<{ id: number; name: string; memberCount: number }>(`/api/groups/join/${inviteCode}`);

export const joinGroup = (inviteCode: string) =>
  request<{ groupId: number }>(`/api/groups/join/${inviteCode}`, { method: 'POST' });

export const sendInvitation = (groupId: number, email: string) =>
  request<{ inviteUrl: string; emailSent: boolean }>(`/api/groups/${groupId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
