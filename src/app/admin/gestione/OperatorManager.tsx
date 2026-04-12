'use client'

import { useState } from 'react'
import { createOperator, deleteOperator, updateOperatorLimit } from './actions'
import type { User } from '@/lib/types'

export default function OperatorManager({ operators }: { operators: User[] }) {
  const [showNew, setShowNew] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null)
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({})
  const [savingLimit, setSavingLimit] = useState<string | null>(null)

  async function handleCreate() {
    if (!newEmail || !newPassword || !newName) return
    setError('')
    try {
      await createOperator({ email: newEmail, password: newPassword, name: newName })
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setShowNew(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa operatrice?')) return
    try {
      await deleteOperator(id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  function startEditLimit(op: User) {
    setEditingLimitId(op.id)
    setLimitInputs(prev => ({ ...prev, [op.id]: op.monthly_call_limit?.toString() || '' }))
  }

  async function handleSaveLimit(userId: string) {
    setSavingLimit(userId)
    try {
      const raw = limitInputs[userId]?.trim()
      const limit = raw === '' || raw === '0' ? null : parseInt(raw)
      if (raw !== '' && raw !== '0' && (isNaN(limit!) || limit! < 1)) {
        setError('Inserisci un numero valido maggiore di 0')
        return
      }
      await updateOperatorLimit(userId, limit ?? null)
      setEditingLimitId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setSavingLimit(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900 text-lg">Operatrici</h3>
        </div>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuova operatrice
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {showNew && (
        <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all" placeholder="Nome" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all" placeholder="email@esempio.it" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all" placeholder="Password" />
            </div>
          </div>
          <button onClick={handleCreate} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm cursor-pointer">Crea operatrice</button>
        </div>
      )}

      <div className="space-y-2">
        {operators.map(op => (
          <div key={op.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50/80 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">{op.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{op.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{op.email}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(op.id)}
                className="text-xs font-medium text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">Elimina</button>
            </div>

            {/* Monthly call limit */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">Limite mensile esiti:</span>
              {editingLimitId === op.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={limitInputs[op.id] ?? ''}
                    onChange={e => setLimitInputs(prev => ({ ...prev, [op.id]: e.target.value }))}
                    placeholder="Es. 500"
                    className="w-24 px-2 py-1 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveLimit(op.id)}
                    disabled={savingLimit === op.id}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingLimit === op.id ? 'Salvo...' : 'Salva'}
                  </button>
                  <button
                    onClick={() => setEditingLimitId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEditLimit(op)}
                  className="flex items-center gap-1.5 text-xs cursor-pointer group"
                >
                  {op.monthly_call_limit ? (
                    <span className="bg-purple-100 text-purple-700 font-semibold px-2.5 py-1 rounded-full group-hover:bg-purple-200 transition-colors">
                      {op.monthly_call_limit} esiti/mese
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full group-hover:bg-gray-200 transition-colors">
                      Nessun limite
                    </span>
                  )}
                  <svg className="w-3 h-3 text-gray-300 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
