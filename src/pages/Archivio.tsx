import { useState } from 'react'
import { collegaArchivio } from '../lib/archivio'

export default function Archivio() {
  const [msg, setMsg] = useState('')

  async function collega() {
    const h = await collegaArchivio()
    if (h) setMsg('Cartella collegata. I PDF andranno in clienti/ANNO e fornitori/ANNO.')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Archivio PDF</h1>
      <p className="text-sm text-slate-600">
        Scegli la cartella C:\Users\nps\NPS-APP\fatture\archivio
      </p>
      <p className="text-sm text-slate-600">
        Struttura: archivio\clienti\2026\Nome_1-2026.pdf e archivio\fornitori\2026\Nome_123.pdf
      </p>
      <button type="button" onClick={collega} className="bg-slate-900 text-white px-4 py-2 rounded-lg">
        Collega cartella archivio
      </button>
      {msg && <p className="text-green-700 text-sm">{msg}</p>}
    </div>
  )
}