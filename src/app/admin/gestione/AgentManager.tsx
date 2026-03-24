'use client'

import { useState } from 'react'
import { createAgent, updateAgent, deleteAgent, setAgentAvailability, createAgentUser } from './actions'
import type { Agent, AgentAvailability, AgentType } from '@/lib/types'

const DAY_NAMES = ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica']

export default function AgentManager({
  agents,
  availability,
}: {
  agents: Agent[]
  availability: AgentAvailability[]
}) {
  const [showNew, setShowNew] = useState(false)
  const [editAvailId, setEditAvailId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AgentType>('agente')
  const [newAddress, setNewAddress] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<AgentType>('agente')
  const [editAddress, setEditAddress] = useState('')
  const [credentialsForId, setCredentialsForId] = useState<string | null>(null)
  const [agentEmail, setAgentEmail] = useState('')
  const [agentPassword, setAgentPassword] = useState('')
  const [agentLoginName, setAgentLoginName] = useState('')
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    setError('')
    try {
      await createAgent({ name: newName, type: newType, address: newType === 'sportello' ? newAddress : undefined })
      setNewName('')
      setNewAddress('')
      setShowNew(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  function startEdit(agent: Agent) {
    setEditingId(agent.id)
    setEditName(agent.name)
    setEditType(agent.type as AgentType)
    setEditAddress(agent.address || '')
  }

  async function handleEdit(agent: Agent) {
    if (!editName.trim()) return
    setError('')
    try {
      await updateAgent(agent.id, { name: editName, type: editType, active: agent.active, address: editType === 'sportello' ? editAddress : undefined })
      setEditingId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  async function handleToggleActive(agent: Agent) {
    try {
      await updateAgent(agent.id, { name: agent.name, type: agent.type as AgentType, active: !agent.active, address: agent.address || undefined })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  async function handleCreateAgentUser(agentId: string) {
    if (!agentEmail || !agentPassword || !agentLoginName) return
    setError('')
    try {
      await createAgentUser(agentId, { email: agentEmail, password: agentPassword, name: agentLoginName })
      setCredentialsForId(null)
      setAgentEmail('')
      setAgentPassword('')
      setAgentLoginName('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo agente/sportello?')) return
    try {
      await deleteAgent(id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900 text-lg">Agenti e Sportelli</h3>
        </div>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuovo
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {showNew && (
        <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" placeholder="Nome agente/sportello" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo</label>
              <select value={newType} onChange={e => setNewType(e.target.value as AgentType)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all">
                <option value="agente">Agente</option>
                <option value="sportello">Sportello</option>
              </select>
            </div>
          </div>
          {newType === 'sportello' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Indirizzo sportello</label>
              <input value={newAddress} onChange={e => setNewAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" placeholder="Via Roma 1, Milano" />
            </div>
          )}
          <button onClick={handleCreate} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm cursor-pointer">Salva</button>
        </div>
      )}

      <div className="space-y-2">
        {agents.map(agent => (
          <div key={agent.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50/80 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">{agent.name}</span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                  {agent.type === 'agente' ? 'Agente' : 'Sportello'}
                </span>
                {agent.type === 'sportello' && agent.address && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {agent.address}
                  </span>
                )}
                {!agent.active && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-500">Disattivo</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!agent.user_id ? (
                  <button onClick={() => { setCredentialsForId(agent.id); setAgentLoginName(agent.name) }}
                    className="text-xs font-medium text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">Crea accesso</button>
                ) : (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Ha accesso</span>
                )}
                <button onClick={() => startEdit(agent)}
                  className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">Modifica</button>
                <button onClick={() => setEditAvailId(editAvailId === agent.id ? null : agent.id)}
                  className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">Orari</button>
                <button onClick={() => handleToggleActive(agent)}
                  className="text-xs font-medium text-amber-600 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                  {agent.active ? 'Disattiva' : 'Attiva'}
                </button>
                <button onClick={() => handleDelete(agent.id)}
                  className="text-xs font-medium text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">Elimina</button>
              </div>
            </div>

            {editingId === agent.id && (
              <div className="mt-3 bg-blue-50 p-3 rounded-xl space-y-2 border border-blue-100">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Modifica agente/sportello</div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Nome</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                    <select value={editType} onChange={e => setEditType(e.target.value as AgentType)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none">
                      <option value="agente">Agente</option>
                      <option value="sportello">Sportello</option>
                    </select>
                  </div>
                </div>
                {editType === 'sportello' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Indirizzo sportello</label>
                    <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none" placeholder="Via Roma 1, Milano" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(agent)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer">Salva</button>
                  <button onClick={() => setEditingId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 cursor-pointer">Annulla</button>
                </div>
              </div>
            )}

            {credentialsForId === agent.id && (
              <div className="mt-3 bg-emerald-50 p-3 rounded-xl space-y-2 border border-emerald-100">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Crea credenziali accesso</div>
                <div className="grid grid-cols-3 gap-2">
                  <input value={agentLoginName} onChange={e => setAgentLoginName(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none" placeholder="Nome" />
                  <input type="email" value={agentEmail} onChange={e => setAgentEmail(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none" placeholder="Email" />
                  <input type="text" value={agentPassword} onChange={e => setAgentPassword(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none" placeholder="Password" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCreateAgentUser(agent.id)}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer">Crea</button>
                  <button onClick={() => setCredentialsForId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 cursor-pointer">Annulla</button>
                </div>
              </div>
            )}

            {editAvailId === agent.id && (
              <AvailabilityEditor
                agentId={agent.id}
                slots={availability.filter(a => a.agent_id === agent.id)}
                onClose={() => setEditAvailId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AvailabilityEditor({
  agentId,
  slots: initialSlots,
  onClose,
}: {
  agentId: string
  slots: AgentAvailability[]
  onClose: () => void
}) {
  const [slots, setSlots] = useState(
    initialSlots.map(s => ({ day_of_week: s.day_of_week, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) }))
  )
  const [saving, setSaving] = useState(false)

  function addSlot() {
    setSlots([...slots, { day_of_week: 0, start_time: '09:00', end_time: '13:00' }])
  }

  function removeSlot(i: number) {
    setSlots(slots.filter((_, idx) => idx !== i))
  }

  function updateSlot(i: number, field: string, value: string | number) {
    setSlots(slots.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function save() {
    setSaving(true)
    try {
      await setAgentAvailability(agentId, slots)
      onClose()
    } catch {
      alert('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fasce orarie settimanali</div>
      {slots.map((slot, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select value={slot.day_of_week} onChange={e => updateSlot(i, 'day_of_week', parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none">
            {DAY_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
          </select>
          <input type="time" value={slot.start_time} onChange={e => updateSlot(i, 'start_time', e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none" />
          <span className="text-gray-300">-</span>
          <input type="time" value={slot.end_time} onChange={e => updateSlot(i, 'end_time', e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none" />
          <button onClick={() => removeSlot(i)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer text-lg">&times;</button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={addSlot} className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">+ Aggiungi fascia</button>
        <button onClick={save} disabled={saving}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm cursor-pointer disabled:opacity-60">{saving ? 'Salvo...' : 'Salva'}</button>
        <button onClick={onClose} className="text-xs font-medium text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">Annulla</button>
      </div>
    </div>
  )
}
