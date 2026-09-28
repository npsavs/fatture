import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="text-white px-4 py-3 flex justify-between items-center" style={{ background: '#0f1a3d' }}>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="font-semibold">Fatture NPS</Link>
          <Link to="/nuovo">+ Nuova fattura</Link>
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-300">Esci</button>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}