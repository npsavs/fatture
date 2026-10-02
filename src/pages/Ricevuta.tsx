import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function testo(el: Element | null, tag: string) {
  const n = el?.getElementsByTagName(tag)[0]
  return n ? (n.textContent || '').trim() : ''
}

export default function Ricevuta() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState<any>(null)

  useEffect(() => {
    supabase.from('supplier_invoices').select('*, suppliers(name, cf_piva)').eq('id', id).single().then(({ data }) => setRow(data))
  }, [id])

  async function elimina() {
    if (!confirm('Eliminare questa fattura fornitore?')) return
    const { error } = await supabase.from('supplier_invoices').delete().eq('id', id)
    if (error) return alert(error.message)
    navigate('/ricevute')
  }

  if (!row) return <div className="p-10 text-center">Caricamento...</div>

  let linee: { desc: string; qta: string; prezzo: string; iva: string }[] = []
  if (row.xml_text) {
    const doc = new DOMParser().parseFromString(row.xml_text, 'text/xml')
    linee = Array.from(doc.getElementsByTagName('DettaglioLinee')).map(l => ({
      desc: testo(l, 'Descrizione'),
      qta: testo(l, 'Quantita') || '1',
      prezzo: testo(l, 'PrezzoUnitario') || '0',
      iva: testo(l, 'AliquotaIVA') || '22',
    }))
  }
  const nome = row.suppliers ? row.suppliers.name : 'Fornitore'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Link to="/ricevute" className="text-blue-600 text-sm">Torna alle ricevute</Link>
        <button type="button" onClick={elimina} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">Elimina fattura</button>
      </div>
      <h1 className="text-2xl font-bold">{nome}</h1>
      <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
        <p>Numero: {row.invoice_number || '-'}</p>
        <p>Data: {row.invoice_date || '-'}</p>
        <p>Totale: {row.amount != null ? Number(row.amount).toFixed(2) + ' EUR' : '-'}</p>
        <p>P.IVA: {row.suppliers && row.suppliers.cf_piva ? row.suppliers.cf_piva : '-'}</p>
        <p>{row.notes || ''}</p>
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        <p className="p-4 font-semibold">Righe</p>
        {linee.length === 0 ? <p className="p-4 text-sm text-slate-500">Nessuna riga leggibile</p> : null}
        {linee.map((l, i) => (
          <div key={i} className="px-4 py-3 text-sm">
            <p className="font-medium">{l.desc}</p>
            <p className="text-slate-500">{l.qta} x {Number(l.prezzo).toFixed(2)} EUR · IVA {l.iva}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}