import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Clienti() {
  const [rows, setRows] = useState<any[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setRows(data || []))
  }, [])

  const list = rows.filter(c => (c.kind || 'cliente') !== 'fornitore' && c.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-bold">Clienti</h1>
        <a href="https://anagrafica-clienti.vercel.app/nuovo" target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Nuovo in Anagrafica</a>
      </div>
      <p className="text-sm text-slate-600">Anagrafica completa nell app Anagrafica. Qui scegli il cliente e apri la fattura.</p>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca..." className="w-full border rounded-lg px-3 py-2 bg-white" />
      <div className="bg-white rounded-xl shadow divide-y">
        {list.map(c => (
          <div key={c.id} className="px-4 py-3 flex flex-wrap items-center gap-2">
            <div className="flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-500">{c.cf_piva || ''} {c.codice_sdi ? 'SDI ' + c.codice_sdi : ''} {c.pec || ''}</p>
            </div>
            <a href={'https://anagrafica-clienti.vercel.app/cliente/' + c.id} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Scheda</a>
            <Link to={'/nuovo?cliente=' + c.id} className="bg-slate-900 text-white px-3 py-1 rounded-lg text-sm">Nuova fattura</Link>
          </div>
        ))}
      </div>
    </div>
  )
}