import type { Meal, Ingredient, PlanEntry, ShoppingItem, QuickList, QuickListItem } from './types';

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

export const setPlanEntry = (date: string, meal_type: string, meal_id: number | null, notes?: string) =>
  request<PlanEntry>('/api/plan', {
    method: 'PUT',
    body: JSON.stringify({ date, meal_type, meal_id, notes }),
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
