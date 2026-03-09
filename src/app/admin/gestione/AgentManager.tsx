'use client'

import { useState } from 'react'
import { createAgent, updateAgent, deleteAgent, setAgentAvailability } from './actions'
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
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    setError('')
    try {
      await createAgent({ name: newName, type: newType })
      setNewName('')
      setShowNew(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  async function handleToggleActive(agent: Agent) {
    try {
      await updateAgent(agent.id, { name: agent.name, type: agent.type as AgentType, active: !agent.active })
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-lg">Agenti e Sportelli</h3>
        <button onClick={() => setShowNew(!showNew)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 cursor-pointer">
          + Nuovo
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {showNew && (
        <div className="bg-gray-50 p-3 rounded-lg flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Nome</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Nome agente/sportello" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tipo</label>
            <select value={newType} onChange={e => setNewType(e.target.value as AgentType)}
              className="px-2 py-1.5 border rounded text-sm">
              <option value="agente">Agente</option>
              <option value="sportello">Sportello</option>
            </select>
          </div>
          <button onClick={handleCreate} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm cursor-pointer">Salva</button>
        </div>
      )}

      <div className="space-y-2">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{agent.name}</span>
                <span className="text-xs ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {agent.type === 'agente' ? 'Agente' : 'Sportello'}
                </span>
                {!agent.active && (
                  <span className="text-xs ml-2 px-2 py-0.5 rounded bg-red-100 text-red-600">Disattivo</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditAvailId(editAvailId === agent.id ? null : agent.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">Disponibilita&apos;</button>
                <button onClick={() => handleToggleActive(agent)}
                  className="text-xs text-yellow-600 hover:text-yellow-800 cursor-pointer">
                  {agent.active ? 'Disattiva' : 'Attiva'}
                </button>
                <button onClick={() => handleDelete(agent.id)}
                  className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Elimina</button>
              </div>
            </div>

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
    <div className="mt-3 border-t pt-3 space-y-2">
      <div className="text-sm font-medium text-gray-600">Fasce orarie settimanali</div>
      {slots.map((slot, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select value={slot.day_of_week} onChange={e => updateSlot(i, 'day_of_week', parseInt(e.target.value))}
            className="px-2 py-1 border rounded text-sm">
            {DAY_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
          </select>
          <input type="time" value={slot.start_time} onChange={e => updateSlot(i, 'start_time', e.target.value)}
            className="px-2 py-1 border rounded text-sm" />
          <span className="text-gray-400">-</span>
          <input type="time" value={slot.end_time} onChange={e => updateSlot(i, 'end_time', e.target.value)}
            className="px-2 py-1 border rounded text-sm" />
          <button onClick={() => removeSlot(i)} className="text-red-500 text-sm cursor-pointer">&times;</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={addSlot} className="text-xs text-blue-600 cursor-pointer">+ Aggiungi fascia</button>
        <button onClick={save} disabled={saving}
          className="bg-green-600 text-white px-3 py-1 rounded text-xs cursor-pointer">{saving ? 'Salvo...' : 'Salva'}</button>
        <button onClick={onClose} className="text-xs text-gray-500 cursor-pointer">Annulla</button>
      </div>
    </div>
  )
}
