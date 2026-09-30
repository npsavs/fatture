const DB = 'nps-archivio'
const STORE = 'handles'
const KEY = 'root'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export function nomeFileSicuro(nome: string, numero: string) {
  const n = (nome || 'SenzaNome').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  const num = (numero || 'senn').replace(/[\\/:*?"<>|]+/g, '-').replace(/\//g, '-')
  return n + '_' + num + '.pdf'
}

export async function collegaArchivio() {
  const anyWin = window as any
  if (!anyWin.showDirectoryPicker) {
    alert('Usa Chrome o Edge. Poi scegli la cartella archivio.')
    return null
  }
  const handle = await anyWin.showDirectoryPicker({ mode: 'readwrite' })
  await saveHandle(handle)
  return handle
}

async function root(): Promise<FileSystemDirectoryHandle | null> {
  const h = await loadHandle()
  if (!h) return collegaArchivio()
  const anyH = h as any
  if (anyH.requestPermission) {
    const p = await anyH.requestPermission({ mode: 'readwrite' })
    if (p !== 'granted') return collegaArchivio()
  }
  return h
}

export async function salvaInArchivio(opts: {
  tipo: 'clienti' | 'fornitori'
  anno: string
  fileName: string
  contenuto: string
}) {
  const base = await root()
  if (!base) return false
  const cartellaTipo = await base.getDirectoryHandle(opts.tipo, { create: true })
  const cartellaAnno = await cartellaTipo.getDirectoryHandle(String(opts.anno), { create: true })
  const file = await cartellaAnno.getFileHandle(opts.fileName, { create: true })
  const w = await file.createWritable()
  await w.write(contenuto)
  await w.close()
  return true
}

export function pdfSemplice(righe: string[]) {
  const lines = righe.map(r => (r || '').slice(0, 110))
  const start = 100
  let content = 'BT /F1 11 Tf 50 ' + start + ' Td\n'
  lines.forEach((line, i) => {
    const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    if (i === 0) content += '(' + safe + ') Tj\n'
    else content += '0 -16 Td (' + safe + ') Tj\n'
  })
  content += 'ET'
  const stream = content
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    '4 0 obj << /Length ' + stream.length + ' >> stream\n' + stream + '\nendstream endobj',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach(o => {
    offsets.push(pdf.length)
    pdf += o + '\n'
  })
  const xref = pdf.length
  pdf += 'xref\n0 6\n0000000000 65535 f \n'
  for (let i = 1; i <= 5; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  pdf += 'trailer << /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'
  return pdf
}