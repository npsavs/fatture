import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client } from '../types'

const STATI: any = {
  bozza: 'Bozza',
  da_inviare: 'Da inviare SDI',
  inviata_sdi: 'Inviata SDI',
  consegnata: 'Consegnata',
  scartata: 'Scartata',
  mancata_consegna: 'Mancata consegna',
}

function statoClass(s: string) {
  if (s === 'bozza') return 'bg-slate-200 text-slate-800'
  if (s === 'da_inviare') return 'bg-amber-200 text-amber-900'
  if (s === 'inviata_sdi') return 'bg-blue-200 text-blue-900'
  if (s === 'consegnata') return 'bg-green-200 text-green-900'
  if (s === 'scartata') return 'bg-red-200 text-red-900'
  return 'bg-slate-100 text-slate-700'
}

function trimestre(d: Date) {
  return Math.floor(d.getMonth() / 3) + 1
}

function annoDi(r: any) {
  return String(r.invoice_date || r.created_at || '').slice(0, 4)
}

export default function Lista() {
  const navigate = useNavigate()
  const location = useLocation()
  const paginaRicevute = location.pathname.indexOf('ricevute') >= 0

  const [rows, setRows] = useState<any[]>([])
  const [ricevute, setRicevute] = useState<any[]>([])
  const [itemsAll, setItemsAll] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState(paginaRicevute ? 'ricevute' : 'emesse')
  const [filtro, setFiltro] = useState('tutte')
  const [filtroAnno, setFiltroAnno] = useState(String(new Date().getFullYear()))
  const [searchClient, setSearchClient] = useState('')
  const [clientId, setClientId] = useState('')

  useEffect(() => {
    setTab(paginaRicevute ? 'ricevute' : 'emesse')
  }, [paginaRicevute])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('invoices').select('*, clients(name)').order('created_at', { ascending: false })
    const { data: rec } = await supabase.from('supplier_invoices').select('*, suppliers(name)').order('created_at', { ascending: false })
    const { data: cl } = await supabase.from('clients').select('*').order('name')
    const { data: it } = await supabase.from('invoice_items').select('invoice_id, quantity, unit_price, vat_rate')
    setRows(data || [])
    setRicevute(rec || [])
    setClients(cl || [])
    setItemsAll(it || [])
  }

  async function setPaid(id: string, paid: boolean) {
    await supabase.from('invoices').update({ paid }).eq('id', id)
    load()
  }

  async function setPaidRicevuta(id: string, paid: boolean) {
    await supabase.from('supplier_invoices').update({ paid }).eq('id', id)
    load()
  }

  async function eliminaEmessa(id: string) {
    if (!confirm('Eliminare questa fattura?')) return
    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    await supabase.from('invoices').delete().eq('id', id)
    load()
  }

  async function eliminaRicevuta(id: string) {
    if (!confirm('Eliminare questa fattura ricevuta?')) return
    await supabase.from('supplier_invoices').delete().eq('id', id)
    load()
  }

  function crea(tipo: string) {
    if (!clientId) return alert('Seleziona o crea prima il cliente')
    navigate('/nuovo?cliente=' + clientId + '&tipo=' + tipo)
  }

  function vaiTab(t: string) {
    setTab(t)
    navigate(t === 'ricevute' ? '/ricevute' : '/emesse')
  }

  const now = new Date()
  const year = now.getFullYear()
  const qNow = trimestre(now)

  const stats = useMemo(() => {
    const isFattura = (r: any) => (r.invoice_type || 'fattura') !== 'nota_credito'
    const inPeriodo = (r: any, y: number, t?: number) => {
      const d = new Date(r.invoice_date || r.created_at)
      if (d.getFullYear() !== y) return false
      if (t && trimestre(d) !== t) return false
      return true
    }
    const ids = (list: any[]) => new Set(list.filter(isFattura).map(r => r.id))
    const somma = (idSet: Set<string>) => {
      let imponibile = 0
      let iva = 0
      for (const i of itemsAll) {
        if (!idSet.has(i.invoice_id)) continue
        const imp = Number(i.quantity) * Number(i.unit_price)
        imponibile += imp
        iva += imp * (Number(i.vat_rate || 0) / 100)
      }
      return { imponibile, iva, totale: imponibile + iva }
    }
    const anno = somma(ids(rows.filter(r => inPeriodo(r, year))))
    const trim = somma(ids(rows.filter(r => inPeriodo(r, year, qNow))))
    const ricAnno = ricevute.filter(r => new Date(r.invoice_date || r.created_at).getFullYear() === year)
    const ricTrim = ricAnno.filter(r => trimestre(new Date(r.invoice_date || r.created_at)) === qNow)
    const totR = (list: any[]) => list.reduce((s, r) => s + Number(r.amount || 0), 0)
    return { anno, trim, ricevuteAnno: totR(ricAnno), ricevuteTrim: totR(ricTrim) }
  }, [rows, ricevute, itemsAll, year, qNow])

  const filteredClients = searchClient.trim().length < 2
    ? []
    : clients.filter(c => (c as any).kind !== 'fornitore' && c.name.toLowerCase().includes(searchClient.toLowerCase()))
  const selected = clients.find(c => c.id === clientId)

  const filteredRows = rows.filter(r => {
    const t = q.toLowerCase()
    if (t && !(String(r.invoice_number || '').toLowerCase().includes(t) || String(r.clients?.name || '').toLowerCase().includes(t))) return false
    if (filtroAnno && annoDi(r) !== filtroAnno) return false
    if (filtro === 'inviate') return r.sdi_status === 'inviata_sdi' || r.sdi_status === 'consegnata'
    if (filtro === 'da_inviare') return r.sdi_status === 'da_inviare' || r.sdi_status === 'bozza'
    if (filtro === 'pagate') return !!r.paid
    if (filtro === 'non_pagate') return !r.paid
    if (filtro === 'nc') return r.invoice_type === 'nota_credito'
    if (filtro === 'fattura') return (r.invoice_type || 'fattura') !== 'nota_credito'
    if (filtro === 'scartata') return r.sdi_status === 'scartata'
    return true
  })

  const filteredRicevute = ricevute.filter(r => {
    const t = q.toLowerCase()
    if (t && !(String(r.invoice_number || '').toLowerCase().includes(t) || String(r.suppliers?.name || '').toLowerCase().includes(t))) return false
    const anno = annoDi(r)
    if (filtroAnno && anno && anno !== filtroAnno) return false
    if (filtro === 'pagate') return !!r.paid
    if (filtro === 'non_pagate') return !r.paid
    return true
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{tab === 'ricevute' ? 'Fatture ricevute' : 'Fatture emesse'}</h1>
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl shadow">
        <button type="button" onClick={() => vaiTab('emesse')} className={'px-3 py-2 rounded-lg text-sm ' + (tab === 'emesse' ? 'bg-slate-900 text-white' : 'border')}>Emesse</button>
        <button type="button" onClick={() => vaiTab('ricevute')} className={'px-3 py-2 rounded-lg text-sm ' + (tab === 'ricevute' ? 'bg-slate-900 text-white' : 'border')}>Ricevute</button>
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white">
          <option value="">Tutti gli anni</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <button type="button" onClick={() => setFiltro('tutte')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'tutte' ? 'bg-blue-700 text-white' : 'border')}>Tutte</button>
        <button type="button" onClick={() => setFiltro('fattura')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'fattura' ? 'bg-blue-700 text-white' : 'border')}>Solo fatture</button>
        <button type="button" onClick={() => setFiltro('nc')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'nc' ? 'bg-blue-700 text-white' : 'border')}>Note credito</button>
        <button type="button" onClick={() => setFiltro('inviate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'inviate' ? 'bg-blue-700 text-white' : 'border')}>Inviate SDI</button>
        <button type="button" onClick={() => setFiltro('da_inviare')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'da_inviare' ? 'bg-blue-700 text-white' : 'border')}>Da inviare SDI</button>
        <button type="button" onClick={() => setFiltro('scartata')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'scartata' ? 'bg-red-700 text-white' : 'border')}>Scartate</button>
        <button type="button" onClick={() => setFiltro('pagate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'pagate' ? 'bg-green-700 text-white' : 'border')}>Pagate</button>
        <button type="button" onClick={() => setFiltro('non_pagate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'non_pagate' ? 'bg-green-700 text-white' : 'border')}>Non pagate</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Fatturato {year}</p>
          <p className="text-xl font-bold">EUR {stats.anno.totale.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Fatturato T{qNow} {year}</p>
          <p className="text-xl font-bold">EUR {stats.trim.totale.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Fornitori {year}</p>
          <p className="text-xl font-bold">EUR {stats.ricevuteAnno.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Fornitori T{qNow}</p>
          <p className="text-xl font-bold">EUR {stats.ricevuteTrim.toFixed(2)}</p>
        </div>
      </div>
      {tab === 'emesse' ? (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-semibold">Scegli il cliente</h2>
          <input value={searchClient} onChange={e => setSearchClient(e.target.value)} placeholder="Scrivi almeno 2 lettere..." className="w-full border rounded-lg px-3 py-2" />
          {searchClient.trim().length >= 2 ? (
            <div className="max-h-32 overflow-auto border rounded-lg">
              {filteredClients.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Nessun cliente</p> : null}
              {filteredClients.map(c => (
                <button key={c.id} type="button" onClick={() => setClientId(c.id)} className={'block w-full text-left px-3 py-2 text-sm ' + (clientId === c.id ? 'bg-blue-50 font-medium' : '')}>{c.name}</button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nessun elenco finche non cerchi</p>
          )}
          {selected ? <p className="text-sm text-green-700">Cliente: {selected.name}</p> : null}
          <button type="button" onClick={() => crea('fattura')} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Crea fattura</button>
          <button type="button" onClick={() => crea('nota_credito')} className="border px-4 py-2 rounded-lg ml-2">Crea nota di credito</button>
        </div>
      ) : null}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca numero o nome..." className="w-full border rounded-lg px-3 py-2 bg-white" />
      {tab === 'emesse' ? (
        <div className="bg-white rounded-xl shadow divide-y">
          {filteredRows.length === 0 ? <p className="p-6 text-slate-500">Nessuna fattura</p> : null}
          {filteredRows.map(r => (
            <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <Link to={'/fattura/' + r.id} className="flex-1">
                <p className="font-medium">{r.invoice_type === 'nota_credito' ? 'NC ' : ''}{r.invoice_number} · {r.clients?.name || ''}</p>
              </Link>
              <span className={'text-xs px-2 py-1 rounded-full ' + statoClass(r.sdi_status || 'bozza')}>{STATI[r.sdi_status] || 'Bozza'}</span>
              <button type="button" onClick={() => setPaid(r.id, !r.paid)} className={'text-xs px-3 py-1 rounded-full ' + (r.paid ? 'bg-green-600 text-white' : 'bg-slate-100')}>{r.paid ? 'Pagata' : 'Segna pagata'}</button>
              <button type="button" onClick={() => eliminaEmessa(r.id)} className="text-xs text-red-600">Elimina</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow divide-y">
          <Link to="/fornitori" className="block p-3 text-blue-600 text-sm">Apri fornitori</Link>
          {filteredRicevute.length === 0 ? <p className="p-6 text-slate-500">Nessuna fattura ricevuta</p> : null}
          {filteredRicevute.map(r => (
            <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <Link to={'/ricevuta/' + r.id} className="flex-1">
                <p className="font-medium">{r.suppliers?.name} · {r.invoice_number || ''}</p>
              </Link>
              <button type="button" onClick={() => setPaidRicevuta(r.id, !r.paid)} className={'text-xs px-3 py-1 rounded-full ' + (r.paid ? 'bg-green-600 text-white' : 'bg-slate-100')}>{r.paid ? 'Pagata' : 'Segna pagata'}</button>
              <button type="button" onClick={() => eliminaRicevuta(r.id)} className="text-xs text-red-600">Elimina</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}