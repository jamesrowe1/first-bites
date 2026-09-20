import { useEffect, useMemo, useState } from 'react'
import { ALLERGENS, foods } from './data/foods'
import { supabase, supabaseConfigured } from './lib/supabase'

const LS_LOGS = 'first-bites-logs-v1'
const LS_PROFILE = 'first-bites-profile-v1'
const LS_FAVORITES = 'first-bites-favorites-v1'
const defaultProfile = { name: 'Baby', birth_date: '' }

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function ageText(birthDate) {
  if (!birthDate) return 'Add a birth date in Settings'
  const birth = new Date(`${birthDate}T12:00:00`)
  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth()
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) return 'Birth date is in the future'
  return `${months} month${months === 1 ? '' : 's'} old`
}

function App() {
  const [session, setSession] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(supabaseConfigured)
  const [tab, setTab] = useState('home')
  const [logs, setLogs] = useState(() => readLocal(LS_LOGS, []))
  const [profile, setProfile] = useState(() => readLocal(LS_PROFILE, defaultProfile))
  const [favorites, setFavorites] = useState(() => readLocal(LS_FAVORITES, []))
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingAuth(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) localStorage.setItem(LS_LOGS, JSON.stringify(logs))
  }, [logs])
  useEffect(() => {
    if (!supabaseConfigured) localStorage.setItem(LS_PROFILE, JSON.stringify(profile))
  }, [profile])
  useEffect(() => {
    if (!supabaseConfigured) localStorage.setItem(LS_FAVORITES, JSON.stringify(favorites))
  }, [favorites])

  async function loadCloudData() {
    if (!session?.user) return
    setSyncing(true)
    const [logRes, profileRes, favRes] = await Promise.all([
      supabase.from('food_logs').select('*').order('eaten_at', { ascending: false }),
      supabase.from('baby_profiles').select('*').maybeSingle(),
      supabase.from('favorites').select('food_id')
    ])
    if (!logRes.error) setLogs(logRes.data ?? [])
    if (!profileRes.error && profileRes.data) setProfile({ name: profileRes.data.name, birth_date: profileRes.data.birth_date ?? '' })
    if (!favRes.error) setFavorites((favRes.data ?? []).map(x => x.food_id))
    setSyncing(false)
  }

  useEffect(() => { if (session) loadCloudData() }, [session?.user?.id])

  async function addLog(entry) {
    if (supabaseConfigured && session) {
      const { data, error } = await supabase.from('food_logs').insert({ ...entry, user_id: session.user.id }).select().single()
      if (error) throw error
      setLogs(prev => [data, ...prev])
    } else {
      setLogs(prev => [{ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...prev])
    }
  }

  async function removeLog(id) {
    if (supabaseConfigured && session) {
      const { error } = await supabase.from('food_logs').delete().eq('id', id)
      if (error) return alert(error.message)
    }
    setLogs(prev => prev.filter(x => x.id !== id))
  }

  async function saveProfile(next) {
    setProfile(next)
    if (supabaseConfigured && session) {
      const { error } = await supabase.from('baby_profiles').upsert({ user_id: session.user.id, ...next })
      if (error) alert(error.message)
    }
  }

  async function toggleFavorite(foodId) {
    const has = favorites.includes(foodId)
    setFavorites(prev => has ? prev.filter(x => x !== foodId) : [...prev, foodId])
    if (supabaseConfigured && session) {
      if (has) await supabase.from('favorites').delete().eq('food_id', foodId)
      else await supabase.from('favorites').insert({ user_id: session.user.id, food_id: foodId })
    }
  }

  if (loadingAuth) return <div className="center-screen"><div className="spinner"/><p>Loading First Bites…</p></div>
  if (supabaseConfigured && !session) return <Auth />

  const props = { logs, profile, favorites, addLog, removeLog, saveProfile, toggleFavorite, setTab, syncing, loadCloudData }
  return (
    <div className="app-shell">
      <main>
        {tab === 'home' && <Home {...props} />}
        {tab === 'foods' && <Foods {...props} />}
        {tab === 'log' && <LogFood {...props} />}
        {tab === 'progress' && <Progress {...props} />}
        {tab === 'settings' && <Settings {...props} />}
      </main>
      <nav className="bottom-nav">
        <NavButton active={tab==='home'} icon="⌂" label="Home" onClick={()=>setTab('home')} />
        <NavButton active={tab==='foods'} icon="◉" label="Foods" onClick={()=>setTab('foods')} />
        <button className="log-fab" onClick={()=>setTab('log')} aria-label="Log food">＋</button>
        <NavButton active={tab==='progress'} icon="✓" label="Progress" onClick={()=>setTab('progress')} />
        <NavButton active={tab==='settings'} icon="⚙" label="Settings" onClick={()=>setTab('settings')} />
      </nav>
    </div>
  )
}

function Header({ title, subtitle }) {
  return <header className="page-header"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="brand-dot">FB</div></header>
}

