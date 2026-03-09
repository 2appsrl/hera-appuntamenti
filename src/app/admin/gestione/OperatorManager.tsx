'use client'

import { useState } from 'react'
import { createOperator, deleteOperator } from './actions'
import type { User } from '@/lib/types'

export default function OperatorManager({ operators }: { operators: User[] }) {
  const [showNew, setShowNew] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-lg">Operatrici</h3>
        <button onClick={() => setShowNew(!showNew)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 cursor-pointer">
          + Nuova operatrice
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {showNew && (
        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Nome" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm" placeholder="email@esempio.it" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Password</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Password" />
            </div>
          </div>
          <button onClick={handleCreate} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm cursor-pointer">Crea operatrice</button>
        </div>
      )}

      <div className="space-y-2">
        {operators.map(op => (
          <div key={op.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="font-medium">{op.name}</span>
              <span className="text-sm text-gray-500 ml-2">{op.email}</span>
            </div>
            <button onClick={() => handleDelete(op.id)}
              className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}
