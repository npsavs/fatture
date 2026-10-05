import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client, InvoiceItem, Material } from '../types'

const ALIQUOTE = [
  { code: '22', rate: 22, label: '22% ordinaria', note: '' },
  { code: '10', rate: 10, label: '10% ridotta', note: '' },
  { code: '5', rate: 5, label: '5% ridotta', note: 'Tab. A parte III-bis DPR 633/1972' },
  { code: '4', rate: 4, label: '4% minima', note: 'Tab. A parte II DPR 633/1972' },
  { code: 'N4', rate: 0, label: '0% Esente', note: 'Esente Art. 10 DPR 633/1972' },
  { code: 'N1', rate: 0, label: '0% Escluso', note: 'Escluso Art. 15 DPR 633/1972' },
  { code: 'N3', rate: 0, label: '0% Non imponibile', note: 'Non imponibile Art. 8 DPR 633/1972' },
  { code: 'N2', rate: 0, label: '0% Non soggetto', note: 'Non soggetto Art. 7 DPR 633/1972' },
  { code: 'N6', rate: 0, label: '0% Inversione contabile', note: 'Inversione contabile Art. 17 DPR 633/1972' },
]

function netto(i: any) {
  return Number(i.quantity) * Number(i.unit_price) * (1 - Number(i.discount_percent || 0) / 100)
}

