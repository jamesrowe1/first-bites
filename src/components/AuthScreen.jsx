import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function googleSignIn() {
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || email.split('@')[0] } }
        })
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Account created. Check your email to confirm it, then sign in.')
    setBusy(false)
  }

  return <div className="auth-page">
    <div className="auth-card">
      <div className="logo-large">🥄</div>
      <h1>First Bites</h1>
      <p>Shared family food and allergen tracking</p>

      <button className="google-button" onClick={googleSignIn} disabled={busy}>
        <span className="google-g">G</span> Continue with Google
      </button>
      <div className="or-divider"><span>or</span></div>

      <form onSubmit={submit}>
        {mode === 'signup' && <label>Your name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. James" autoComplete="name" /></label>}
        <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
        {message && <div className={message.startsWith('Account created') ? 'notice success' : 'notice error'}>{message}</div>}
        <button className="primary big" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button className="text-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>
        {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
      </button>
    </div>
  </div>
}
