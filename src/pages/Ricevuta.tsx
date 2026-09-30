import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Ricevuta() {
  const { id } = useParams()
  const [row, setRow] = useState<any>(null)

  useEffect(() => {
    supabase
      .from('supplier_invoices')
      .select('*, suppliers(name, cf_piva)')
      .eq('id', id)
      .single()
      .then(({ data }) => setRow(data))
  }, [id])

  if (!row) return <div className="p-10 text-center">Caricamento...</div>

  const nome = row.suppliers ? row.suppliers.name : 'Fornitore'

  return (
    <div className="space-y-4">
      <Link to="/fornitori" className="text-blue-600 text-sm">Torna ai fornitori</Link>
      <h1 className="text-2xl font-bold">{nome}</h1>
      <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
        <p>Numero: {row.invoice_number || '-'}</p>
        <p>Data: {row.invoice_date || '-'}</p>
        <p>Totale: {row.amount != null ? Number(row.amount).toFixed(2) : '-'}</p>
        <p>P.IVA: {row.suppliers && row.suppliers.cf_piva ? row.suppliers.cf_piva : '-'}</p>
        <p className="whitespace-pre-wrap">{row.notes || ''}</p>
      </div>
      {row.xml_text ? (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">XML</h2>
          <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">{row.xml_text}</pre>
        </div>
      ) : null}
    </div>
  )
}