async function prossimoNumero(tipo: string) {
  const year = new Date().getFullYear()
  const { data } = await supabase.from('invoices').select('invoice_number, invoice_type')
  const usati = (data || [])
    .filter(q => (q.invoice_type || 'fattura') === tipo)
    .map(q => {
      const m = String(q.invoice_number || '').replace(/^NC/i, '').match(/^(\d+)\/(\d{4})$/)
      if (m && Number(m[2]) === year) return Number(m[1])
      return 0
    })
  const n = Math.max(0, ...usati) + 1
  return tipo === 'nota_credito' ? ('NC' + n + '/' + year) : (n + '/' + year)
}

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const clienteFromUrl = params.get('cliente')
  const tipoFromUrl = params.get('tipo') === 'nota_credito' ? 'nota_credito' : 'fattura'

  const [invoiceId, setInvoiceId] = useState<string | null>(id || null)
  const [clients, setClients] = useState<Client[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [clientId, setClientId] = useState(clienteFromUrl || '')
  const [cambia, setCambia] = useState(false)
  const [cercaDest, setCercaDest] = useState('')
  const [searchProd, setSearchProd] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [notes, setNotes] = useState('')
  const [number, setNumber] = useState('')
  const [tipo, setTipo] = useState(tipoFromUrl)
  const [emailSent, setEmailSent] = useState(false)
  const [sdiStatus, setSdiStatus] = useState('bozza')
  const [paid, setPaid] = useState(false)
  const [ivaTutte, setIvaTutte] = useState('22')
  const [dirty, setDirty] = useState(false)
  const [modifica, setModifica] = useState(!id)

  useEffect(() => { start() }, [])

  useEffect(() => {
    function onLeave(e: BeforeUnloadEvent) {
      if (!modifica || !dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    async function onClick(e: MouseEvent) {
      if (!modifica || !dirty) return
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (href.indexOf('/stampa/') >= 0) return
      e.preventDefault()
      e.stopPropagation()
      const ok = await salvaOAbbandona()
      if (ok) window.location.href = a.href
    }
    window.addEventListener('beforeunload', onLeave)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, modifica, clientId, invoiceId, oggetto, notes, number, tipo, paid, items])

  async function scriviRighe() {
    for (const item of items) {
      await supabase.from('invoice_items').update({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        vat_note: (item as any).vat_note || null,
        discount_percent: (item as any).discount_percent || 0,
      }).eq('id', item.id)
    }
  }

  async function salvaOAbbandona() {
    const salva = confirm('Salvare le modifiche?\nOK = salva\nAnnulla = abbandona e lascia la fattura com era')
    if (!salva) {
      setDirty(false)
      setModifica(false)
      return true
    }
    if (!clientId) {
      alert('Senza destinatario non salvo. La fattura resta com era.')
      setDirty(false)
      setModifica(false)
      return true
    }
    await scriviRighe()
    const taxable = items.reduce((s, i) => s + netto(i), 0)
    const { error } = await supabase.from('invoices').update({
      client_id: clientId, oggetto, notes, invoice_number: number, taxable, invoice_type: tipo, sdi_status: 'da_inviare', paid,
    }).eq('id', invoiceId)
    if (error) { alert(error.message); return false }
    setDirty(false)
    setModifica(false)
    return true
  }

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
        setTipo(inv.invoice_type || 'fattura')
        setEmailSent(!!inv.email_sent)
        setSdiStatus(inv.sdi_status || 'bozza')
        setPaid(!!inv.paid)
      }
      const { data: it } = await supabase.from('invoice_items').select('*').eq('invoice_id', id)
      setItems(it || [])
      setDirty(false)
      setModifica(false)
    } else {
      const num = await prossimoNumero(tipoFromUrl)
      const { data: inv } = await supabase.from('invoices').insert({
        invoice_number: num, sdi_status: 'bozza', client_id: clienteFromUrl || null, invoice_type: tipoFromUrl,
      }).select().single()
      if (inv) {
        setInvoiceId(inv.id)
        setNumber(num)
        setTipo(tipoFromUrl)
        if (clienteFromUrl) setClientId(clienteFromUrl)
        setModifica(true)
        setDirty(true)
        navigate('/fattura/' + inv.id, { replace: true })
      }
    }
  }

  async function save() {
    if (!invoiceId) return
    if (!clientId) return alert('Seleziona il destinatario prima di salvare')
    await scriviRighe()
    const taxable = items.reduce((s, i) => s + netto(i), 0)
    const { error } = await supabase.from('invoices').update({
      client_id: clientId, oggetto, notes, invoice_number: number, taxable, invoice_type: tipo, sdi_status: 'da_inviare', paid,
    }).eq('id', invoiceId)
    if (error) alert(error.message)
    else { setSdiStatus('da_inviare'); setDirty(false); setModifica(false); alert('Salvato') }
  }

  async function scegliDestinatario(c: Client) {
    if (!modifica) return
    if (!confirm('Cambiare il destinatario in ' + c.name + '?')) return
    setClientId(c.id)
    setDirty(true)
    setCambia(false)
    setCercaDest('')
  }

  async function eliminaFattura() {
    if (!invoiceId) return
    if (!confirm('Eliminare la fattura ' + number + '? Non si puo annullare.')) return
    setDirty(false)
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
    const { error } = await supabase.from('invoices').delete().eq('id', invoiceId)
    if (error) return alert(error.message)
    navigate('/')
  }

  async function togglePaid() {
    if (!invoiceId || !modifica) return
    if (!clientId) return alert('Seleziona il destinatario prima di salvare')
    setPaid(!paid)
    setDirty(true)
  }

  async function inviaSdi() {
    if (!invoiceId || !modifica) return
    if (!clientId) return alert('Manca il destinatario')
    const cliente = clients.find(c => c.id === clientId)
    if (!cliente?.codice_sdi && !cliente?.pec) return alert('Mancano codice SDI o PEC')
    const { error } = await supabase.from('invoices').update({ sdi_status: 'inviata_sdi' }).eq('id', invoiceId)
    if (error) return alert(error.message)
    setSdiStatus('inviata_sdi')
    alert('Segnata come inviata SDI')
  }

  async function addMaterial(m: Material) {
    if (!invoiceId || !modifica) return
    const { data } = await supabase.from('invoice_items').insert({
      invoice_id: invoiceId, name: m.name, description: m.description, quantity: 1, unit_price: m.unit_price, vat_rate: 22, vat_note: null, discount_percent: 0,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setSearchProd('')
    setDirty(true)
  }

  async function addRiga() {
    if (!invoiceId || !modifica) return
    const { data } = await supabase.from('invoice_items').insert({
      invoice_id: invoiceId, name: 'Nuova riga', quantity: 1, unit_price: 0, vat_rate: 22, vat_note: null, discount_percent: 0,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setDirty(true)
  }

  async function updateItem(itemId: string, patch: Partial<InvoiceItem>) {
    if (!modifica) return
    setDirty(true)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i))
  }

  function trovaIva(item: InvoiceItem) {
    return ALIQUOTE.find(a => a.rate === Number(item.vat_rate) && (a.note || '') === ((item as any).vat_note || ''))
      || ALIQUOTE.find(a => a.rate === Number(item.vat_rate))
      || ALIQUOTE[0]
  }

  async function setIva(itemId: string, code: string) {
    const a = ALIQUOTE.find(x => x.code === code)
    if (!a) return
    await updateItem(itemId, { vat_rate: a.rate, vat_note: a.note || null } as any)
  }

  async function stessaIvaTutte() {
    if (!modifica) return
    const a = ALIQUOTE.find(x => x.code === ivaTutte)
    if (!a) return
    for (const item of items) await updateItem(item.id, { vat_rate: a.rate, vat_note: a.note || null } as any)
  }

  async function removeItem(itemId: string) {
    if (!modifica) return
    setDirty(true)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  async function marcaEmail() {
    if (!invoiceId || !modifica) return
    if (!clientId) return alert('Manca il destinatario')
    const client = clients.find(c => c.id === clientId)
    const to = client?.pec || client?.email
    if (to) window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to) + '&su=' + encodeURIComponent((tipo === 'nota_credito' ? 'Nota di credito ' : 'Fattura ') + number), '_blank')
    await supabase.from('invoices').update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq('id', invoiceId)
    setEmailSent(true)
  }

  const selected = clients.find(c => c.id === clientId)
  const destFiltrati = cercaDest.trim().length < 2 ? [] : clients.filter(c => c.name.toLowerCase().includes(cercaDest.toLowerCase()))
  const found = searchProd.trim().length >= 2 ? materials.filter(m => m.name.toLowerCase().includes(searchProd.toLowerCase())).slice(0, 8) : []
  const tot = items.reduce((s, i) => s + netto(i), 0)
  const ivaTot = items.reduce((s, i) => s + netto(i) * (Number(i.vat_rate) / 100), 0)
  const titolo = tipo === 'nota_credito' || String(number).startsWith('NC') ? 'Nota di credito' : 'Fattura'

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap gap-2 items-center">
        <h1 className="text-2xl font-bold flex-1">{titolo} {number}</h1>
        {!modifica ? <button type="button" onClick={() => setModifica(true)} className="border px-4 py-2 rounded-lg bg-white">Modifica</button> : null}
        {invoiceId ? <Link to={'/stampa/' + invoiceId} className="bg-slate-900 text-white px-4 py-2 rounded-lg">Anteprima / Stampa</Link> : null}
      </div>
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-sm text-slate-500">Destinatario</p>
        {selected ? (
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-lg">{selected.name}</p>
            <p>CF/P.IVA: {selected.cf_piva || '-'}</p>
            <p>PEC: {selected.pec || '-'}</p>
            <p>SDI: {selected.codice_sdi || '-'}</p>
          </div>
        ) : <p className="text-red-700 text-sm">Nessun destinatario. Senza cliente non si puo salvare.</p>}
        {modifica ? <button type="button" onClick={() => setCambia(!cambia)} className="border px-4 py-2 rounded-lg text-sm">{cambia ? 'Annulla cambio' : 'Cambia destinatario'}</button> : null}
        {cambia && modifica ? (
          <div className="border rounded-lg p-3 space-y-2">
            <input value={cercaDest} onChange={e => setCercaDest(e.target.value)} placeholder="Scrivi almeno 2 lettere..." className="w-full border rounded-lg px-3 py-2" />
            <div className="max-h-40 overflow-auto">
              {destFiltrati.map(c => (
                <button key={c.id} type="button" onClick={() => scegliDestinatario(c)} className="block w-full text-left px-3 py-2 text-sm hover:bg-amber-50">{c.name}</button>
              ))}
            </div>
          </div>
        ) : null}
        <input value={oggetto} disabled={!modifica} onChange={e => { setOggetto(e.target.value); setDirty(true) }} placeholder="Oggetto" className="w-full border rounded-lg px-3 py-2" />
        <textarea value={notes} disabled={!modifica} onChange={e => { setNotes(e.target.value); setDirty(true) }} placeholder="Note" className="w-full border rounded-lg px-3 py-2" rows={3} />
      </div>
      {modifica ? (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-semibold">Aggiungi una riga</h2>
          <input value={searchProd} onChange={e => setSearchProd(e.target.value)} placeholder="Cerca prodotto (2 lettere)..." className="w-full border rounded-lg px-3 py-2" />
          {found.length > 0 ? (
            <div className="border rounded-lg divide-y">
              {found.map(m => (
                <button key={m.id} type="button" onClick={() => addMaterial(m)} className="flex justify-between w-full px-3 py-2 text-sm hover:bg-blue-50">
                  <span>{m.name}</span><span>EUR {Number(m.unit_price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={addRiga} className="border px-4 py-2 rounded-lg text-sm">+ Riga libera</button>
        </div>
      ) : null}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <h2 className="font-semibold">Righe</h2>
          {modifica ? (
            <>
              <select value={ivaTutte} onChange={e => setIvaTutte(e.target.value)} className="border rounded px-2 py-1 text-sm">
                {ALIQUOTE.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
              <button type="button" onClick={stessaIvaTutte} className="border px-3 py-1 rounded-lg text-sm">Applica IVA a tutte le righe</button>
            </>
          ) : null}
        </div>
        {items.map(item => (
          <div key={item.id} className="grid md:grid-cols-7 gap-2 items-center">
            <input value={item.name} disabled={!modifica} onChange={e => updateItem(item.id, { name: e.target.value })} className="border rounded px-2 py-1 md:col-span-2" />
            <div className="flex items-center gap-1">
              <button type="button" disabled={!modifica} onClick={() => updateItem(item.id, { quantity: Math.max(1, Number(item.quantity) - 1) })} className="w-8 h-8 border rounded">-</button>
              <input type="number" disabled={!modifica} value={item.quantity} onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })} className="border rounded px-2 py-1 w-16 text-center" />
              <button type="button" disabled={!modifica} onClick={() => updateItem(item.id, { quantity: Number(item.quantity) + 1 })} className="w-8 h-8 border rounded">+</button>
            </div>
            <input type="number" step="0.01" disabled={!modifica} value={item.unit_price} onChange={e => updateItem(item.id, { unit_price: Number(e.target.value) })} className="border rounded px-2 py-1" />
            <input type="number" min="0" max="100" disabled={!modifica} value={(item as any).discount_percent || 0} onChange={e => updateItem(item.id, { discount_percent: Number(e.target.value) } as any)} className="border rounded px-2 py-1" title="Sconto %" />
            <select disabled={!modifica} value={trovaIva(item).code} onChange={e => setIva(item.id, e.target.value)} className="border rounded px-2 py-1 text-xs">
              {ALIQUOTE.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
            </select>
            {modifica ? <button type="button" onClick={() => removeItem(item.id)} className="text-red-600 text-sm">x</button> : null}
            {Number((item as any).discount_percent || 0) > 0 ? (
              <p className="text-xs text-slate-500 md:col-span-7">Listino EUR {Number(item.unit_price).toFixed(2)} · sconto {(item as any).discount_percent}% · paghi EUR {(Number(item.unit_price) * (1 - Number((item as any).discount_percent) / 100)).toFixed(2)}</p>
            ) : null}
          </div>
        ))}
        <p className="text-right font-bold">Imponibile EUR {tot.toFixed(2)} · IVA EUR {ivaTot.toFixed(2)} · Totale EUR {(tot + ivaTot).toFixed(2)}</p>
      </div>
      {modifica ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} className="border px-4 py-2 rounded-lg bg-white">Salva</button>
          <button type="button" onClick={togglePaid} className={'px-4 py-2 rounded-lg ' + (paid ? 'bg-green-600 text-white' : 'border bg-white')}>{paid ? 'Gia pagata' : 'Segna come pagata'}</button>
          <button type="button" onClick={marcaEmail} className="bg-sky-700 text-white px-4 py-2 rounded-lg">{emailSent ? 'Email gia inviata' : 'Invia email'}</button>
          <button type="button" onClick={inviaSdi} className="bg-emerald-700 text-white px-4 py-2 rounded-lg">{sdiStatus === 'inviata_sdi' ? 'Gia inviata SDI' : 'Invia allo SDI'}</button>
          <button type="button" onClick={eliminaFattura} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg">Elimina fattura</button>
        </div>
      ) : null}
    </div>
  )
}