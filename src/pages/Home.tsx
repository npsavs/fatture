import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [emesse, setEmesse] = useState<any[]>([])
  const [ricevute, setRicevute] = useState<any[]>([])
  const year = new Date().getFullYear()

  useEffect(() => {
    supabase.from('invoices').select('id, invoice_number, sdi_status, paid, taxable, invoice_date, created_at, invoice_type, clients(name)').then(({ data }) => setEmesse(data || []))
    supabase.from('supplier_invoices').select('id, amount, paid, invoice_date, created_at').then(({ data }) => setRicevute(data || []))
  }, [])

  const ofYear = (r: any) => new Date(r.invoice_date || r.created_at).getFullYear() === year
  const eY = emesse.filter(ofYear)
  const daInviare = emesse.filter(r => r.sdi_status === 'da_inviare' || r.sdi_status === 'bozza')
  const scarti = emesse.filter(r => r.sdi_status === 'scartata')
  const nonPagate = emesse.filter(r => !r.paid)
  const totE = eY.reduce((s, r) => s + Number(r.taxable || 0), 0)
  const totR = ricevute.filter(ofYear).reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panoramica {year}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/emesse" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Imponibile emesse</p>
          <p className="text-xl font-bold">EUR {totE.toFixed(2)}</p>
        </Link>
        <Link to="/ricevute" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Fatture fornitori</p>
          <p className="text-xl font-bold">EUR {totR.toFixed(2)}</p>
        </Link>
        <Link to="/emesse" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500">Da inviare SDI</p>
          <p className="text-xl font-bold">{daInviare.length}</p>
        </Link>
        <Link to="/emesse" className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-red-600">Scartate SDI</p>
          <p className="text-xl font-bold">{scarti.length}</p>
        </Link>
      </div>
      <p className="text-sm text-slate-600">Non pagate: {nonPagate.length}</p>
      <div className="bg-white rounded-xl shadow divide-y">
        <p className="p-3 font-semibold text-sm">Ultime emesse</p>
        {emesse.slice(0, 8).map(r => (
          <Link key={r.id} to={'/fattura/' + r.id} className="block px-4 py-2 text-sm hover:bg-slate-50">
            {r.invoice_number} · {(r.clients && r.clients.name) || ''}
          </Link>
        ))}
      </div>
    </div>
  )
}