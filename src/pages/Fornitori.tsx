import { nomeFileSicuro, pdfSemplice, salvaInArchivio } from '../lib/archivio'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function tag(root: Element | Document, name: string) {
  return root.getElementsByTagName(name)[0]?.textContent?.trim() || ''
}

function leggiXml(text: string) {
  const xml = new DOMParser().parseFromString(text, 'text/xml')
  const cedente = xml.getElementsByTagName('CedentePrestatore')[0] || xml.documentElement
  const sede = cedente.getElementsByTagName('Sede')[0]
  const linee = [...xml.getElementsByTagName('DettaglioLinee')].map(n => ({
    desc: n.getElementsByTagName('Descrizione')[0]?.textContent || '',
    qta: n.getElementsByTagName('Quantita')[0]?.textContent || '1',
    prezzo: n.getElementsByTagName('PrezzoUnitario')[0]?.textContent || '0',
    tot: n.getElementsByTagName('PrezzoTotale')[0]?.textContent || '0',
  }))
  return {
    fornitore: tag(cedente, 'Denominazione') || (tag(cedente, 'Nome') + ' ' + tag(cedente, 'Cognome')).trim(),
    piva: tag(cedente, 'IdCodice'),
    pec: tag(cedente, 'PECDestinatario') || tag(xml, 'PECDestinatario'),
    address: sede ? tag(sede, 'Indirizzo') : '',
    zip: sede ? tag(sede, 'CAP') : '',
    city: sede ? tag(sede, 'Comune') : '',
    province: sede ? tag(sede, 'Provincia') : '',
    numero: tag(xml, 'Numero'),
    data: tag(xml, 'Data'),
    totale: tag(xml, 'ImportoTotaleDocumento'),
    linee,
  }
}

async function upsertFornitoreAnagrafica(dati: {
  name: string
  cf_piva?: string | null
  pec?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  zip?: string | null
  city?: string | null
  province?: string | null
}) {
  const name = dati.name.trim()
  if (!name) return { error: 'Nome obbligatorio' }
  const piva = (dati.cf_piva || '').trim() || null

  let existing = null as any
  if (piva) {
    const { data } = await supabase.from('clients').select('*').eq('cf_piva', piva).limit(1)
    existing = data && data[0] ? data[0] : null
  }
  if (!existing) {
    const { data } = await supabase.from('clients').select('*').eq('name', name).limit(1)
    existing = data && data[0] ? data[0] : null
  }

  const payload = {
    name,
    cf_piva: piva,
    pec: dati.pec || null,
    phone: dati.phone || null,
    email: dati.email || null,
    address: dati.address || null,
    zip: dati.zip || null,
    city: dati.city || null,
    province: dati.province || null,
    kind: 'fornitore',
  }

  if (existing) {
    const { error } = await supabase.from('clients').update(payload).eq('id', existing.id)
    return { error: error ? error.message : undefined }
  }
  const { error } = await supabase.from('clients').insert(payload)
  return { error: error ? error.message : undefined }
}

