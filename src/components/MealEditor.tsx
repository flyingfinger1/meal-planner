import { useState, useEffect, useRef } from 'react';
import type { Meal, Ingredient } from '../types';
import { getMeal, updateMeal, saveIngredients, deleteMeal } from '../api';
import IngredientList from './IngredientList';

interface MealEditorProps {
  mealId: number;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function MealEditor({ mealId, onClose, onDeleted }: MealEditorProps) {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    getMeal(mealId).then(m => {
      setMeal(m);
      setName(m.name);
      setIngredients(m.ingredients || []);
    });
  }, [mealId]);

  const autoSaveIngredients = (updated: Ingredient[]) => {
    setIngredients(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveIngredients(mealId, updated.filter(i => i.name.trim()));
      setSaving(false);
    }, 800);
  };

  const handleNameBlur = async () => {
    if (name.trim() && name !== meal?.name) {
      await updateMeal(mealId, name.trim());
    }
  };

  const handleDelete = async () => {
    if (confirm('Essen wirklich löschen? Es wird auch aus dem Plan entfernt.')) {
      setDeleting(true);
      await deleteMeal(mealId);
      onDeleted?.();
      onClose();
    }
  };

  if (!meal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-[28rem] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            className="text-lg font-bold flex-1 mr-2 px-1 py-0.5 border-b-2 border-transparent focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-gray-400">Speichert...</span>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <IngredientList ingredients={ingredients} onChange={autoSaveIngredients} />
        </div>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? 'Löscht...' : 'Essen löschen'}
          </button>
        </div>
      </div>
    </div>
  );
}
