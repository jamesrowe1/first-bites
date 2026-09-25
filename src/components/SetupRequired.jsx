export default function SetupRequired() {
  return <div className="auth-page">
    <div className="auth-card setup-card">
      <div className="logo-large">🥄</div>
      <h1>First Bites</h1>
      <p>This multi-user version needs Supabase so separate accounts can securely share family data.</p>
      <div className="setup-steps">
        <div><b>1</b><span>Create a Supabase project.</span></div>
        <div><b>2</b><span>Run <code>supabase/schema.sql</code> in the SQL Editor.</span></div>
        <div><b>3</b><span>Copy <code>.env.example</code> to <code>.env.local</code> and add your project URL and publishable key.</span></div>
      </div>
      <p className="small-note">Then restart <code>npm run dev</code>. Full setup instructions are in README.md.</p>
    </div>
  </div>
}
