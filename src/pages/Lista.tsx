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

function annoDi(r: any) {
  return String(r.invoice_date || r.created_at || '').slice(0, 4)
}

function trimestreDi(r: any) {
  const d = new Date(r.invoice_date || r.created_at)
  return Math.floor(d.getMonth() / 3) + 1
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
  const [trim, setTrim] = useState(Math.floor(new Date().getMonth() / 3) + 1)
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
    setQ('')
    navigate(t === 'ricevute' ? '/ricevute' : '/emesse')
  }

  function passaFiltro(r: any, ricevuta: boolean) {
    if (filtro === 'pagate') return !!r.paid
    if (filtro === 'non_pagate') return !r.paid
    if (ricevuta) return filtro === 'tutte' || filtro === 'pagate' || filtro === 'non_pagate'
    if (filtro === 'inviate') return r.sdi_status === 'inviata_sdi' || r.sdi_status === 'consegnata'
    if (filtro === 'da_inviare') return r.sdi_status === 'da_inviare' || r.sdi_status === 'bozza'
    if (filtro === 'nc') return r.invoice_type === 'nota_credito'
    if (filtro === 'fattura') return (r.invoice_type || 'fattura') !== 'nota_credito'
    if (filtro === 'scartata') return r.sdi_status === 'scartata'
    return true
  }

  const filteredClients = searchClient.trim().length < 2
    ? []
    : clients.filter(c => (c as any).kind !== 'fornitore' && c.name.toLowerCase().includes(searchClient.toLowerCase()))
  const selected = clients.find(c => c.id === clientId)
  const cerca = q.trim().toLowerCase()
  const annoCorrente = String(new Date().getFullYear())

  const filteredRows = rows.filter(r => {
    if (clientId && r.client_id !== clientId) return false
    if (cerca && !(String(r.invoice_number || '').toLowerCase().includes(cerca) || String(r.clients?.name || '').toLowerCase().includes(cerca))) return false
    if (filtroAnno && annoDi(r) !== filtroAnno) return false
    return passaFiltro(r, false)
  })

  const filteredRicevute = ricevute.filter(r => {
    if (cerca && !(String(r.invoice_number || '').toLowerCase().includes(cerca) || String(r.suppliers?.name || '').toLowerCase().includes(cerca))) return false
    const anno = annoDi(r)
    if (filtroAnno && anno && anno !== filtroAnno) return false
    return passaFiltro(r, true)
  })

  const stats = useMemo(() => {
    function contoClienti(lista: any[]) {
      const fatture = lista.filter(r => (r.invoice_type || 'fattura') !== 'nota_credito')
      const note = lista.filter(r => r.invoice_type === 'nota_credito')
      function somma(ids: Set<string>, segno: number) {
        let imponibile = 0
        let iva = 0
        for (const i of itemsAll) {
          if (!ids.has(i.invoice_id)) continue
          const imp = Number(i.quantity) * Number(i.unit_price)
          imponibile += imp * segno
          iva += imp * (Number(i.vat_rate || 0) / 100) * segno
        }
        return { imponibile, iva }
      }
      const a = somma(new Set(fatture.map(r => r.id)), 1)
      const b = somma(new Set(note.map(r => r.id)), -1)
      const imponibile = a.imponibile + b.imponibile
      const iva = a.iva + b.iva
      return { imponibile, iva, totale: imponibile + iva, n: lista.length }
    }
    function contoFornitori(lista: any[]) {
      const totale = lista.reduce((s, r) => s + Number(r.amount || 0), 0)
      const imponibile = totale / 1.22
      return { imponibile, iva: totale - imponibile, totale, n: lista.length }
    }
    return {
      clientiAnno: contoClienti(rows.filter(r => annoDi(r) === annoCorrente)),
      clientiTrim: contoClienti(rows.filter(r => annoDi(r) === annoCorrente && trimestreDi(r) === trim)),
      clientiRicerca: contoClienti(filteredRows),
      clientiRicercaTrim: contoClienti(filteredRows.filter(r => trimestreDi(r) === trim)),
      fornitoriAnno: contoFornitori(ricevute.filter(r => annoDi(r) === annoCorrente)),
      fornitoriTrim: contoFornitori(ricevute.filter(r => annoDi(r) === annoCorrente && trimestreDi(r) === trim)),
      fornitoriRicerca: contoFornitori(filteredRicevute),
      fornitoriRicercaTrim: contoFornitori(filteredRicevute.filter(r => trimestreDi(r) === trim)),
    }
  }, [rows, ricevute, itemsAll, filteredRows, filteredRicevute, trim])

  const titoloCliente = selected ? selected.name : (cerca || 'tutti i clienti')
  const titoloFornitore = cerca || 'tutti i fornitori'
  const nomeFiltro = filtro === 'tutte' ? 'tutte' : filtro.replace('_', ' ')

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
        {[1, 2, 3, 4].map(t => (
          <button key={t} type="button" onClick={() => setTrim(t)} className={'px-3 py-2 rounded-lg text-sm ' + (trim === t ? 'bg-blue-700 text-white' : 'border')}>T{t}</button>
        ))}
        <button type="button" onClick={() => setFiltro('tutte')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'tutte' ? 'bg-blue-700 text-white' : 'border')}>Tutte</button>
        <button type="button" onClick={() => setFiltro('fattura')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'fattura' ? 'bg-blue-700 text-white' : 'border')}>Solo fatture</button>
        <button type="button" onClick={() => setFiltro('nc')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'nc' ? 'bg-blue-700 text-white' : 'border')}>Note credito</button>
        <button type="button" onClick={() => setFiltro('inviate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'inviate' ? 'bg-blue-700 text-white' : 'border')}>Inviate SDI</button>
        <button type="button" onClick={() => setFiltro('da_inviare')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'da_inviare' ? 'bg-blue-700 text-white' : 'border')}>Da inviare SDI</button>
        <button type="button" onClick={() => setFiltro('scartata')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'scartata' ? 'bg-red-700 text-white' : 'border')}>Scartate</button>
        <button type="button" onClick={() => setFiltro('pagate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'pagate' ? 'bg-green-700 text-white' : 'border')}>Pagate</button>
        <button type="button" onClick={() => setFiltro('non_pagate')} className={'px-3 py-2 rounded-lg text-sm ' + (filtro === 'non_pagate' ? 'bg-green-700 text-white' : 'border')}>Non pagate</button>
      </div>

      {tab === 'emesse' ? (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Totale clienti {annoCorrente}</p>
            <p className="text-xl font-bold">EUR {stats.clientiAnno.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.clientiAnno.imponibile.toFixed(2)} · IVA {stats.clientiAnno.iva.toFixed(2)} · {stats.clientiAnno.n}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Trimestre clienti T{trim} {annoCorrente}</p>
            <p className="text-xl font-bold">EUR {stats.clientiTrim.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.clientiTrim.imponibile.toFixed(2)} · IVA {stats.clientiTrim.iva.toFixed(2)} · {stats.clientiTrim.n}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Filtro · {nomeFiltro} · {titoloCliente} · {filtroAnno || 'tutti gli anni'}</p>
            <p className="text-xl font-bold">EUR {stats.clientiRicerca.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.clientiRicerca.imponibile.toFixed(2)} · IVA {stats.clientiRicerca.iva.toFixed(2)} · {stats.clientiRicerca.n}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Filtro T{trim} · {nomeFiltro} · {titoloCliente}</p>
            <p className="text-xl font-bold">EUR {stats.clientiRicercaTrim.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.clientiRicercaTrim.imponibile.toFixed(2)} · IVA {stats.clientiRicercaTrim.iva.toFixed(2)} · {stats.clientiRicercaTrim.n}</p>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Totale fornitori {annoCorrente}</p>
            <p className="text-xl font-bold">EUR {stats.fornitoriAnno.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.fornitoriAnno.imponibile.toFixed(2)} · IVA {stats.fornitoriAnno.iva.toFixed(2)} · {stats.fornitoriAnno.n}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Trimestre fornitori T{trim} {annoCorrente}</p>
            <p className="text-xl font-bold">EUR {stats.fornitoriTrim.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.fornitoriTrim.imponibile.toFixed(2)} · IVA {stats.fornitoriTrim.iva.toFixed(2)} · {stats.fornitoriTrim.n}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Filtro · {nomeFiltro} · {titoloFornitore} · {filtroAnno || 'tutti gli anni'}</p>
            <p className="text-xl font-bold">EUR {stats.fornitoriRicerca.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.fornitoriRicerca.imponibile.toFixed(2)} · IVA {stats.fornitoriRicerca.iva.toFixed(2)} · {stats.fornitoriRicerca.n}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-slate-500">Filtro T{trim} · {nomeFiltro} · {titoloFornitore}</p>
            <p className="text-xl font-bold">EUR {stats.fornitoriRicercaTrim.totale.toFixed(2)}</p>
            <p className="text-sm text-slate-500">Imponibile {stats.fornitoriRicercaTrim.imponibile.toFixed(2)} · IVA {stats.fornitoriRicercaTrim.iva.toFixed(2)} · {stats.fornitoriRicercaTrim.n}</p>
          </div>
        </div>
      )}

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
          {selected ? (
            <div className="flex gap-2 items-center">
              <p className="text-sm text-green-700">Statistiche di: {selected.name}</p>
              <button type="button" onClick={() => setClientId('')} className="text-sm text-slate-500">Tutti i clienti</button>
            </div>
          ) : null}
          <button type="button" onClick={() => crea('fattura')} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Crea fattura</button>
          <button type="button" onClick={() => crea('nota_credito')} className="border px-4 py-2 rounded-lg ml-2">Crea nota di credito</button>
        </div>
      ) : null}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'emesse' ? 'Cerca cliente o numero...' : 'Cerca fornitore o numero...'} className="w-full border rounded-lg px-3 py-2 bg-white" />
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