function Home({ logs, profile, setTab, syncing }) {
  const tried = new Set(logs.map(x => x.food_id))
  const recent = logs.slice(0, 5)
  const introduced = new Set()
  logs.forEach(log => foods.find(f=>f.id===log.food_id)?.allergens.forEach(a=>introduced.add(a)))
  return <div className="page">
    <Header title={`Hi, ${profile.name || 'Baby'}!`} subtitle={`${ageText(profile.birth_date)}${syncing ? ' • syncing…' : ''}`} />
    <section className="hero-card">
      <div><span className="eyebrow">FOOD JOURNEY</span><strong>{tried.size}</strong><p>foods tried</p></div>
      <div className="ring" style={{'--progress': `${Math.min(tried.size,100)*3.6}deg`}}><span>{tried.size}%</span></div>
    </section>
    <div className="stat-grid">
      <div className="stat-card"><b>{introduced.size}/{ALLERGENS.length}</b><span>allergens introduced</span></div>
      <div className="stat-card"><b>{logs.filter(x=>new Date(x.eaten_at) > new Date(Date.now()-7*864e5)).length}</b><span>logs this week</span></div>
    </div>
    <section className="section-row"><h2>Recent foods</h2><button onClick={()=>setTab('log')}>+ Log food</button></section>
    <div className="card-list">
      {recent.length===0 ? <Empty text="Nothing logged yet. Add the first food!" /> : recent.map(log => <LogRow key={log.id} log={log} />)}
    </div>
    <section className="tip"><b>Safety note</b><p>Preparation guidance here is a family reference, not medical advice. Always supervise eating and use your pediatrician or feeding specialist for individualized guidance.</p></section>
  </div>
}

