import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function splitIva(totale: number) {
  const imponibile = totale / 1.22
  return { imponibile, iva: totale - imponibile }
}

export default function Fornitori() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [filtroAnno, setFiltroAnno] = useState(String(new Date().getFullYear()))
  const [filtro, setFiltro] = useState('tutte')
  const [form, setForm] = useState({ name: '', cf_piva: '', phone: '', email: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const s = await supabase.from('suppliers').select('*').order('name')
    const i = await supabase.from('supplier_invoices').select('*, suppliers(name)').order('created_at', { ascending: false })
    setSuppliers(s.data || [])
    setInvoices(i.data || [])
  }

  function onChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function salvaFornitore(e: any) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Inserisci il nome')
    const nome = form.name.trim()
    const piva = form.cf_piva.trim() || null
    const insSup = await supabase.from('suppliers').insert({ name: nome, cf_piva: piva })
    if (insSup.error) return alert(insSup.error.message)
    const insCli = await supabase.from('clients').insert({
      name: nome,
      cf_piva: piva,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      kind: 'fornitore',
    })
    if (insCli.error) setMsg('Salvato in fatture. Anagrafica: ' + insCli.error.message)
    else setMsg('Salvato anche in Anagrafica, pagina Fornitori')
    setForm({ name: '', cf_piva: '', phone: '', email: '' })
    load()
  }

  const trovati = q.trim().length < 2 ? [] : suppliers.filter(s => s.name.toLowerCase().includes(q.toLowerCase()))
  const scelto = suppliers.find(s => s.id === supplierId)
  const now = new Date()

  const delFornitore = invoices.filter(i => !supplierId || i.supplier_id === supplierId)
  const lista = delFornitore.filter(i => {
    const data = String(i.invoice_date || i.created_at || '')
    if (filtroAnno && data.slice(0, 4) !== filtroAnno) return false
    if (filtro === 'pagate' && !i.paid) return false
    if (filtro === 'non_pagate' && i.paid) return false
    return true
  })

  function somma(rows: any[]) {
    const totale = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
    return splitIva(totale)
  }
  const annoRows = delFornitore.filter(i => String(i.invoice_date || i.created_at || '').slice(0, 4) === String(now.getFullYear()))
  const meseRows = annoRows.filter(i => {
    const d = new Date(i.invoice_date || i.created_at)
    return d.getMonth() === now.getMonth()
  })
  const anno = somma(annoRows)
  const mese = somma(meseRows)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fornitori</h1>
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <form onSubmit={salvaFornitore} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Nuovo fornitore</h2>
        <input name="name" required placeholder="Nome *" value={form.name} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="cf_piva" placeholder="P.IVA o codice fiscale" value={form.cf_piva} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="phone" placeholder="Telefono" value={form.phone} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="email" placeholder="Email" value={form.email} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Salva fornitore</button>
      </form>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold">Cerca fornitore</h2>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Scrivi almeno 2 lettere..." className="w-full border rounded-lg px-3 py-2" />
        {q.trim().length < 2 ? <p className="text-sm text-slate-500">Nessun elenco finche non cerchi</p> : null}
        {trovati.map((s: any) => (
          <button key={s.id} type="button" onClick={() => { setSupplierId(s.id); setQ(s.name) }} className={'block w-full text-left px-3 py-2 text-sm rounded ' + (supplierId === s.id ? 'bg-blue-50 font-medium' : '')}>{s.name}</button>
        ))}
        {scelto ? <button type="button" onClick={() => { setSupplierId(''); setQ('') }} className="text-sm text-slate-500">Tutti i fornitori</button> : null}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Mese {now.getMonth() + 1}/{now.getFullYear()} {scelto ? '· ' + scelto.name : ''}</p>
          <p>Imponibile EUR {mese.imponibile.toFixed(2)}</p>
          <p>IVA EUR {mese.iva.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Anno {now.getFullYear()} {scelto ? '· ' + scelto.name : ''}</p>
          <p>Imponibile EUR {anno.imponibile.toFixed(2)}</p>
          <p>IVA EUR {anno.iva.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white">
          <option value="">Tutti gli anni</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <button type="button" onClick={() => setFiltro('tutte')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'tutte' ? 'bg-slate-900 text-white' : 'border bg-white')}>Tutte</button>
        <button type="button" onClick={() => setFiltro('pagate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'pagate' ? 'bg-green-700 text-white' : 'border bg-white')}>Pagate</button>
        <button type="button" onClick={() => setFiltro('non_pagate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'non_pagate' ? 'bg-slate-700 text-white' : 'border bg-white')}>Non pagate</button>
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        <h2 className="font-semibold p-4">Fatture ricevute ({lista.length})</h2>
        {lista.map((i: any) => (
          <Link key={i.id} to={'/ricevuta/' + i.id} className="block px-4 py-3 hover:bg-slate-50">
            <p className="font-medium">{(i.suppliers ? i.suppliers.name : '') + ' · ' + (i.invoice_number || '')}</p>
            <p className="text-sm text-slate-500">{i.invoice_date || ''} · EUR {Number(i.amount || 0).toFixed(2)} · {i.paid ? 'Pagata' : 'Non pagata'}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}