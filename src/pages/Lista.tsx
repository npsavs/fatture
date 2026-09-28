import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client } from '../types'

const STATI = [
  { value: 'bozza', label: 'Bozza' },
  { value: 'da_inviare', label: 'Da inviare SDI' },
  { value: 'inviata_sdi', label: 'Inviata SDI' },
  { value: 'consegnata', label: 'Consegnata' },
  { value: 'scartata', label: 'Scartata' },
  { value: 'mancata_consegna', label: 'Mancata consegna' },
]

export default function Lista() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [searchClient, setSearchClient] = useState('')
  const [clientId, setClientId] = useState('')
  const [newC, setNewC] = useState({ name: '', phone: '', email: '', cf_piva: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('invoices').select('*, clients(name)').order('created_at', { ascending: false })
    const { data: cl } = await supabase.from('clients').select('*').order('name')
    setRows(data || [])
    setClients(cl || [])
  }

  async function setStatus(id: string, sdi_status: string) {
    await supabase.from('invoices').update({ sdi_status }).eq('id', id)
    load()
  }

  async function setPaid(id: string, paid: boolean) {
    await supabase.from('invoices').update({ paid }).eq('id', id)
    load()
  }

  async function addCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!newC.name.trim()) return
    const { data, error } = await supabase.from('clients').insert({
      name: newC.name.trim(),
      phone: newC.phone || null,
      email: newC.email || null,
      cf_piva: newC.cf_piva || null,
    }).select().single()
    if (error) return alert(error.message)
    setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(data.id)
    setNewC({ name: '', phone: '', email: '', cf_piva: '' })
  }

  function crea(tipo: 'fattura' | 'nota_credito') {
    if (!clientId) return alert('Seleziona o crea prima il cliente')
    navigate(`/nuovo?cliente=${clientId}&tipo=${tipo}`)
  }

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase()))
  const selected = clients.find(c => c.id === clientId)
  const filteredRows = rows.filter(r => {
    const t = q.toLowerCase()
    if (!t) return true
    return String(r.invoice_number || '').toLowerCase().includes(t)
      || String(r.clients?.name || '').toLowerCase().includes(t)
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fatture</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">1. Scegli o crea il cliente</h2>
        <input value={searchClient} onChange={e => setSearchClient(e.target.value)} placeholder="Cerca cliente..." className="w-full border rounded-lg px-3 py-2" />
        <div className="max-h-32 overflow-auto border rounded-lg">
          {filteredClients.map(c => (
            <button key={c.id} type="button" onClick={() => setClientId(c.id)} className={`block w-full text-left px-3 py-2 text-sm ${clientId === c.id ? 'bg-blue-50 font-medium' : ''}`}>
              {c.name}
            </button>
          ))}
        </div>
        {selected && <p className="text-sm text-green-700">Cliente: <strong>{selected.name}</strong></p>}

        <form onSubmit={addCliente} className="grid md:grid-cols-5 gap-2">
          <input value={newC.name} onChange={e => setNewC(p => ({ ...p, name: e.target.value }))} placeholder="Nuovo nome *" className="border rounded-lg px-2 py-2" />
          <input value={newC.phone} onChange={e => setNewC(p => ({ ...p, phone: e.target.value }))} placeholder="Telefono" className="border rounded-lg px-2 py-2" />
          <input value={newC.email} onChange={e => setNewC(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="border rounded-lg px-2 py-2" />
          <input value={newC.cf_piva} onChange={e => setNewC(p => ({ ...p, cf_piva: e.target.value }))} placeholder="CF / P.IVA" className="border rounded-lg px-2 py-2" />
          <button className="bg-blue-600 text-white rounded-lg">Salva cliente</button>
        </form>

        <div className="flex gap-2">
          <button type="button" onClick={() => crea('fattura')} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Crea fattura</button>
          <button type="button" onClick={() => crea('nota_credito')} className="border px-4 py-2 rounded-lg">Crea nota di credito</button>
        </div>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca fattura per numero o cliente..." className="w-full border rounded-lg px-3 py-2 bg-white" />

      <div className="bg-white rounded-xl shadow divide-y">
        {filteredRows.length === 0 && <p className="p-6 text-slate-500">Nessuna fattura</p>}
        {filteredRows.map(r => (
          <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <Link to={`/fattura/${r.id}`} className="flex-1 min-w-[160px]">
              <p className="font-medium">
                {r.invoice_type === 'nota_credito' ? 'NC ' : ''}{r.invoice_number} · {r.clients?.name || 'Senza cliente'}
              </p>
              <p className="text-sm text-slate-500">{r.invoice_date} · € {Number(r.taxable || 0).toFixed(2)}</p>
            </Link>
            <select value={r.sdi_status || 'bozza'} onChange={e => setStatus(r.id, e.target.value)} className="border rounded-lg text-sm px-2 py-1">
              {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setPaid(r.id, !r.paid)}
              className={`text-xs px-3 py-1 rounded-full ${r.paid ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {r.paid ? 'Pagata' : 'Segna pagata'}
            </button>
            <span className={`text-xs px-2 py-1 rounded-full ${r.email_sent ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}>
              {r.email_sent ? 'Email inviata' : 'Email no'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}