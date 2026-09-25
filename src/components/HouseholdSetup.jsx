import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HouseholdSetup({ family, session }) {
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('Our Family')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'create') await family.createHousehold(name)
      else await family.joinHousehold(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="onboarding-page">
    <div className="onboarding-card">
      <div className="logo-large">🥄</div>
      <h1>Welcome to First Bites</h1>
      <p className="muted">Signed in as {session.user.email}</p>
      <div className="choice-tabs">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create a family</button>
        <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Join a family</button>
      </div>
      <form onSubmit={submit} className="form-card flat">
        {mode === 'create' ? <>
          <h2>Create your household</h2>
          <p className="muted">You’ll get an invite code you can give to another caregiver after they make their own account.</p>
          <label>Household name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rowe Family" /></label>
        </> : <>
          <h2>Join an existing household</h2>
          <p className="muted">Enter the invite code shown in the other caregiver’s First Bites settings.</p>
          <label>Invite code<input className="code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="AB12CD34" autoCapitalize="characters" /></label>
        </>}
        {error && <div className="notice error">{error}</div>}
        <button className="primary big" disabled={busy}>{busy ? 'Working…' : mode === 'create' ? 'Create household' : 'Join household'}</button>
      </form>
      <button className="text-button signout-link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  </div>
}
