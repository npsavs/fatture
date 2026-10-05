import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATI: Record<string, string> = {
  bozza: 'Bozza',
  da_inviare: 'Da inviare',
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

export default function Home() {
  const [rows, setRows] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [filtro, setFiltro] = useState('tutte')
  const [trim, setTrim] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const anno = new Date().getFullYear()

  useEffect(() => {
    supabase.from('invoices').select('id, invoice_number, invoice_type, sdi_status, paid, invoice_date, created_at, clients(name)').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
    supabase.from('invoice_items').select('invoice_id, quantity, unit_price, vat_rate').then(({ data }) => setItems(data || []))
  }, [])

  function inviata(r: any) {
    return r.sdi_status === 'inviata_sdi' || r.sdi_status === 'consegnata'
  }
  function dataDi(r: any) {
    return new Date(r.invoice_date || r.created_at)
  }
  function conto(lista: any[]) {
    const ids = new Set(lista.map(r => r.id))
    let imponibile = 0
    let iva = 0
    for (const i of items) {
      if (!ids.has(i.invoice_id)) continue
      const imp = Number(i.quantity) * Number(i.unit_price)
      const segno = lista.find(r => r.id === i.invoice_id)?.invoice_type === 'nota_credito' ? -1 : 1
      imponibile += imp * segno
      iva += imp * (Number(i.vat_rate || 0) / 100) * segno
    }
    return { imponibile, iva, totale: imponibile + iva, n: lista.length }
  }
  const inviateAnno = rows.filter(r => dataDi(r).getFullYear() === anno && inviata(r))
  const inviateTrim = inviateAnno.filter(r => trimestre(dataDi(r)) === trim)
  const annoInv = conto(inviateAnno)
  const trimInv = conto(inviateTrim)

  const filtered = rows.filter(r => {
    if (filtro === 'pagate') return !!r.paid
    if (filtro === 'non_pagate') return !r.paid
    if (filtro === 'inviate') return inviata(r)
    if (filtro === 'da_inviare') return r.sdi_status === 'da_inviare' || r.sdi_status === 'bozza' || !r.sdi_status
    if (filtro === 'scartate') return r.sdi_status === 'scartata'
    if (filtro === 'nc') return r.invoice_type === 'nota_credito'
    return true
  })

  const n = (key: string) => rows.filter(r => {
    if (key === 'pagate') return !!r.paid
    if (key === 'non_pagate') return !r.paid
    if (key === 'inviate') return inviata(r)
    if (key === 'da_inviare') return r.sdi_status === 'da_inviare' || r.sdi_status === 'bozza' || !r.sdi_status
    if (key === 'scartate') return r.sdi_status === 'scartata'
    if (key === 'nc') return r.invoice_type === 'nota_credito'
    return true
  }).length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Panoramica fatture</h1>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map(t => (
          <button key={t} type="button" onClick={() => setTrim(t)} className={'px-3 py-2 rounded-full text-sm ' + (trim === t ? 'bg-blue-700 text-white' : 'bg-white border')}>T{t}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Inviate {anno}</p>
          <p className="text-xl font-bold">EUR {annoInv.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {annoInv.imponibile.toFixed(2)} · IVA {annoInv.iva.toFixed(2)} · {annoInv.n} fatture</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Inviate T{trim} {anno}</p>
          <p className="text-xl font-bold">EUR {trimInv.totale.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Imponibile {trimInv.imponibile.toFixed(2)} · IVA {trimInv.iva.toFixed(2)} · {trimInv.n} fatture</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFiltro('tutte')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'tutte' ? 'bg-slate-900 text-white' : 'bg-white border')}>Tutte ({n('tutte')})</button>
        <button type="button" onClick={() => setFiltro('da_inviare')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'da_inviare' ? 'bg-amber-600 text-white' : 'bg-white border')}>Da inviare ({n('da_inviare')})</button>
        <button type="button" onClick={() => setFiltro('inviate')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'inviate' ? 'bg-blue-700 text-white' : 'bg-white border')}>Inviate ({n('inviate')})</button>
        <button type="button" onClick={() => setFiltro('scartate')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'scartate' ? 'bg-red-700 text-white' : 'bg-white border')}>Scartate ({n('scartate')})</button>
        <button type="button" onClick={() => setFiltro('pagate')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'pagate' ? 'bg-green-700 text-white' : 'bg-white border')}>Pagate ({n('pagate')})</button>
        <button type="button" onClick={() => setFiltro('non_pagate')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'non_pagate' ? 'bg-slate-700 text-white' : 'bg-white border')}>Non pagate ({n('non_pagate')})</button>
        <button type="button" onClick={() => setFiltro('nc')} className={'px-3 py-2 rounded-full text-sm ' + (filtro === 'nc' ? 'bg-slate-900 text-white' : 'bg-white border')}>Note credito ({n('nc')})</button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? <p className="text-sm text-slate-500">Nessuna fattura in questo filtro</p> : null}
        {filtered.map(r => (
          <Link key={r.id} to={'/fattura/' + r.id} className="bg-white rounded-xl shadow px-4 py-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[180px]">
              <p className="font-medium">{r.invoice_type === 'nota_credito' ? 'NC ' : ''}{r.invoice_number} · {r.clients?.name || ''}</p>
              <p className="text-xs text-slate-500">{String(r.invoice_date || r.created_at || '').slice(0, 10)}</p>
            </div>
            <span className={'text-xs px-2 py-1 rounded-full ' + statoClass(r.sdi_status || 'bozza')}>{STATI[r.sdi_status] || 'Bozza'}</span>
            <span className={'text-xs px-2 py-1 rounded-full ' + (r.paid ? 'bg-green-600 text-white' : 'bg-slate-100')}>{r.paid ? 'Pagata' : 'Non pagata'}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}