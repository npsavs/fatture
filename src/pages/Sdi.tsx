export default function Sdi() {
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">Fatturazione elettronica SDI</h1>
      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-2">
        <p>Qui arrivera il collegamento allo SDI (XML FatturaPA + intermediario).</p>
        <p>Oggi lo stato SDI in elenco e manuale: bozza, da inviare, inviata, consegnata, scartata, mancata consegna.</p>
        <p>Prima di collegare il canale servono in Anagrafica: P.IVA, PEC e Codice SDI di ogni cliente.</p>
        <p>NPS: P.IVA 05678201004 — da confermare regime fiscale e codice destinatario software.</p>
      </div>
    </div>
  )
}