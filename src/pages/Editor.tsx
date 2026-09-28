import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client, InvoiceItem, Material } from '../types'

const ALIQUOTE = [
  { code: '22', rate: 22, label: '22% ordinaria', note: '' },
  { code: '10', rate: 10, label: '10% ridotta', note: '' },
  { code: '5', rate: 5, label: '5% ridotta — Tab. A parte III-bis DPR 633/72', note: 'Tab. A parte III-bis DPR 633/1972' },
  { code: '4', rate: 4, label: '4% minima — Tab. A parte II DPR 633/72', note: 'Tab. A parte II DPR 633/1972' },
  { code: 'N4', rate: 0, label: '0% Esente — Art. 10 DPR 633/72', note: 'Esente Art. 10 DPR 633/1972' },
  { code: 'N1', rate: 0, label: '0% Escluso — Art. 15 DPR 633/72', note: 'Escluso Art. 15 DPR 633/1972' },
  { code: 'N3', rate: 0, label: '0% Non imponibile — Art. 8 DPR 633/72', note: 'Non imponibile Art. 8 DPR 633/1972' },
  { code: 'N2', rate: 0, label: '0% Non soggetto — Art. 7 DPR 633/72', note: 'Non soggetto Art. 7 DPR 633/1972' },
  { code: 'N6', rate: 0, label: '0% Inversione contabile — Art. 17 DPR 633/72', note: 'Inversione contabile Art. 17 DPR 633/1972' },
]

