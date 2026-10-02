import { useState } from 'react'
import { supabase } from '../lib/supabase'

function testo(el: Element | null, tag: string) {
  const n = el?.getElementsByTagName(tag)[0]
  return n ? (n.textContent || '').trim() : ''
}

function piva(blocco: Element | null) {
  if (!blocco) return ''
  const id = blocco.getElementsByTagName('IdFiscaleIVA')[0]
  const codice = testo(blocco, 'CodiceFiscale')
  const partita = id ? testo(id, 'IdCodice') : ''
  return (partita || codice).replace(/\s/g, '')
}

function nome(blocco: Element | null) {
  if (!blocco) return ''
  const ana = blocco.getElementsByTagName('Anagrafica')[0]
  const den = testo(ana || blocco, 'Denominazione')
  if (den) return den
  return (testo(ana || blocco, 'Nome') + ' ' + testo(ana || blocco, 'Cognome')).trim()
}

export default function ImportaXml() {
  const [miaPiva, setMiaPiva] = useState(localStorage.getItem('nps_piva') || '')
  const [log, setLog] = useState<string[]>([])

  function add(r: string) {
    setLog(prev => [r, ...prev])
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const mia = miaPiva.replace(/\s/g, '')
    if (mia.length < 11) return alert('Inserisci la tua partita IVA')
    localStorage.setItem('nps_piva', mia)

    for (const file of Array.from(files)) {
      const xml = await file.text()
      const doc = new DOMParser().parseFromString(xml, 'text/xml')
      const header = doc.getElementsByTagName('FatturaElettronicaHeader')[0]
      if (!header) {
        add(file.name + ': XML non riconosciuto')
        continue
      }
      const cedente = header.getElementsByTagName('CedentePrestatore')[0]
      const cessionario = header.getElementsByTagName('CessionarioCommittente')[0]
      const body = doc.getElementsByTagName('FatturaElettronicaBody')[0]
      const dati = body?.getElementsByTagName('DatiGeneraliDocumento')[0]
      const numero = testo(dati || null, 'Numero')
      const data = testo(dati || null, 'Data')
      const totale = Number(testo(dati || null, 'ImportoTotaleDocumento') || 0)
      const pivaMittente = piva(cedente)
      const pivaDest = piva(cessionario)
      const ioMittente = pivaMittente.indexOf(mia) >= 0 || mia.indexOf(pivaMittente) >= 0
      const ioDest = pivaDest.indexOf(mia) >= 0 || mia.indexOf(pivaDest) >= 0

      if (ioMittente) {
        const altro = nome(cessionario)
        const ok = confirm(file.name + ': sei il mittente. Salvare il cliente ' + altro + ' e la fattura ' + numero + '?')
        if (!ok) continue
        let clientId = ''
        const trovati = await supabase.from('clients').select('id, name').ilike('name', altro)
        if (trovati.data && trovati.data[0]) clientId = trovati.data[0].id
        else {
          const ins = await supabase.from('clients').insert({
            name: altro,
            cf_piva: pivaDest || null,
            kind: 'cliente',
          }).select().single()
          if (ins.error || !ins.data) {
            add(file.name + ': ' + (ins.error?.message || 'errore cliente'))
            continue
          }
          clientId = ins.data.id
        }
        const inv = await supabase.from('invoices').insert({
          invoice_number: numero,
          invoice_date: data || null,
          client_id: clientId,
          invoice_type: 'fattura',
          sdi_status: 'consegnata',
          oggetto: 'Import XML',
        }).select().single()
        if (inv.error || !inv.data) {
          add(file.name + ': ' + (inv.error?.message || 'errore fattura'))
          continue
        }
        const linee = Array.from(body.getElementsByTagName('DettaglioLinee'))
        if (linee.length) {
          await supabase.from('invoice_items').insert(linee.map(l => ({
            invoice_id: inv.data.id,
            name: testo(l, 'Descrizione') || 'Riga',
            quantity: Number(testo(l, 'Quantita') || 1),
            unit_price: Number(testo(l, 'PrezzoUnitario') || 0),
            vat_rate: Number(testo(l, 'AliquotaIVA') || 22),
          })))
        }
        add('Cliente: ' + altro + ' · fattura ' + numero)
      } else if (ioDest) {
        const altro = nome(cedente)
        const ok = confirm(file.name + ': sei il destinatario. Salvare il fornitore ' + altro + ' e la fattura ' + numero + '?')
        if (!ok) continue
        let supplierId = ''
        const trovati = await supabase.from('suppliers').select('id, name').ilike('name', altro)
        if (trovati.data && trovati.data[0]) supplierId = trovati.data[0].id
        else {
          const ins = await supabase.from('suppliers').insert({
            name: altro,
            cf_piva: pivaMittente || null,
          }).select().single()
          if (ins.error || !ins.data) {
            add(file.name + ': ' + (ins.error?.message || 'errore fornitore'))
            continue
          }
          supplierId = ins.data.id
        }
        await supabase.from('clients').insert({
          name: altro,
          cf_piva: pivaMittente || null,
          kind: 'fornitore',
        })
        const ric = await supabase.from('supplier_invoices').insert({
          supplier_id: supplierId,
          invoice_number: numero,
          invoice_date: data || null,
          amount: totale,
          notes: 'Import XML',
          xml_text: xml.slice(0, 50000),
        })
        if (ric.error) add(file.name + ': ' + ric.error.message)
        else add('Fornitore: ' + altro + ' · fattura ' + numero + ' · EUR ' + totale.toFixed(2))
      } else {
        add(file.name + ': P.IVA non trovata')
      }
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importa XML</h1>
      <p className="text-sm text-slate-600">Se sei il mittente salva il cliente. Se sei il destinatario salva il fornitore. Puoi scegliere piu file. Poi lancia lo sync per i PDF.</p>
      <input value={miaPiva} onChange={e => setMiaPiva(e.target.value)} placeholder="La tua partita IVA" className="w-full border rounded-lg px-3 py-2" />
      <input type="file" accept=".xml,text/xml" multiple onChange={onFile} />
      <div className="bg-white rounded-xl shadow divide-y">
        {log.map((r, i) => <p key={i} className="px-4 py-2 text-sm">{r}</p>)}
      </div>
    </div>
  )
}