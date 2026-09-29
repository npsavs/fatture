import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function tag(xml: Document, name: string) {
  return xml.getElementsByTagName(name)[0]?.textContent?.trim() || ''
}

function leggiXml(text: string) {
  const xml = new DOMParser().parseFromString(text, 'text/xml')
  const linee = [...xml.getElementsByTagName('DettaglioLinee')].map(n => ({
    desc: n.getElementsByTagName('Descrizione')[0]?.textContent || '',
    qta: n.getElementsByTagName('Quantita')[0]?.textContent || '1',
    prezzo: n.getElementsByTagName('PrezzoUnitario')[0]?.textContent || '0',
    tot: n.getElementsByTagName('PrezzoTotale')[0]?.textContent || '0',
  }))
  return {
    fornitore: tag(xml, 'Denominazione') || `${tag(xml, 'Nome')} ${tag(xml, 'Cognome')}`.trim(),
    piva: tag(xml, 'IdCodice'),
    numero: tag(xml, 'Numero'),
    data: tag(xml, 'Data'),
    totale: tag(xml, 'ImportoTotaleDocumento'),
    linee,
  }
}

export default function Fornitori() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [xmlRaw, setXmlRaw] = useState('')
  const [fileName, setFileName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: s } = await supabase.from('suppliers').select('*').order('name')
    const { data: i } = await supabase.from('supplier_invoices').select('*, suppliers(name)').order('created_at', { ascending: false })
    setSuppliers(s || [])
    setInvoices(i || [])
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    if (!file.name.toLowerCase().endsWith('.xml') && !text.includes('FatturaElettronica')) {
      return alert('Carica il file XML della fattura elettronica (non il PDF)')
    }
    setXmlRaw(text)
    setPreview(leggiXml(text))
  }

  async function salva() {
    if (!preview) return alert('Carica prima l’XML')
    let supplier = suppliers.find(s => s.cf_piva === preview.piva || s.name === preview.fornitore)
    if (!supplier) {
      const { data, error } = await supabase.from('suppliers').insert({
        name: preview.fornitore || fileName,
        cf_piva: preview.piva || null,
      }).select().single()
      if (error) return alert(error.message)
      supplier = data
    }
    const { error } = await supabase.from('supplier_invoices').insert({
      supplier_id: supplier.id,
      invoice_number: preview.numero || null,
      invoice_date: preview.data || null,
      amount: preview.totale ? Number(preview.totale) : null,
      notes: (preview.linee || []).map((l: any) => `${l.qta} x ${l.desc} = ${l.tot}`).join('\n'),
      xml_text: xmlRaw,
    })
    if (error) return alert(error.message)
    setPreview(null)
    setXmlRaw('')
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fatture fornitori</h1>
      <p className="text-sm text-slate-600">Carica l’XML scaricato da Sincrogest / Cassetto, non il PDF.</p>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <input type="file" accept=".xml,text/xml" onChange={onFile} />
        {preview && (
          <div className="border rounded-lg p-3 text-sm space-y-1">
            <p><strong>Fornitore:</strong> {preview.fornitore}</p>
            <p><strong>P.IVA:</strong> {preview.piva}</p>
            <p><strong>Numero:</strong> {preview.numero}</p>
            <p><strong>Data:</strong> {preview.data}</p>
            <p><strong>Totale:</strong> € {preview.totale}</p>
            <table className="w-full mt-2 text-xs">
              <thead><tr className="text-left border-b"><th>Descrizione</th><th>Qtà</th><th>Tot</th></tr></thead>
              <tbody>
                {preview.linee.map((l: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-1">{l.desc}</td>
                    <td>{l.qta}</td>
                    <td>{l.tot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={salva} className="mt-3 bg-slate-900 text-white px-4 py-2 rounded-lg">Salva in archivio</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        {invoices.length === 0 && <p className="p-6 text-slate-500">Nessuna fattura</p>}
        {invoices.map(i => (
          <details key={i.id} className="px-4 py-3">
            <summary className="cursor-pointer font-medium">
              {i.suppliers?.name} · {i.invoice_number || 'Senza numero'} · {i.amount ? `€ ${Number(i.amount).toFixed(2)}` : ''}
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap text-slate-600">{i.notes || 'Nessun dettaglio righe'}</pre>
          </details>
        ))}
      </div>
    </div>
  )
}