function Foods({ logs, favorites, toggleFavorite, setTab }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState(null)
  const tried = new Set(logs.map(x=>x.food_id))
  const categories = ['All', ...new Set(foods.map(f=>f.category))]
  const filtered = foods.filter(f => (category==='All'||f.category===category) && f.name.toLowerCase().includes(query.toLowerCase()))
  return <div className="page">
    <Header title="Foods" subtitle={`${tried.size} tried • ${foods.length} in your starter library`} />
    <input className="search" placeholder="Search foods…" value={query} onChange={e=>setQuery(e.target.value)} />
    <div className="chips">{categories.map(c=><button key={c} className={category===c?'chip active':'chip'} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="food-grid">{filtered.map(food=><button className="food-card" key={food.id} onClick={()=>setSelected(food)}>
      <span className="food-emoji">{food.emoji}</span><b>{food.name}</b><small>{food.category}</small>
      <span className={tried.has(food.id)?'tried-badge yes':'tried-badge'}>{tried.has(food.id)?'✓ Tried':'Not tried'}</span>
    </button>)}</div>
    {selected && <div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <button className="close" onClick={()=>setSelected(null)}>×</button>
      <div className="modal-emoji">{selected.emoji}</div><h2>{selected.name}</h2>
      <p className="meta">Generally from {selected.minMonths}+ months • {selected.category}</p>
      {selected.allergens.length>0 && <div className="allergen-banner">Contains: {selected.allergens.join(', ')}</div>}
      <h3>Serving idea</h3><p>{selected.serve}</p><h3>Note</h3><p>{selected.note}</p>
      <div className="modal-actions"><button className="secondary" onClick={()=>toggleFavorite(selected.id)}>{favorites.includes(selected.id)?'★ Favorite':'☆ Favorite'}</button><button className="primary" onClick={()=>{setSelected(null);setTab('log')}}>Log a food</button></div>
    </div></div>}
  </div>
}

function LogFood({ addLog, setTab }) {
  const [foodId, setFoodId] = useState(foods[0].id)
  const [eatenAt, setEatenAt] = useState(new Date().toISOString().slice(0,16))
  const [liked, setLiked] = useState('liked')
  const [reaction, setReaction] = useState('none')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(e){
    e.preventDefault(); setSaving(true)
    try { await addLog({ food_id:foodId, eaten_at:new Date(eatenAt).toISOString(), liked, reaction, amount, notes, first_exposure:false }); setTab('home') }
    catch(err){ alert(err.message) } finally { setSaving(false) }
  }
  return <div className="page"><Header title="Log food" subtitle="Record an exposure or meal" />
    <form className="form-card" onSubmit={submit}>
      <label>Food<select value={foodId} onChange={e=>setFoodId(e.target.value)}>{foods.map(f=><option value={f.id} key={f.id}>{f.emoji} {f.name}</option>)}</select></label>
      <label>Date & time<input type="datetime-local" value={eatenAt} onChange={e=>setEatenAt(e.target.value)} /></label>
      <fieldset><legend>How did it go?</legend><div className="segmented">{['liked','neutral','disliked'].map(x=><button type="button" key={x} className={liked===x?'active':''} onClick={()=>setLiked(x)}>{x}</button>)}</div></fieldset>
      <label>Reaction<select value={reaction} onChange={e=>setReaction(e.target.value)}><option value="none">No reaction</option><option value="possible">Possible reaction</option><option value="mild">Mild reaction</option><option value="significant">Significant reaction</option></select></label>
      <label>Amount / description<input placeholder="e.g. 3 spoonfuls" value={amount} onChange={e=>setAmount(e.target.value)} /></label>
      <label>Notes<textarea rows="4" placeholder="Texture, preparation, symptoms, what worked…" value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <button className="primary big" disabled={saving}>{saving?'Saving…':'Save food log'}</button>
    </form>
  </div>
}

function Progress({ logs, removeLog }) {
  const triedIds = [...new Set(logs.map(x=>x.food_id))]
  const introduced = ALLERGENS.map(allergen=>{
    const matching = logs.filter(l => foods.find(f=>f.id===l.food_id)?.allergens.includes(allergen))
    return { allergen, count:matching.length, last:matching[0]?.eaten_at }
  })
  return <div className="page"><Header title="Progress" subtitle={`${triedIds.length} unique foods tried`} />
    <section className="progress-card"><div className="progress-top"><b>{triedIds.length} / 100 foods</b><span>{Math.min(triedIds.length,100)}%</span></div><div className="bar"><i style={{width:`${Math.min(triedIds.length,100)}%`}}/></div></section>
    <h2>Allergen tracker</h2><div className="allergen-list">{introduced.map(a=><div className="allergen-row" key={a.allergen}><span className={a.count?'status-dot on':'status-dot'} /><div><b>{a.allergen}</b><small>{a.count ? `${a.count} exposure${a.count===1?'':'s'} • last ${new Date(a.last).toLocaleDateString()}` : 'Not logged yet'}</small></div></div>)}</div>
    <h2>History</h2><div className="card-list">{logs.length===0?<Empty text="Your food history will appear here."/>:logs.map(log=><LogRow key={log.id} log={log} removable onRemove={()=>removeLog(log.id)} />)}</div>
  </div>
}

function Settings({ profile, saveProfile, loadCloudData, syncing }) {
  const [draft, setDraft] = useState(profile)
  useEffect(()=>setDraft(profile),[profile.name, profile.birth_date])
  return <div className="page"><Header title="Settings" subtitle={supabaseConfigured?'Cloud sync enabled':'Local demo mode'} />
    <section className="form-card"><h2>Baby profile</h2><label>Name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Birth date<input type="date" value={draft.birth_date||''} onChange={e=>setDraft({...draft,birth_date:e.target.value})}/></label><button className="primary" onClick={()=>saveProfile(draft)}>Save profile</button></section>
    <section className="settings-card"><h2>Sync</h2>{supabaseConfigured ? <><p>Your data is stored in Supabase under the signed-in account. Use the same family login on both Android phones.</p><button className="secondary" onClick={loadCloudData}>{syncing?'Syncing…':'Refresh from cloud'}</button></> : <p>This copy is using this browser's local storage. Follow the README setup to enable two-phone syncing.</p>}</section>
    <section className="settings-card"><h2>Install on Android</h2><p>After deployment, open the site in Chrome → menu (⋮) → <b>Add to Home screen</b> or <b>Install app</b>.</p></section>
    {supabaseConfigured && <button className="danger" onClick={()=>supabase.auth.signOut()}>Sign out</button>}
  </div>
}

function Auth(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mode,setMode]=useState('signin'); const [busy,setBusy]=useState(false)
  async function submit(e){e.preventDefault();setBusy(true);const action=mode==='signin'?supabase.auth.signInWithPassword({email,password}):supabase.auth.signUp({email,password});const {error}=await action;if(error)alert(error.message);else if(mode==='signup')alert('Account created. If email confirmation is enabled in Supabase, confirm the email before signing in.');setBusy(false)}
  return <div className="auth-page"><div className="auth-card"><div className="logo-large">🥄</div><h1>First Bites</h1><p>Private family food tracking</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required minLength="6" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary big" disabled={busy}>{busy?'Working…':mode==='signin'?'Sign in':'Create family account'}</button></form><button className="text-button" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Need an account? Create one':'Already have an account? Sign in'}</button></div></div>
}

function LogRow({log, removable, onRemove}){ const food=foods.find(f=>f.id===log.food_id); if(!food)return null; return <div className="log-row"><span className="log-emoji">{food.emoji}</span><div><b>{food.name}</b><small>{new Date(log.eaten_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} • {log.liked || 'logged'}{log.reaction && log.reaction!=='none'?` • ${log.reaction} reaction`:''}</small></div>{removable&&<button className="icon-button" onClick={onRemove}>×</button>}</div> }
function Empty({text}){return <div className="empty">{text}</div>}
function NavButton({active,icon,label,onClick}){return <button className={active?'nav-button active':'nav-button'} onClick={onClick}><span>{icon}</span><small>{label}</small></button>}

export default App
