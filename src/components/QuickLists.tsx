import { useState, useEffect } from 'react';
import type { QuickList, QuickListItem } from '../types';
import { getQuickLists, getQuickList, createQuickList, deleteQuickList, saveQuickListItems } from '../api';

interface QuickListsProps {
  onClose: () => void;
}

export default function QuickLists({ onClose }: QuickListsProps) {
  const [lists, setLists] = useState<QuickList[]>([]);
  const [activeList, setActiveList] = useState<QuickList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<QuickListItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadLists = () => getQuickLists().then(setLists);

  useEffect(() => { loadLists(); }, []);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    const list = await createQuickList(newListName.trim());
    setNewListName('');
    await loadLists();
    openList(list.id);
  };

  const openList = async (id: number) => {
    const list = await getQuickList(id);
    setActiveList(list);
    setItems(list.items || []);
    setEditing(false);
  };

  const handleDelete = async (id: number) => {
    await deleteQuickList(id);
    if (activeList?.id === id) setActiveList(null);
    loadLists();
  };

  const handleSaveItems = async () => {
    if (!activeList) return;
    setSaving(true);
    const saved = await saveQuickListItems(activeList.id, items.filter(i => i.name.trim()));
    setItems(saved);
    setEditing(false);
    setSaving(false);
    loadLists();
  };

  const addItem = () => {
    setItems([...items, { name: '', amount: '', category: '' }]);
  };

  const updateItem = (index: number, field: keyof QuickListItem, value: string) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const sendToBring = (list: QuickList) => {
    const recipeUrl = `${window.location.origin}/api/recipe/quick-list/${list.id}`;
    const bringUrl = `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent(recipeUrl)}&source=web`;
    window.open(bringUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-[28rem] sm:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeList && (
              <button onClick={() => setActiveList(null)} className="text-gray-400 hover:text-gray-600 text-lg mr-1">
                &larr;
              </button>
            )}
            <h2 className="text-lg font-bold">{activeList ? activeList.name : 'Einkaufslisten'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {!activeList ? (
          /* List overview */
          <div className="flex-1 overflow-y-auto">
            {/* Create new list */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Neue Liste erstellen..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newListName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* Lists */}
            {lists.length === 0 ? (
              <p className="text-gray-400 text-center py-8 text-sm">
                Noch keine Listen. Erstelle eine z.B. "Kids-Wochenende"
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {lists.map(list => (
                  <div key={list.id} className="flex items-center p-4 gap-3">
                    <button
                      onClick={() => openList(list.id)}
                      className="flex-1 text-left"
                    >
                      <span className="font-medium text-sm">{list.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {list.item_count || 0} Zutaten
                      </span>
                    </button>
                    <button
                      onClick={() => sendToBring(list)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 shrink-0"
                      title="An Bring! senden"
                    >
                      Bring!
                    </button>
                    <button
                      onClick={() => handleDelete(list.id)}
                      className="text-gray-300 hover:text-red-500 text-lg shrink-0"
                      title="Löschen"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* List detail / edit */
          <div className="flex-1 overflow-y-auto p-4">
            {!editing ? (
              <>
                {items.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 text-sm">Keine Zutaten</p>
                ) : (
                  <div className="space-y-1 mb-4">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between py-1.5 text-sm">
                        <span>{item.name}</span>
                        <span className="text-gray-500">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => updateItem(i, 'name', e.target.value)}
                        placeholder="Zutat"
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={item.amount}
                        onChange={e => updateItem(i, 'amount', e.target.value)}
                        placeholder="Menge"
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeItem(i)}
                        className="text-gray-300 hover:text-red-500 text-lg shrink-0"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400"
                >
                  + Zutat hinzufügen
                </button>
              </>
            )}
          </div>
        )}

        {/* Bottom actions */}
        {activeList && (
          <div className="p-4 border-t border-gray-100 flex gap-2">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => sendToBring(activeList)}
                  disabled={items.length === 0}
                  className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                >
                  An Bring! senden
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    openList(activeList.id); // revert changes
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveItems}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
