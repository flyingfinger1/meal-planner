import type { PlanEntry, MealType } from '../types';

interface MealSlotProps {
  entry?: PlanEntry;
  mealType: MealType;
  label: string;
  showLabel: boolean;
  onAdd?: () => void;
  onEdit: () => void;
  onClear: () => void;
}

export default function MealSlot({ entry, mealType, label, showLabel, onAdd, onEdit, onClear }: MealSlotProps) {
  const hasMeal = entry?.meal_id != null;
  const labelChar = mealType === 'dinner' ? 'A' : mealType === 'lunch' ? 'M' : 'F';

  return (
    <div className="flex items-center gap-2 min-h-[44px]">
      <span className="text-xs text-gray-400 w-6 shrink-0">
        {showLabel ? labelChar : ''}
      </span>
      {hasMeal ? (
        <button
          onClick={onEdit}
          className="flex-1 text-left px-2 py-1.5 rounded-md bg-blue-50 text-blue-800 text-sm font-medium truncate hover:bg-blue-100 active:bg-blue-200"
        >
          {entry!.meal_name}
        </button>
      ) : (
        <button
          onClick={onAdd}
          className="flex-1 text-left px-2 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-400 text-sm hover:border-gray-400 hover:text-gray-500 active:bg-gray-50"
        >
          + {label}
        </button>
      )}
      {hasMeal && (
        <button
          onClick={onClear}
          className="text-gray-300 hover:text-red-400 p-1 text-xs"
          aria-label="Entfernen"
        >
          &#x2715;
        </button>
      )}
    </div>
  );
}
