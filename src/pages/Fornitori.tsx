import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Fornitori() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', cf_piva: '', phone: '', email: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const s = await supabase.from('suppliers').select('*').order('name')
    const i = await supabase.from('supplier_invoices').select('*, suppliers(name)').order('created_at', { ascending: false })
    setSuppliers(s.data || [])
    setInvoices(i.data || [])
  }

  function onChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function salvaFornitore(e: any) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Inserisci il nome')
    const nome = form.name.trim()
    const piva = form.cf_piva.trim() || null
    const insSup = await supabase.from('suppliers').insert({ name: nome, cf_piva: piva })
    if (insSup.error) return alert(insSup.error.message)
    const insCli = await supabase.from('clients').insert({
      name: nome,
      cf_piva: piva,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      kind: 'fornitore',
    })
    if (insCli.error) setMsg('Fornitore in fatture. Anagrafica: ' + insCli.error.message)
    else setMsg('Fornitore salvato anche in Anagrafica')
    setForm({ name: '', cf_piva: '', phone: '', email: '' })
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fornitori</h1>
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <form onSubmit={salvaFornitore} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">Nuovo fornitore</h2>
        <input name="name" required placeholder="Nome *" value={form.name} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="cf_piva" placeholder="P.IVA o codice fiscale" value={form.cf_piva} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="phone" placeholder="Telefono" value={form.phone} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <input name="email" placeholder="Email" value={form.email} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Salva fornitore</button>
      </form>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">Elenco fornitori</h2>
        {suppliers.map((s: any) => (
          <p key={s.id} className="text-sm py-1">{s.name} {s.cf_piva || ''}</p>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        <h2 className="font-semibold p-4">Fatture ricevute (clicca per aprire)</h2>
        {invoices.length === 0 ? <p className="p-4 text-slate-500 text-sm">Nessuna fattura</p> : null}
        {invoices.map((i: any) => (
          <Link key={i.id} to={'/ricevuta/' + i.id} className="block px-4 py-3 hover:bg-slate-50">
            {(i.suppliers ? i.suppliers.name : '') + ' ' + (i.invoice_number || '')}
          </Link>
        ))}
      </div>
    </div>
  )
}