export default function Fornitori() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [xmlRaw, setXmlRaw] = useState('')
  const [fileName, setFileName] = useState('')
  const [savingForn, setSavingForn] = useState(false)
  const [form, setForm] = useState({
    name: '',
    cf_piva: '',
    phone: '',
    email: '',
    pec: '',
    address: '',
    zip: '',
    city: '',
    province: '',
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: s } = await supabase.from('suppliers').select('*').order('name')
    const { data: i } = await supabase.from('supplier_invoices').select('*, suppliers(name)').order('created_at', { ascending: false })
    setSuppliers(s || [])
    setInvoices(i || [])
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function salvaFornitore(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Inserisci il nome del fornitore')
    setSavingForn(true)

    let supplier = suppliers.find(
      s => (form.cf_piva && s.cf_piva === form.cf_piva.trim()) || s.name === form.name.trim()
    )
    if (!supplier) {
      const { data, error } = await supabase.from('suppliers').insert({
        name: form.name.trim(),
        cf_piva: form.cf_piva.trim() || null,
      }).select().single()
      if (error) {
        setSavingForn(false)
        return alert(error.message)
      }
      supplier = data
    }

    const ana = await upsertFornitoreAnagrafica(form)
    setSavingForn(false)
    if (ana.error) return alert('Salvato in fatture, ma Anagrafica: ' + ana.error)

    setForm({
      name: '',
      cf_piva: '',
      phone: '',
      email: '',
      pec: '',
      address: '',
      zip: '',
      city: '',
      province: '',
    })
    load()
    alert('Fornitore salvato anche in Anagrafica.')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const low = file.name.toLowerCase()
    if (!low.endsWith('.xml') && text.indexOf('FatturaElettronica') === -1) {
      return alert('Carica il file XML della fattura elettronica (non il PDF)')
    }
    setXmlRaw(text)
    setPreview(leggiXml(text))
  }

  async function salvaXml() {
    if (!preview) return alert('Carica prima l XML')
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
      notes: (preview.linee || []).map((l: any) => l.qta + ' x ' + l.desc + ' = ' + l.tot).join('\n'),
      xml_text: xmlRaw,
    })
    if (error) return alert(error.message)

    await upsertFornitoreAnagrafica({
      name: preview.fornitore || fileName,
      cf_piva: preview.piva,
      pec: preview.pec,
      address: preview.address,
      zip: preview.zip,
      city: preview.city,
      province: preview.province,
    })

    setPreview(null)
    setXmlRaw('')
    load()
    alert('Fattura salvata. Fornitore aggiornato anche in Anagrafica.')
  }
    const anno = String(preview.data || '').slice(0, 4) || String(new Date().getFullYear())
        const pdfName = nomeFileSicuro(preview.fornitore || fileName, preview.numero || 'senn')
    const righe = [
      'FATTURA FORNITORE ' + (preview.numero || ''),
      'Data ' + (preview.data || ''),
      'Fornitore: ' + (preview.fornitore || ''),
      'PIVA: ' + (preview.piva || ''),
      'Totale ' + (preview.totale || ''),
    ]
    ;(preview.linee || []).forEach((l: any) => {
      righe.push((l.desc || '') + '  ' + (l.tot || ''))
    })
    await salvaInArchivio({
      tipo: 'fornitori',
      anno,
      fileName,
      contenuto: pdfSemplice(righe),
    })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fatture fornitori</h1>
      <p className="text-sm text-slate-600">
        Crea il fornitore a mano oppure carica l XML. In entrambi i casi va anche in Anagrafica.
      </p>

      <form onSubmit={salvaFornitore} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Nuovo fornitore</h2>
        <input name="name" required placeholder="Nome *" value={form.name} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="cf_piva" placeholder="Codice fiscale o Partita IVA" value={form.cf_piva} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="phone" placeholder="Telefono" value={form.phone} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="pec" type="email" placeholder="PEC" value={form.pec} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="address" placeholder="Indirizzo" value={form.address} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="zip" placeholder="CAP" value={form.zip} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="city" placeholder="Citta" value={form.city} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="province" placeholder="Prov." value={form.province} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <button type="submit" disabled={savingForn} className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50">
          {savingForn ? 'Salvataggio...' : 'Salva fornitore'}
        </button>
      </form>

      {suppliers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Fornitori gia in archivio</h2>
          <ul className="text-sm divide-y">
            {suppliers.map(s => (
              <li key={s.id} className="py-2">
                {s.name}{s.cf_piva ? ' · ' + s.cf_piva : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Carica XML fattura fornitore</h2>
        <input type="file" accept=".xml,text/xml" onChange={onFile} />
        {preview && (
          <div className="border rounded-lg p-3 text-sm space-y-1">
            <p><strong>Fornitore:</strong> {preview.fornitore}</p>
            <p><strong>P.IVA:</strong> {preview.piva}</p>
            <p><strong>Numero:</strong> {preview.numero}</p>
            <p><strong>Data:</strong> {preview.data}</p>
            <p><strong>Totale:</strong> {preview.totale}</p>
            <button type="button" onClick={salvaXml} className="mt-3 bg-slate-900 text-white px-4 py-2 rounded-lg">
              Salva in archivio
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        {invoices.length === 0 && <p className="p-6 text-slate-500">Nessuna fattura</p>}
        {invoices.map(i => (
          <details key={i.id} className="px-4 py-3">
            <summary className="cursor-pointer font-medium">
              {i.suppliers && i.suppliers.name} · {i.invoice_number || 'Senza numero'}
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap text-slate-600">{i.notes || ''}</pre>
          </details>
        ))}
      </div>
    </div>
  )
}