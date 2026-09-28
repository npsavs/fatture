import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f1a3d' }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl p-8 w-full max-w-sm space-y-3 shadow">
        <h1 className="text-2xl font-bold text-center">Fatture</h1>
        <p className="text-center text-sm text-blue-800">Stesso accesso del team</p>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full border rounded-lg px-3 py-2" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full text-white py-2 rounded-lg" style={{ background: '#0f1a3d' }}>Accedi</button>
      </form>
    </div>
  )
}