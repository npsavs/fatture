import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Fornitori() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [form, setForm] = useState({ name: '', cf_piva: '', pec: '', email: '', phone: '' })
  const [doc, setDoc] = useState({ invoice_number: '', invoice_date: '', amount: '', notes: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: s } = await supabase.from('suppliers').select('*').order('name')
    const { data: i } = await supabase.from('supplier_invoices').select('*, suppliers(name)').order('created_at', { ascending: false })
    setSuppliers(s || [])
    setInvoices(i || [])
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const { data, error } = await supabase.from('suppliers').insert({
      name: form.name.trim(),
      cf_piva: form.cf_piva || null,
      pec: form.pec || null,
      email: form.email || null,
      phone: form.phone || null,
    }).select().single()
    if (error) return alert(error.message)
    setSupplierId(data.id)
    setForm({ name: '', cf_piva: '', pec: '', email: '', phone: '' })
    load()
  }

  async function uploadPdf(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) return alert('Scegli o crea il fornitore')
    const input = document.getElementById('pdf-forn') as HTMLInputElement
    const file = input?.files?.[0]
    if (!file) return alert('Scegli il PDF')
    const path = `${supplierId}/${Date.now()}.pdf`
    const { error: upErr } = await supabase.storage.from('fornitori').upload(path, file)
    if (upErr) return alert(upErr.message)
    const { data: pub } = supabase.storage.from('fornitori').getPublicUrl(path)
    const { error } = await supabase.from('supplier_invoices').insert({
      supplier_id: supplierId,
      invoice_number: doc.invoice_number || null,
      invoice_date: doc.invoice_date || null,
      amount: doc.amount ? Number(doc.amount) : null,
      notes: doc.notes || null,
      pdf_url: pub.publicUrl,
    })
    if (error) return alert(error.message)
    setDoc({ invoice_number: '', invoice_date: '', amount: '', notes: '' })
    if (input) input.value = ''
    load()
  }

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const selected = suppliers.find(s => s.id === supplierId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fatture fornitori</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Fornitore</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca fornitore..." className="w-full border rounded-lg px-3 py-2" />
        <div className="max-h-32 overflow-auto border rounded-lg">
          {filtered.map(s => (
            <button key={s.id} type="button" onClick={() => setSupplierId(s.id)} className={`block w-full text-left px-3 py-2 text-sm ${supplierId === s.id ? 'bg-blue-50' : ''}`}>
              {s.name} {s.cf_piva ? `· ${s.cf_piva}` : ''}
            </button>
          ))}
        </div>
        {selected && <p className="text-sm text-green-700">Selezionato: <strong>{selected.name}</strong></p>}

        <p className="text-sm font-medium">Non c’è? Aggiungilo</p>
        <form onSubmit={addSupplier} className="grid md:grid-cols-5 gap-2">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome *" className="border rounded-lg px-2 py-2" />
          <input value={form.cf_piva} onChange={e => setForm(p => ({ ...p, cf_piva: e.target.value }))} placeholder="CF / P.IVA" className="border rounded-lg px-2 py-2" />
          <input value={form.pec} onChange={e => setForm(p => ({ ...p, pec: e.target.value }))} placeholder="PEC" className="border rounded-lg px-2 py-2" />
          <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Telefono" className="border rounded-lg px-2 py-2" />
          <button className="bg-blue-600 text-white rounded-lg">Salva fornitore</button>
        </form>
      </div>

      <form onSubmit={uploadPdf} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Carica PDF fattura fornitore</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input value={doc.invoice_number} onChange={e => setDoc(p => ({ ...p, invoice_number: e.target.value }))} placeholder="Numero fattura" className="border rounded-lg px-3 py-2" />
          <input type="date" value={doc.invoice_date} onChange={e => setDoc(p => ({ ...p, invoice_date: e.target.value }))} className="border rounded-lg px-3 py-2" />
          <input type="number" step="0.01" value={doc.amount} onChange={e => setDoc(p => ({ ...p, amount: e.target.value }))} placeholder="Importo €" className="border rounded-lg px-3 py-2" />
        </div>
        <input id="pdf-forn" type="file" accept="application/pdf" />
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg">Salva in archivio</button>
      </form>

      <div className="bg-white rounded-xl shadow divide-y">
        {invoices.length === 0 && <p className="p-6 text-slate-500">Nessuna fattura fornitore</p>}
        {invoices.map(i => (
          <div key={i.id} className="px-4 py-3 flex justify-between items-center gap-3">
            <div>
              <p className="font-medium">{i.suppliers?.name} · {i.invoice_number || 'Senza numero'}</p>
              <p className="text-sm text-slate-500">{i.invoice_date || ''} {i.amount ? `· € ${Number(i.amount).toFixed(2)}` : ''}</p>
            </div>
            {i.pdf_url && <a href={i.pdf_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm">Apri PDF</a>}
          </div>
        ))}
      </div>
    </div>
  )
}