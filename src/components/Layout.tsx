import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const item = ({ isActive }: { isActive: boolean }) =>
  'px-2 py-1 rounded ' + (isActive ? 'bg-white/15 font-semibold' : 'text-slate-300')

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="text-white px-3 py-3" style={{ background: '#0f1a3d' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-3 text-sm">
            <NavLink to="/" end className={item}>Panoramica</NavLink>
            <NavLink to="/emesse" className={item}>Emesse</NavLink>
            <NavLink to="/ricevute" className={item}>Ricevute</NavLink>
            <NavLink to="/clienti" className={item}>Clienti</NavLink>
            <NavLink to="/fornitori" className={item}>Fornitori</NavLink>
            <NavLink to="/sdi" className={item}>SDI</NavLink>
            <NavLink to="/nuovo" className={item}>+ Fattura</NavLink>
<NavLink to="/importa" className={item}>Importa XML</NavLink>
          </nav>
          <button type="button" onClick={() => supabase.auth.signOut()} className="text-sm text-slate-300">Esci</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}