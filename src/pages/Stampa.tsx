import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

export default function Stampa() {
  const { id } = useParams()
  const [inv, setInv] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: q } = await supabase.from('invoices').select('*').eq('id', id).single()
    setInv(q)
    if (q?.client_id) {
      const { data: c } = await supabase.from('clients').select('*').eq('id', q.client_id).single()
      setClient(c)
    }
    const { data: it } = await supabase.from('invoice_items').select('*').eq('invoice_id', id)
    setItems(it || [])
  }

  if (!inv) return <div className="text-center py-10">Caricamento...</div>

  const imponibile = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
  const iva = imponibile * 0.22
  const totale = imponibile + iva
  const dataFatt = inv.invoice_date || inv.created_at
  const address = client
    ? [client.address, client.zip, client.city, client.province].filter(Boolean).join(' ')
    : ''

  return (
    <div className="bg-neutral-200 min-h-screen print:bg-white">
      <div className="no-print flex gap-3 max-w-[210mm] mx-auto py-4 px-4">
        <Link to={`/fattura/${id}`} className="bg-white border px-4 py-2 text-sm">← Modifica</Link>
        <button onClick={() => window.print()} className="bg-neutral-800 text-white px-4 py-2 text-sm">Stampa / PDF</button>
      </div>

      <article className="bg-white w-[210mm] min-h-[297mm] mx-auto px-12 py-10 text-[12px] print:w-auto">
        <header className="flex justify-between items-start">
          <img src="/logo.png" alt="NPS" className="h-[110px] w-[110px] object-contain" />
          <div className="text-right text-[11px] leading-5">
            <p className="font-semibold">Nuovo Punto Sicurezza snc</p>
            <p>Via Claudia 50</p>
            <p>00062 - Bracciano (RM)</p>
            <p>P.IVA 05678201004</p>
          </div>
        </header>

        <p className="text-right font-semibold mt-6 mb-4">
          FATTURA Nr. {inv.invoice_number} del {format(parseISO(String(dataFatt).slice(0, 10)), 'dd/MM/yyyy')}
        </p>
        <div className="border-t border-neutral-300" />

        <div className="text-right mt-8 mb-8 leading-5">
          <p className="text-[10px] tracking-[0.2em] text-neutral-500 mb-1">DESTINATARIO</p>
          <p className="font-semibold uppercase">{client?.name || 'CLIENTE'}</p>
          {address && <p>{address}</p>}
          <p>CF / P.IVA: {client?.cf_piva || '—'}</p>
          <p>PEC: {client?.pec || '—'}</p>
          <p>Codice SDI: {client?.codice_sdi || '—'}</p>
        </div>

        <p className="mb-6"><span className="font-semibold">Oggetto: </span>{inv.oggetto || 'FATTURA'}</p>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-400 text-[10px]">
              <th className="text-left py-2">DESCRIZIONE</th>
              <th className="text-center py-2 w-10">QTÀ</th>
              <th className="text-right py-2">PREZZO</th>
              <th className="text-right py-2">TOTALE</th>
              <th className="text-center py-2">IVA</th>
            </tr>
          </thead>
          <tbody>
            {items.map(row => {
              const tot = Number(row.quantity) * Number(row.unit_price)
              return (
                <tr key={row.id} className="border-b border-neutral-200">
                  <td className="py-3">{row.name}{row.description ? ` — ${row.description}` : ''}</td>
                  <td className="text-center">{Number(row.quantity)}</td>
                  <td className="text-right">{Number(row.unit_price).toFixed(2)} €</td>
                  <td className="text-right">{tot.toFixed(2)} €</td>
                  <td className="text-center">22%</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-10 text-right space-y-1">
          <p>Imponibile {imponibile.toFixed(2)} €</p>
          <p>IVA 22% {iva.toFixed(2)} €</p>
          <p className="text-2xl font-semibold">Totale {totale.toFixed(2)} €</p>
        </div>

        {inv.notes && <p className="mt-10 text-[11px] whitespace-pre-wrap">{inv.notes}</p>}
      </article>
    </div>
  )
}