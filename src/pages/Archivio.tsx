export function nomeFile(nome: string, numero: string) {
  const n = (nome || 'SenzaNome').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const num = (numero || 'senn').replace(/[\\/]+/g, '-')
  return n + '_' + num + '.pdf'
}

export async function allineaArchivio(emesse: any[], ricevute: any[]) {
  const w = window as any
  if (!w.showDirectoryPicker) return
  if (!w.__npsFat) {
    w.__npsFat = await w.showDirectoryPicker({ mode: 'readwrite' })
  }
  const base = w.__npsFat
  const clienti = await base.getDirectoryHandle('clienti', { create: true })
  const fornitori = await base.getDirectoryHandle('fornitori', { create: true })

  for (const r of emesse || []) {
    const anno = String(r.invoice_date || r.created_at || '').slice(0, 4) || String(new Date().getFullYear())
    const dir = await clienti.getDirectoryHandle(anno, { create: true })
    const nome = (r.clients && r.clients.name) || 'Cliente'
    const file = await dir.getFileHandle(nomeFile(nome, r.invoice_number || 'senn'), { create: true })
    const wr = await file.createWritable()
    await wr.write('FATTURA ' + (r.invoice_number || '') + ' ' + nome)
    await wr.close()
  }
  for (const r of ricevute || []) {
    const anno = String(r.invoice_date || r.created_at || '').slice(0, 4) || String(new Date().getFullYear())
    const dir = await fornitori.getDirectoryHandle(anno, { create: true })
    const nome = (r.suppliers && r.suppliers.name) || 'Fornitore'
    const file = await dir.getFileHandle(nomeFile(nome, r.invoice_number || 'senn'), { create: true })
    const wr = await file.createWritable()
    await wr.write('FATTURA FORNITORE ' + (r.invoice_number || '') + ' ' + nome)
    await wr.close()
  }
}