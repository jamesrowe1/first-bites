import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ChildSetup({ family }) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await family.createChild({ name, birth_date: birthDate })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="onboarding-page">
    <div className="onboarding-card">
      <div className="logo-large">👶</div>
      <h1>Add a child</h1>
      <p className="muted">You’re in <b>{family.household?.name}</b>. Add the first child whose foods you want to track.</p>
      <form className="form-card flat" onSubmit={submit}>
        <label>Name<input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gwen" /></label>
        <label>Birth date <span className="optional">(optional)</span><input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} /></label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary big" disabled={busy}>{busy ? 'Saving…' : 'Add child'}</button>
      </form>
      {family.households.length > 1 && <button className="text-button" onClick={() => family.setHouseholdId(family.households.find(h => h.id !== family.householdId)?.id || '')}>Switch household</button>}
      <button className="text-button signout-link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  </div>
}
