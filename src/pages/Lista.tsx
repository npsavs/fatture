import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATI = [
  { value: 'bozza', label: 'Bozza' },
  { value: 'da_inviare', label: 'Da inviare SDI' },
  { value: 'inviata_sdi', label: 'Inviata SDI' },
  { value: 'consegnata', label: 'Consegnata' },
  { value: 'scartata', label: 'Scartata' },
  { value: 'mancata_consegna', label: 'Mancata consegna' },
]

export default function Lista() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
    setRows(data || [])
  }

  async function setStatus(id: string, sdi_status: string) {
    await supabase.from('invoices').update({ sdi_status }).eq('id', id)
    load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Fatture</h1>
        <Link to="/nuovo" className="bg-slate-900 text-white px-4 py-2 rounded-lg">+ Nuova fattura</Link>
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        {rows.length === 0 && <p className="p-6 text-slate-500">Nessuna fattura</p>}
        {rows.map(r => (
          <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <Link to={`/fattura/${r.id}`} className="flex-1">
              <p className="font-medium">{r.invoice_number} · {r.clients?.name || 'Senza cliente'}</p>
              <p className="text-sm text-slate-500">{r.invoice_date} · € {Number(r.taxable || 0).toFixed(2)}</p>
            </Link>
            <select value={r.sdi_status || 'bozza'} onChange={e => setStatus(r.id, e.target.value)} className="border rounded-lg text-sm px-2 py-1">
              {STATI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span className={`text-xs px-2 py-1 rounded-full ${r.email_sent ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
              {r.email_sent ? 'Email inviata' : 'Email non inviata'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}