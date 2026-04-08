export interface Meal {
  id: number;
  name: string;
  created_at: string;
  ingredients?: Ingredient[];
}

export interface Ingredient {
  id?: number;
  meal_id?: number;
  name: string;
  amount: string;
  category: string;
}

export interface PlanEntry {
  id: number;
  date: string;
  meal_type: MealType;
  meal_id: number | null;
  meal_name?: string;
  notes: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'dinner', label: 'Abendessen' },
  { key: 'lunch', label: 'Mittagessen' },
  { key: 'breakfast', label: 'Frühstück' },
];

export interface ShoppingItem {
  name: string;
  amount: string;
  category: string;
  mealName: string;
}

export interface QuickList {
  id: number;
  name: string;
  item_count?: number;
  items?: QuickListItem[];
}

export interface QuickListItem {
  id?: number;
  list_id?: number;
  name: string;
  amount: string;
  category: string;
}
