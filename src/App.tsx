import Ricevuta from './pages/Ricevuta'
import Fornitori from './pages/Fornitori'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Lista from './pages/Lista'
import Editor from './pages/Editor'
import Stampa from './pages/Stampa'

function DaClienteAFattura() {
  const { id } = useParams()
  return <Navigate to={'/nuovo?cliente=' + id} replace />
}

export default function App() {
  const [session, setSession] = useState<any>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="p-10 text-center">Caricamento...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
        <Route element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Lista />} />
          <Route path="/nuovo" element={<Editor />} />
          <Route path="/fattura/:id" element={<Editor />} />
          <Route path="/stampa/:id" element={<Stampa />} />
          <Route path="/cliente/:id" element={<DaClienteAFattura />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/fornitori" element={<Fornitori />} />
          <Route path="/ricevuta/:id" element={<Ricevuta />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}