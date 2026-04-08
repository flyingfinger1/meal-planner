import type { Ingredient } from '../types';

interface IngredientListProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

export default function IngredientList({ ingredients, onChange }: IngredientListProps) {
  const update = (index: number, field: keyof Ingredient, value: string) => {
    const updated = ingredients.map((ing, i) =>
      i === index ? { ...ing, [field]: value } : ing
    );
    onChange(updated);
  };

  const remove = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...ingredients, { name: '', amount: '', category: '' }]);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">Zutaten</h3>
      {ingredients.map((ing, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            value={ing.name}
            onChange={e => update(i, 'name', e.target.value)}
            placeholder="Zutat"
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={ing.amount}
            onChange={e => update(i, 'amount', e.target.value)}
            placeholder="Menge"
            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => remove(i)}
            className="text-gray-400 hover:text-red-500 p-1 text-sm"
            aria-label="Entfernen"
          >
            &#x2715;
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium py-1"
      >
        + Zutat hinzufügen
      </button>
    </div>
  );
}
