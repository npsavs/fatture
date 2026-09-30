import { collegaArchivio } from '../lib/archivio'

export default function Archivio() {
  async function collega() {
    const h = await collegaArchivio()
    if (h) alert('Cartella collegata')
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Archivio PDF</h1>
      <p>Scegli C:\Users\nps\NPS-APP\fatture\archivio</p>
      <button type="button" onClick={collega} className="bg-slate-900 text-white px-4 py-2 rounded-lg">
        Collega cartella archivio
      </button>
    </div>
  )
}