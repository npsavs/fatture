const KEY = 'nps-archivio-fatture'

export function nomeFile(nome: string, numero: string) {
  const n = (nome || 'SenzaNome').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const num = (numero || 'senn').replace(/[\\/]+/g, '-')
  return n + '_' + num + '.pdf'
}

export function pdfRighe(righe: string[]) {
  return '%PDF-1.4\n' + righe.join('\n')
}

async function cartellaBase() {
  const w = window as any
  if (w.__npsFat) return w.__npsFat
  const salvata = localStorage.getItem(KEY)
  if (!w.showDirectoryPicker) return null
  const handle = await w.showDirectoryPicker({ mode: 'readwrite' })
  w.__npsFat = handle
  localStorage.setItem(KEY, 'ok')
  return handle
}

export async function allineaArchivio(emesse: any[], ricevute: any[]) {
  const base = await cartellaBase()
  if (!base) return false
  const clienti = await base.getDirectoryHandle('clienti', { create: true })
  const fornitori = await base.getDirectoryHandle('fornitori', { create: true })

  for (const r of emesse || []) {
    const anno = String(r.invoice_date || r.created_at || '').slice(0, 4) || String(new Date().getFullYear())
    const dir = await clienti.getDirectoryHandle(anno, { create: true })
    const nome = (r.clients && r.clients.name) || 'Cliente'
    const file = await dir.getFileHandle(nomeFile(nome, r.invoice_number || 'senn'), { create: true })
    const wr = await file.createWritable()
    await wr.write(pdfRighe(['FATTURA ' + (r.invoice_number || ''), nome, String(r.taxable || '')]))
    await wr.close()
  }

  for (const r of ricevute || []) {
    const anno = String(r.invoice_date || r.created_at || '').slice(0, 4) || String(new Date().getFullYear())
    const dir = await fornitori.getDirectoryHandle(anno, { create: true })
    const nome = (r.suppliers && r.suppliers.name) || 'Fornitore'
    const file = await dir.getFileHandle(nomeFile(nome, r.invoice_number || 'senn'), { create: true })
    const wr = await file.createWritable()
    await wr.write(pdfRighe(['FATTURA FORNITORE ' + (r.invoice_number || ''), nome, String(r.amount || '')]))
    await wr.close()
  }
  return true
}