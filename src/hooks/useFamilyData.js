import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const HOUSEHOLD_KEY = 'first-bites-active-household-v2'
const CHILD_KEY = 'first-bites-active-child-v2'

function displayNameForUser(user) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Family member'
  )
}

function avatarForUser(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
}

export function useFamilyData(session) {
  const user = session?.user ?? null
  const [profile, setProfile] = useState(null)
  const [households, setHouseholds] = useState([])
  const [householdId, setHouseholdIdState] = useState(() => localStorage.getItem(HOUSEHOLD_KEY) || '')
  const [children, setChildren] = useState([])
  const [childId, setChildIdState] = useState(() => localStorage.getItem(CHILD_KEY) || '')
  const [members, setMembers] = useState([])
  const [logs, setLogs] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const household = households.find(h => h.id === householdId) ?? null
  const child = children.find(c => c.id === childId) ?? null

  const memberNames = useMemo(() => {
    const map = {}
    members.forEach(member => {
      map[member.user_id] = member.profile?.display_name || 'Family member'
    })
    if (user && profile) map[user.id] = profile.display_name
    return map
  }, [members, profile, user])

  const ensureProfile = useCallback(async () => {
    if (!user) return null
    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (readError) throw readError
    if (existing) {
      setProfile(existing)
      return existing
    }
    const newProfile = {
      id: user.id,
      display_name: displayNameForUser(user),
      avatar_url: avatarForUser(user)
    }
    // React StrictMode can run startup effects more than once in development.
    // Use an idempotent upsert so simultaneous profile creation attempts do not
    // fail with a duplicate primary-key error. ignoreDuplicates preserves any
    // display name/avatar the user may have customized later.
    const { error: insertError } = await supabase
      .from('profiles')
      .upsert(newProfile, { onConflict: 'id', ignoreDuplicates: true })
    if (insertError) throw insertError

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError
    setProfile(data)
    return data
  }, [user?.id])

  const loadHouseholds = useCallback(async (preferredId = '') => {
    if (!user) return []
    const { data, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id, role, joined_at, households(id, name, invite_code, created_by, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
    if (membershipError) throw membershipError

    const next = (data ?? [])
      .filter(row => row.households)
      .map(row => ({ ...row.households, role: row.role, joined_at: row.joined_at }))
    setHouseholds(next)

    const saved = preferredId || localStorage.getItem(HOUSEHOLD_KEY) || householdId
    const nextId = next.some(h => h.id === saved) ? saved : (next[0]?.id || '')
    setHouseholdIdState(nextId)
    if (nextId) localStorage.setItem(HOUSEHOLD_KEY, nextId)
    else localStorage.removeItem(HOUSEHOLD_KEY)
    return next
  }, [user?.id, householdId])

  const loadHouseholdContext = useCallback(async (targetHouseholdId = householdId) => {
    if (!user || !targetHouseholdId) {
      setChildren([])
      setMembers([])
      setChildIdState('')
      return
    }
    setSyncing(true)
    try {
      const [childRes, memberRes] = await Promise.all([
        supabase.from('children').select('*').eq('household_id', targetHouseholdId).order('created_at', { ascending: true }),
        supabase.from('household_members').select('user_id, role, joined_at').eq('household_id', targetHouseholdId).order('joined_at', { ascending: true })
      ])
      if (childRes.error) throw childRes.error
      if (memberRes.error) throw memberRes.error

      const nextChildren = childRes.data ?? []
      setChildren(nextChildren)
      const savedChild = localStorage.getItem(CHILD_KEY) || childId
      const nextChildId = nextChildren.some(c => c.id === savedChild) ? savedChild : (nextChildren[0]?.id || '')
      setChildIdState(nextChildId)
      if (nextChildId) localStorage.setItem(CHILD_KEY, nextChildId)
      else localStorage.removeItem(CHILD_KEY)

      const rawMembers = memberRes.data ?? []
      const ids = rawMembers.map(m => m.user_id)
      let profiles = []
      if (ids.length) {
        const profileRes = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
        if (profileRes.error) throw profileRes.error
        profiles = profileRes.data ?? []
      }
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
      setMembers(rawMembers.map(m => ({ ...m, profile: profileMap[m.user_id] ?? null })))
    } finally {
      setSyncing(false)
    }
  }, [user?.id, householdId, childId])

  const loadChildData = useCallback(async (targetChildId = childId) => {
    if (!user || !targetChildId) {
      setLogs([])
      setFavorites([])
      return
    }
    setSyncing(true)
    try {
      const [logRes, favRes] = await Promise.all([
        supabase.from('child_food_logs').select('*').eq('child_id', targetChildId).order('eaten_at', { ascending: false }),
        supabase.from('child_favorites').select('food_id').eq('child_id', targetChildId)
      ])
      if (logRes.error) throw logRes.error
      if (favRes.error) throw favRes.error
      setLogs(logRes.data ?? [])
      setFavorites((favRes.data ?? []).map(row => row.food_id))
    } finally {
      setSyncing(false)
    }
  }, [user?.id, childId])

  const bootstrap = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      await ensureProfile()
      await loadHouseholds()
    } catch (err) {
      setError(err.message || 'Could not load your account.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, ensureProfile, loadHouseholds])

  useEffect(() => {
    if (user) bootstrap()
  }, [user?.id])

  useEffect(() => {
    if (!loading && householdId) {
      loadHouseholdContext(householdId).catch(err => setError(err.message))
    } else if (!householdId) {
      setChildren([])
      setMembers([])
      setChildIdState('')
    }
  }, [householdId, loading])

  useEffect(() => {
    if (!loading && childId) {
      loadChildData(childId).catch(err => setError(err.message))
    } else if (!childId) {
      setLogs([])
      setFavorites([])
    }
  }, [childId, loading])

  function setHouseholdId(id) {
    setHouseholdIdState(id)
    setChildIdState('')
    if (id) localStorage.setItem(HOUSEHOLD_KEY, id)
    else localStorage.removeItem(HOUSEHOLD_KEY)
    localStorage.removeItem(CHILD_KEY)
  }

  function setChildId(id) {
    setChildIdState(id)
    if (id) localStorage.setItem(CHILD_KEY, id)
    else localStorage.removeItem(CHILD_KEY)
  }

  async function createHousehold(name) {
    const clean = name.trim()
    if (!clean) throw new Error('Enter a household name.')
    const { data, error: rpcError } = await supabase.rpc('create_household', { p_name: clean })
    if (rpcError) throw rpcError
    await loadHouseholds(data)
    return data
  }

  async function joinHousehold(code) {
    const clean = code.trim().toUpperCase()
    if (!clean) throw new Error('Enter an invite code.')
    const { data, error: rpcError } = await supabase.rpc('join_household', { p_code: clean })
    if (rpcError) throw rpcError
    await loadHouseholds(data)
    return data
  }


  async function removeHouseholdMember(targetUserId) {
    if (!householdId) throw new Error('Choose a household first.')
    if (!targetUserId) throw new Error('Choose a family member.')
    const { error: rpcError } = await supabase.rpc('remove_household_member', {
      p_household_id: householdId,
      p_user_id: targetUserId
    })
    if (rpcError) throw rpcError
    await loadHouseholdContext(householdId)
  }

  async function leaveHousehold() {
    if (!householdId) throw new Error('Choose a household first.')
    const leavingId = householdId
    const { error: rpcError } = await supabase.rpc('leave_household', {
      p_household_id: leavingId
    })
    if (rpcError) throw rpcError
    localStorage.removeItem(CHILD_KEY)
    setChildIdState('')
    await loadHouseholds('')
  }

  async function createChild({ name, birth_date }) {
    if (!householdId) throw new Error('Choose a household first.')
    const clean = name.trim()
    if (!clean) throw new Error('Enter a child name.')
    const { data, error: insertError } = await supabase
      .from('children')
      .insert({ household_id: householdId, name: clean, birth_date: birth_date || null })
      .select()
      .single()
    if (insertError) throw insertError
    await loadHouseholdContext(householdId)
    setChildId(data.id)
    return data
  }

  async function updateChild(id, changes) {
    const payload = {
      name: changes.name?.trim(),
      birth_date: changes.birth_date || null,
      updated_at: new Date().toISOString()
    }
    if (!payload.name) throw new Error('Enter a child name.')
    const { error: updateError } = await supabase.from('children').update(payload).eq('id', id)
    if (updateError) throw updateError
    await loadHouseholdContext(householdId)
  }

  async function saveProfile(changes) {
    const display_name = changes.display_name?.trim()
    if (!display_name) throw new Error('Enter your name.')
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ display_name, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()
    if (updateError) throw updateError
    setProfile(data)
    await loadHouseholdContext(householdId)
  }

  async function updateHouseholdName(name) {
    if (!householdId) return
    const clean = name.trim()
    if (!clean) throw new Error('Enter a household name.')
    const { error: updateError } = await supabase
      .from('households')
      .update({ name: clean, updated_at: new Date().toISOString() })
      .eq('id', householdId)
    if (updateError) throw updateError
    await loadHouseholds(householdId)
  }

  async function regenerateInviteCode() {
    if (!householdId) return
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let code = ''
      crypto.getRandomValues(new Uint32Array(8)).forEach(n => { code += alphabet[n % alphabet.length] })
      const { error: updateError } = await supabase
        .from('households')
        .update({ invite_code: code, updated_at: new Date().toISOString() })
        .eq('id', householdId)
      if (!updateError) {
        await loadHouseholds(householdId)
        return code
      }
      if (updateError.code !== '23505') throw updateError
    }
    throw new Error('Could not make a new invite code. Try again.')
  }

  async function addLog(entry) {
    if (!childId) throw new Error('Choose a child first.')
    const firstExposure = !logs.some(log => log.food_id === entry.food_id)
    const { data, error: insertError } = await supabase
      .from('child_food_logs')
      .insert({
        child_id: childId,
        logged_by: user.id,
        ...entry,
        first_exposure: firstExposure
      })
      .select()
      .single()
    if (insertError) throw insertError
    setLogs(prev => [data, ...prev])
    return data
  }

  async function removeLog(id) {
    const { error: deleteError } = await supabase.from('child_food_logs').delete().eq('id', id)
    if (deleteError) throw deleteError
    setLogs(prev => prev.filter(log => log.id !== id))
  }

  async function toggleFavorite(foodId) {
    if (!childId) return
    const has = favorites.includes(foodId)
    if (has) {
      const { error: deleteError } = await supabase.from('child_favorites').delete().eq('child_id', childId).eq('food_id', foodId)
      if (deleteError) throw deleteError
      setFavorites(prev => prev.filter(id => id !== foodId))
    } else {
      const { error: insertError } = await supabase.from('child_favorites').insert({ child_id: childId, food_id: foodId, created_by: user.id })
      if (insertError) throw insertError
      setFavorites(prev => [...prev, foodId])
    }
  }

  async function refreshAll() {
    setSyncing(true)
    setError('')
    try {
      await loadHouseholds(householdId)
      if (householdId) await loadHouseholdContext(householdId)
      if (childId) await loadChildData(childId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return {
    user,
    profile,
    households,
    household,
    householdId,
    setHouseholdId,
    children,
    child,
    childId,
    setChildId,
    members,
    memberNames,
    logs,
    favorites,
    loading,
    syncing,
    error,
    setError,
    createHousehold,
    joinHousehold,
    createChild,
    updateChild,
    saveProfile,
    updateHouseholdName,
    regenerateInviteCode,
    removeHouseholdMember,
    leaveHousehold,
    addLog,
    removeLog,
    toggleFavorite,
    refreshAll
  }
}
