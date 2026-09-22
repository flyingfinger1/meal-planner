import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [editingName, setEditingName] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  const startEditingName = useCallback(() => {
    setEditingName(true);
    setTimeout(() => { nameInputRef.current?.select(); }, 0);
  }, []);

  const handleNameBlur = async () => {
    setEditingName(false);
    if (name.trim() && name !== meal?.name) {
      await updateMeal(mealId, name.trim());
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') nameInputRef.current?.blur();
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="bg-white w-full sm:w-[28rem] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                className="text-lg font-bold flex-1 min-w-0 px-1 py-0.5 border-b-2 border-blue-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <>
                <span className="text-lg font-bold truncate">{name}</span>
                <button
                  onClick={startEditingName}
                  className="shrink-0 text-gray-400 hover:text-blue-500 p-0.5"
                  title="Umbenennen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
