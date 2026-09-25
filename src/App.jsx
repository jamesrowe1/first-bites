import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useFamilyData } from './hooks/useFamilyData'
import AuthScreen from './components/AuthScreen'
import HouseholdSetup from './components/HouseholdSetup'
import ChildSetup from './components/ChildSetup'
import FirstBitesApp from './components/FirstBitesApp'
import SetupRequired from './components/SetupRequired'

function CloudApp({ session }) {
  const family = useFamilyData(session)

  if (family.loading) {
    return <div className="center-screen"><div className="spinner" /><p>Loading First Bites…</p></div>
  }

  if (family.error && !family.households.length) {
    return <div className="center-screen"><div className="error-panel"><h2>Couldn’t load First Bites</h2><p>{family.error}</p><button className="primary" onClick={() => location.reload()}>Try again</button></div></div>
  }

  if (!family.households.length) {
    return <HouseholdSetup family={family} session={session} />
  }

  if (!family.children.length) {
    return <ChildSetup family={family} />
  }

  return <FirstBitesApp family={family} session={session} />
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingAuth(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoadingAuth(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) return <SetupRequired />
  if (loadingAuth) return <div className="center-screen"><div className="spinner" /><p>Checking sign-in…</p></div>
  if (!session) return <AuthScreen />
  return <CloudApp session={session} />
}
