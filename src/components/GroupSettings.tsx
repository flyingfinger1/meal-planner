import { useState, useEffect } from 'react';
import type { User, GroupMember } from '../types';
import {
  getGroup,
  updateGroup,
  deleteGroup,
  leaveGroup,
  removeMember,
  transferOwnership,
  regenerateInviteCode,
  sendInvitation,
} from '../api';

interface GroupSettingsProps {
  groupId: number;
  user: User;
  smtpEnabled: boolean;
  onClose: () => void;
  onGroupDeleted: () => void;
  onLeft: () => void;
}

function getInviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

export default function GroupSettings({
  groupId,
  user,
  smtpEnabled,
  onClose,
  onGroupDeleted,
  onLeft,
}: GroupSettingsProps) {
  const [groupName, setGroupName] = useState('');
  const [editName, setEditName] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');

  // Invite section
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Regenerate confirmation
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  // Leave confirmation
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isOwner = members.find(m => m.user_id === user.id)?.role === 'owner';

  useEffect(() => {
    getGroup(groupId)
      .then(g => {
        setGroupName(g.name);
        setEditName(g.name);
        setMembers(g.members);
        setInviteCode(g.invite_code);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [groupId]);

  const handleSaveName = async () => {
    if (!editName.trim() || editName === groupName) return;
    setSaving(true);
    try {
      const updated = await updateGroup(groupId, editName.trim());
      setGroupName(updated.name);
      setEditName(updated.name);
      setSavingMsg('Gespeichert!');
      setTimeout(() => setSavingMsg(''), 2000);
    } catch {
      setSavingMsg('Fehler beim Speichern');
    }
    setSaving(false);
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await removeMember(groupId, memberId);
      setMembers(prev => prev.filter(m => m.user_id !== memberId));
    } catch {
      // ignore
    }
  };

  const handleTransferOwnership = async (targetUserId: number, targetName: string) => {
    if (!confirm(`Inhaberschaft an ${targetName} übertragen? Du wirst dann normales Mitglied.`)) return;
    try {
      await transferOwnership(groupId, targetUserId);
      setMembers(prev => prev.map(m => ({
        ...m,
        role: m.user_id === user.id ? 'member' : m.user_id === targetUserId ? 'owner' : m.role,
      } as typeof m)));
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getInviteUrl(inviteCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteResult('');
    try {
      const result = await sendInvitation(groupId, inviteEmail.trim());
      if (result.emailSent) {
        setInviteResult(`Einladung an ${inviteEmail} gesendet.`);
      } else {
        setInviteResult(`Einladungslink: ${result.inviteUrl}`);
      }
      setInviteEmail('');
    } catch (err: unknown) {
      setInviteResult(err instanceof Error ? err.message : 'Fehler beim Senden');
    }
    setInviteSending(false);
  };

  const handleRegenerate = async () => {
    setRegenLoading(true);
    try {
      const result = await regenerateInviteCode(groupId);
      setInviteCode(result.invite_code);
      setConfirmRegen(false);
    } catch {
      // ignore
    }
    setRegenLoading(false);
  };

  const handleLeave = async () => {
    setLeaveLoading(true);
    try {
      await leaveGroup(groupId);
      onLeft();
    } catch {
      setLeaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteNameInput !== groupName) return;
    setDeleteLoading(true);
    try {
      await deleteGroup(groupId);
      onGroupDeleted();
    } catch {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:w-[32rem] sm:rounded-xl rounded-t-xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">Gruppen-Einstellungen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : (
          <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
            {/* Group name */}
            <div className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Gruppe</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  disabled={!isOwner}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                {isOwner && (
                  <button
                    onClick={handleSaveName}
                    disabled={saving || !editName.trim() || editName === groupName}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingMsg || (saving ? 'Speichert…' : 'Speichern')}
                  </button>
                )}
              </div>
            </div>

            {/* Members */}
            <div className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Mitglieder</p>
              <ul className="space-y-2">
                {members.map(m => (
                  <li key={m.user_id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-500 truncate">{m.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      m.role === 'owner'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {m.role === 'owner' ? 'Inhaber' : 'Mitglied'}
                    </span>
                    {isOwner && m.user_id !== user.id && (
                      <div className="flex gap-1 flex-shrink-0">
                        {m.role !== 'owner' && (
                          <button
                            onClick={() => handleTransferOwnership(m.user_id, m.name)}
                            className="text-gray-300 hover:text-yellow-500 p-1"
                            title="Zum Inhaber machen"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                              <polyline points="15 3 18 6 15 9"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="text-gray-300 hover:text-red-500 p-1"
                          title="Entfernen"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Invite by email */}
            <div className="p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Einladen</p>
              <form onSubmit={handleSendInvitation} className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="E-Mail-Adresse"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={inviteSending || !inviteEmail.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {inviteSending ? '…' : smtpEnabled ? 'Per E-Mail senden' : 'Link erstellen'}
                </button>
              </form>
              {inviteResult && (
                <p className="text-sm text-gray-600 break-all">{inviteResult}</p>
              )}
            </div>

            {/* Invite link */}
            <div className="p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Einladungslink</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={getInviteUrl(inviteCode)}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 min-w-0"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap flex-shrink-0"
                >
                  {copied ? 'Kopiert!' : 'Kopieren'}
                </button>
              </div>
              {isOwner && (
                <>
                  {!confirmRegen ? (
                    <button
                      onClick={() => setConfirmRegen(true)}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Link neu generieren
                    </button>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm text-yellow-800">
                        Der alte Link wird ungültig. Fortfahren?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRegenerate}
                          disabled={regenLoading}
                          className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {regenLoading ? '…' : 'Neu generieren'}
                        </button>
                        <button
                          onClick={() => setConfirmRegen(false)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Leave group */}
            <div className="p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Gruppe verlassen</p>
              {!confirmLeave ? (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  Gruppe verlassen
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-800">Wirklich verlassen?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLeave}
                      disabled={leaveLoading}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {leaveLoading ? '…' : 'Verlassen'}
                    </button>
                    <button
                      onClick={() => setConfirmLeave(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Delete group (owner only) */}
            {isOwner && (
              <div className="p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Gruppe löschen</p>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                  >
                    Gruppe löschen
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                    <p className="text-sm text-red-800 font-medium">
                      Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                    <p className="text-sm text-red-700">
                      Gib den Gruppennamen <strong>{groupName}</strong> ein, um zu bestätigen:
                    </p>
                    <input
                      type="text"
                      value={deleteNameInput}
                      onChange={e => setDeleteNameInput(e.target.value)}
                      placeholder={groupName}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleteLoading || deleteNameInput !== groupName}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleteLoading ? '…' : 'Endgültig löschen'}
                      </button>
                      <button
                        onClick={() => { setConfirmDelete(false); setDeleteNameInput(''); }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