async function prossimoNumero() {
  const year = new Date().getFullYear()
  const { data } = await supabase.from('invoices').select('invoice_number')
  const usati = (data || []).map(q => {
    const m = String(q.invoice_number || '').match(/^(\d+)\/(\d{4})$/)
    if (m && Number(m[2]) === year) return Number(m[1])
    return 0
  })
  return `${Math.max(0, ...usati) + 1}/${year}`
}

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoiceId, setInvoiceId] = useState<string | null>(id || null)
  const [clients, setClients] = useState<Client[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [searchProd, setSearchProd] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [notes, setNotes] = useState('')
  const [number, setNumber] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [ivaTutte, setIvaTutte] = useState('22')

  useEffect(() => { start() }, [])

  async function start() {
    const { data: cl } = await supabase.from('clients').select('*').order('name')
    const { data: mat } = await supabase.from('materials').select('*').order('name')
    setClients(cl || [])
    setMaterials(mat || [])
    if (id) {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (inv) {
        setInvoiceId(inv.id)
        setClientId(inv.client_id || '')
        setOggetto(inv.oggetto || '')
        setNotes(inv.notes || '')
        setNumber(inv.invoice_number || '')
        setEmailSent(!!inv.email_sent)
      }
      const { data: it } = await supabase.from('invoice_items').select('*').eq('invoice_id', id)
      setItems(it || [])
    } else {
      const num = await prossimoNumero()
      const { data: inv } = await supabase.from('invoices').insert({
        invoice_number: num,
        sdi_status: 'bozza',
      }).select().single()
      if (inv) {
        setInvoiceId(inv.id)
        setNumber(num)
        navigate(`/fattura/${inv.id}`, { replace: true })
      }
    }
  }

  async function save() {
    if (!invoiceId) return
    const taxable = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
    const { error } = await supabase.from('invoices').update({
      client_id: clientId || null,
      oggetto,
      notes,
      invoice_number: number,
      taxable,
    }).eq('id', invoiceId)
    if (error) alert(error.message)
    else alert('Salvato')
  }

  async function addMaterial(m: Material) {
    if (!invoiceId) return
    const a = ALIQUOTE.find(x => x.code === '22')!
    const { data } = await supabase.from('invoice_items').insert({
      invoice_id: invoiceId,
      name: m.name,
      description: m.description,
      quantity: 1,
      unit_price: m.unit_price,
      vat_rate: a.rate,
      vat_note: a.note || null,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setSearchProd('')
  }

  async function addRiga() {
    if (!invoiceId) return
    const { data } = await supabase.from('invoice_items').insert({
      invoice_id: invoiceId,
      name: 'Nuova riga',
      quantity: 1,
      unit_price: 0,
      vat_rate: 22,
      vat_note: null,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
  }

  async function updateItem(itemId: string, patch: Partial<InvoiceItem>) {
    await supabase.from('invoice_items').update(patch).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i))
  }

  function trovaIva(item: InvoiceItem) {
    return ALIQUOTE.find(a => a.rate === Number(item.vat_rate) && (a.note || '') === (item.vat_note || ''))
      || ALIQUOTE.find(a => a.rate === Number(item.vat_rate))
      || ALIQUOTE[0]
  }

  async function setIva(itemId: string, code: string) {
    const a = ALIQUOTE.find(x => x.code === code)
    if (!a) return
    await updateItem(itemId, { vat_rate: a.rate, vat_note: a.note || null })
  }

  async function stessaIvaTutte() {
    const a = ALIQUOTE.find(x => x.code === ivaTutte)
    if (!a) return
    for (const item of items) {
      await updateItem(item.id, { vat_rate: a.rate, vat_note: a.note || null })
    }
  }

  async function removeItem(itemId: string) {
    await supabase.from('invoice_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  async function marcaEmail() {
    if (!invoiceId) return
    const client = clients.find(c => c.id === clientId)
    const to = client?.pec || client?.email
    if (to) {
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent('Fattura ' + number)}&body=${encodeURIComponent('In allegato la fattura richiesta.\n\nCordiali saluti\nNuovo Punto Sicurezza')}`,
        '_blank'
      )
    }
    await supabase.from('invoices').update({
      email_sent: true,
      email_sent_at: new Date().toISOString(),
    }).eq('id', invoiceId)
    setEmailSent(true)
  }

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const selected = clients.find(c => c.id === clientId)
  const found = searchProd.trim().length >= 2
    ? materials.filter(m => m.name.toLowerCase().includes(searchProd.toLowerCase())).slice(0, 8)
    : []
  const tot = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
  const iva = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price) * (Number(i.vat_rate) / 100), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Fattura {number}</h1>
        <div className="flex gap-2">
          <button onClick={save} className="border px-4 py-2 rounded-lg">Salva</button>
          {invoiceId && <Link to={`/stampa/${invoiceId}`} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Anteprima / Stampa</Link>}
          <button onClick={marcaEmail} className="bg-sky-700 text-white px-4 py-2 rounded-lg">{emailSent ? 'Email già inviata' : 'Invia email'}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca cliente..." className="w-full border rounded-lg px-3 py-2" />
        <div className="max-h-32 overflow-auto border rounded-lg">
          {filtered.map(c => (
            <button key={c.id} type="button" onClick={() => setClientId(c.id)} className={`block w-full text-left px-3 py-2 text-sm ${clientId === c.id ? 'bg-blue-50' : ''}`}>
              {c.name}
            </button>
          ))}
        </div>
        {selected && (
          <div className="text-sm text-slate-600">
            <p><strong>{selected.name}</strong></p>
            <p>CF/P.IVA: {selected.cf_piva || '—'}</p>
            <p>PEC: {selected.pec || '—'}</p>
            <p>SDI: {selected.codice_sdi || '—'}</p>
          </div>
        )}
        <input value={oggetto} onChange={e => setOggetto(e.target.value)} placeholder="Oggetto" className="w-full border rounded-lg px-3 py-2" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note" className="w-full border rounded-lg px-3 py-2" rows={3} />
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Aggiungi una riga</h2>
        <input value={searchProd} onChange={e => setSearchProd(e.target.value)} placeholder="Cerca prodotto (2 lettere)..." className="w-full border rounded-lg px-3 py-2" />
        {found.length > 0 && (
          <div className="border rounded-lg divide-y">
            {found.map(m => (
              <button key={m.id} type="button" onClick={() => addMaterial(m)} className="flex justify-between w-full px-3 py-2 text-sm hover:bg-blue-50">
                <span>{m.name}</span>
                <span>€ {Number(m.unit_price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={addRiga} className="border px-4 py-2 rounded-lg text-sm">+ Riga libera</button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <h2 className="font-semibold">Righe fattura</h2>
          <select value={ivaTutte} onChange={e => setIvaTutte(e.target.value)} className="border rounded px-2 py-1 text-sm">
            {ALIQUOTE.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
          </select>
          <button type="button" onClick={stessaIvaTutte} className="border px-3 py-1 rounded-lg text-sm">
            Applica IVA a tutte le righe
          </button>
        </div>

        {items.map(item => (
          <div key={item.id} className="grid md:grid-cols-6 gap-2 items-center">
            <input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} className="border rounded px-2 py-1 md:col-span-2" />
            <input type="number" value={item.quantity} onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })} className="border rounded px-2 py-1" />
            <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(item.id, { unit_price: Number(e.target.value) })} className="border rounded px-2 py-1" />
            <select value={trovaIva(item).code} onChange={e => setIva(item.id, e.target.value)} className="border rounded px-2 py-1 text-xs">
              {ALIQUOTE.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
            </select>
            <button onClick={() => removeItem(item.id)} className="text-red-600 text-sm">x</button>
          </div>
        ))}
        <p className="text-right font-bold">
          Imponibile € {tot.toFixed(2)} · IVA € {iva.toFixed(2)} · Totale € {(tot + iva).toFixed(2)}
        </p>
      </div>
    </div>
  )
}