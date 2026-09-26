import { useEffect, useMemo, useState } from 'react'
import { ALLERGENS, foods } from '../data/foods'
import { supabase } from '../lib/supabase'

function ageText(birthDate) {
  if (!birthDate) return 'Birth date not set'
  const birth = new Date(`${birthDate}T12:00:00`)
  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth()
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) return 'Birth date is in the future'
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} old`
  const years = Math.floor(months / 12)
  const extraMonths = months % 12
  return `${years} year${years === 1 ? '' : 's'}${extraMonths ? `, ${extraMonths} mo` : ''}`
}

function foodFor(id) {
  return foods.find(food => food.id === id)
}

export default function FirstBitesApp({ family, session }) {
  const [tab, setTab] = useState('home')

  const shared = { ...family, session, setTab }
  return <div className="app-shell">
    {family.error && <div className="top-error" onClick={() => family.setError('')}>{family.error}<span>×</span></div>}
    <main>
      {tab === 'home' && <Home {...shared} />}
      {tab === 'foods' && <Foods {...shared} />}
      {tab === 'log' && <LogFood {...shared} />}
      {tab === 'progress' && <Progress {...shared} />}
      {tab === 'settings' && <Settings {...shared} />}
    </main>
    <nav className="bottom-nav">
      <NavButton active={tab === 'home'} icon="⌂" label="Home" onClick={() => setTab('home')} />
      <NavButton active={tab === 'foods'} icon="◉" label="Foods" onClick={() => setTab('foods')} />
      <button className="log-fab" onClick={() => setTab('log')} aria-label="Log food">＋</button>
      <NavButton active={tab === 'progress'} icon="✓" label="Progress" onClick={() => setTab('progress')} />
      <NavButton active={tab === 'settings'} icon="⚙" label="Settings" onClick={() => setTab('settings')} />
    </nav>
  </div>
}

function Header({ title, subtitle, syncing, onHome }) {
  return <header className="page-header">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}{syncing ? ' • syncing…' : ''}</p>}</div>
    <button className="brand-dot" onClick={onHome} aria-label="Go to First Bites home" title="Home">FB</button>
  </header>
}

function FamilyBar({ household, households, householdId, setHouseholdId, child, children, childId, setChildId }) {
  return <div className="family-bar">
    <label>
      <span>Family</span>
      {households.length > 1
        ? <select value={householdId} onChange={e => setHouseholdId(e.target.value)}>{households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
        : <b>{household?.name}</b>}
    </label>
    <label>
      <span>Child</span>
      {children.length > 1
        ? <select value={childId} onChange={e => setChildId(e.target.value)}>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        : <b>{child?.name}</b>}
    </label>
  </div>
}

function Home(props) {
  const { logs, child, household, setTab, syncing, memberNames } = props
  const tried = new Set(logs.map(log => log.food_id))
  const recent = logs.slice(0, 5)
  const introduced = new Set()
  logs.forEach(log => foodFor(log.food_id)?.allergens.forEach(allergen => introduced.add(allergen)))
  const thisWeek = logs.filter(log => new Date(log.eaten_at) > new Date(Date.now() - 7 * 864e5)).length

  return <div className="page">
    <Header title={`Hi, ${child?.name || 'there'}!`} subtitle={`${ageText(child?.birth_date)} • ${household?.name}`} syncing={syncing} onHome={() => setTab('home')} />
    <FamilyBar {...props} />
    <section className="hero-card">
      <div><span className="eyebrow">FOOD JOURNEY</span><strong>{tried.size}</strong><p>foods tried</p></div>
      <div className="ring" style={{ '--progress': `${Math.min(tried.size, 100) * 3.6}deg` }}><span>{Math.min(tried.size, 100)}%</span></div>
    </section>
    <div className="stat-grid">
      <div className="stat-card"><b>{introduced.size}/{ALLERGENS.length}</b><span>allergens introduced</span></div>
      <div className="stat-card"><b>{thisWeek}</b><span>logs this week</span></div>
    </div>
    <section className="section-row"><h2>Recent foods</h2><button onClick={() => setTab('log')}>+ Log food</button></section>
    <div className="card-list">
      {recent.length === 0 ? <Empty text="Nothing logged yet. Add the first food!" /> : recent.map(log => <LogRow key={log.id} log={log} memberNames={memberNames} />)}
    </div>
    <section className="tip"><b>Safety note</b><p>First Bites is a family tracking tool, not a diagnosis tool. Always supervise eating and follow your child’s clinician for individualized feeding and allergy guidance.</p></section>
  </div>
}

function Foods(props) {
  const { logs, favorites, toggleFavorite, setTab, child } = props
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState(null)
  const tried = new Set(logs.map(log => log.food_id))
  const categories = ['All', ...new Set(foods.map(food => food.category))]
  const filtered = foods.filter(food => (category === 'All' || food.category === category) && food.name.toLowerCase().includes(query.toLowerCase()))

  async function favorite(foodId) {
    try { await toggleFavorite(foodId) } catch (err) { alert(err.message) }
  }

  return <div className="page">
    <Header title="Foods" subtitle={`${tried.size} tried by ${child?.name} • ${foods.length} in starter library`} onHome={() => setTab('home')} />
    <FamilyBar {...props} />
    <input className="search" placeholder="Search foods…" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="chips">{categories.map(item => <button key={item} className={category === item ? 'chip active' : 'chip'} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="food-grid">{filtered.map(food => <button className="food-card" key={food.id} onClick={() => setSelected(food)}>
      <span className="food-emoji">{food.emoji}</span><b>{food.name}</b><small>{food.category}</small>
      <span className={tried.has(food.id) ? 'tried-badge yes' : 'tried-badge'}>{tried.has(food.id) ? '✓ Tried' : 'Not tried'}</span>
      {favorites.includes(food.id) && <span className="favorite-star">★</span>}
    </button>)}</div>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={e => e.stopPropagation()}>
      <button className="close" onClick={() => setSelected(null)}>×</button>
      <div className="modal-emoji">{selected.emoji}</div><h2>{selected.name}</h2>
      <p className="meta">Generally from {selected.minMonths}+ months • {selected.category}</p>
      {selected.allergens.length > 0 && <div className="allergen-banner">Contains: {selected.allergens.join(', ')}</div>}
      <h3>Serving idea</h3><p>{selected.serve}</p><h3>Note</h3><p>{selected.note}</p>
      <div className="modal-actions"><button className="secondary" onClick={() => favorite(selected.id)}>{favorites.includes(selected.id) ? '★ Favorite' : '☆ Favorite'}</button><button className="primary" onClick={() => { setSelected(null); setTab('log') }}>Log a food</button></div>
    </div></div>}
  </div>
}

function LogFood(props) {
  const { addLog, setTab, child } = props
  const [foodId, setFoodId] = useState(foods[0].id)
  const [eatenAt, setEatenAt] = useState(new Date().toISOString().slice(0, 16))
  const [liked, setLiked] = useState('liked')
  const [reaction, setReaction] = useState('none')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addLog({ food_id: foodId, eaten_at: new Date(eatenAt).toISOString(), liked, reaction, amount, notes })
      setTab('home')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="page">
    <Header title="Log food" subtitle={`Add to ${child?.name}’s history`} onHome={() => setTab('home')} />
    <FamilyBar {...props} />
    <form className="form-card" onSubmit={submit}>
      <label>Food<select value={foodId} onChange={e => setFoodId(e.target.value)}>{foods.map(food => <option value={food.id} key={food.id}>{food.emoji} {food.name}</option>)}</select></label>
      <label>Date & time<input type="datetime-local" value={eatenAt} onChange={e => setEatenAt(e.target.value)} /></label>
      <fieldset><legend>How did it go?</legend><div className="segmented">{['liked', 'neutral', 'disliked'].map(item => <button type="button" key={item} className={liked === item ? 'active' : ''} onClick={() => setLiked(item)}>{item}</button>)}</div></fieldset>
      <label>Reaction<select value={reaction} onChange={e => setReaction(e.target.value)}><option value="none">No reaction</option><option value="possible">Possible reaction</option><option value="mild">Mild reaction</option><option value="significant">Significant reaction</option></select></label>
      {reaction !== 'none' && <div className="reaction-note"><b>For tracking only.</b> If symptoms could represent an allergic reaction, follow your child’s medical plan and seek appropriate medical care.</div>}
      <label>Amount / description<input placeholder="e.g. 3 spoonfuls" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Notes<textarea rows="4" placeholder="Texture, preparation, symptoms, what worked…" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <button className="primary big" disabled={saving}>{saving ? 'Saving…' : 'Save food log'}</button>
    </form>
  </div>
}

function Progress(props) {
  const { logs, removeLog, child, memberNames } = props
  const triedIds = [...new Set(logs.map(log => log.food_id))]
  const introduced = ALLERGENS.map(allergen => {
    const matching = logs.filter(log => foodFor(log.food_id)?.allergens.includes(allergen))
    return { allergen, count: matching.length, last: matching[0]?.eaten_at }
  })

  async function remove(id) {
    if (!confirm('Remove this food log?')) return
    try { await removeLog(id) } catch (err) { alert(err.message) }
  }

  return <div className="page">
    <Header title="Progress" subtitle={`${triedIds.length} unique foods tried by ${child?.name}`} onHome={() => props.setTab('home')} />
    <FamilyBar {...props} />
    <section className="progress-card"><div className="progress-top"><b>{triedIds.length} / 100 foods</b><span>{Math.min(triedIds.length, 100)}%</span></div><div className="bar"><i style={{ width: `${Math.min(triedIds.length, 100)}%` }} /></div></section>
    <h2>Allergen tracker</h2><div className="allergen-list">{introduced.map(item => <div className="allergen-row" key={item.allergen}><span className={item.count ? 'status-dot on' : 'status-dot'} /><div><b>{item.allergen}</b><small>{item.count ? `${item.count} exposure${item.count === 1 ? '' : 's'} • last ${new Date(item.last).toLocaleDateString()}` : 'Not logged yet'}</small></div></div>)}</div>
    <h2>History</h2><div className="card-list">{logs.length === 0 ? <Empty text="Food history will appear here." /> : logs.map(log => <LogRow key={log.id} log={log} memberNames={memberNames} removable onRemove={() => remove(log.id)} />)}</div>
  </div>
}

function Settings(props) {
  const {
    session, profile, saveProfile, household, householdId, households, setHouseholdId,
    members, children, child, childId, setChildId, createChild, updateChild,
    updateHouseholdName, regenerateInviteCode, removeHouseholdMember, leaveHousehold, refreshAll, syncing, setTab
  } = props
  const [profileName, setProfileName] = useState(profile?.display_name || '')
  const [householdName, setHouseholdName] = useState(household?.name || '')
  const [childDraft, setChildDraft] = useState({ name: child?.name || '', birth_date: child?.birth_date || '' })
  const [newChild, setNewChild] = useState({ name: '', birth_date: '' })
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => setProfileName(profile?.display_name || ''), [profile?.display_name])
  useEffect(() => setHouseholdName(household?.name || ''), [household?.id, household?.name])
  useEffect(() => setChildDraft({ name: child?.name || '', birth_date: child?.birth_date || '' }), [child?.id, child?.name, child?.birth_date])

  async function run(key, fn) {
    setBusy(key)
    try { await fn() } catch (err) { alert(err.message) } finally { setBusy('') }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return <div className="page">
    <Header title="Settings" subtitle={`${household?.name} • ${syncing ? 'syncing…' : 'cloud sync on'}`} onHome={() => setTab('home')} />
    <FamilyBar {...props} />

    <section className="settings-card">
      <h2>Your account</h2>
      <div className="account-row">
        <Avatar profile={profile} />
        <div><b>{profile?.display_name}</b><small>{session.user.email}</small><small>Signed in with {session.user.app_metadata?.provider === 'google' ? 'Google' : 'email/password'}</small></div>
      </div>
      <label className="settings-label">Display name<input value={profileName} onChange={e => setProfileName(e.target.value)} /></label>
      <button className="secondary" disabled={busy === 'profile'} onClick={() => run('profile', () => saveProfile({ display_name: profileName }))}>{busy === 'profile' ? 'Saving…' : 'Save your name'}</button>
    </section>

    <section className="settings-card">
      <h2>Household</h2>
      {households.length > 1 && <label className="settings-label">Active household<select value={householdId} onChange={e => setHouseholdId(e.target.value)}>{households.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label className="settings-label">Household name<input value={householdName} onChange={e => setHouseholdName(e.target.value)} disabled={household?.role !== 'owner'} /></label>
      {household?.role === 'owner' && <button className="secondary" disabled={busy === 'household'} onClick={() => run('household', () => updateHouseholdName(householdName))}>{busy === 'household' ? 'Saving…' : 'Save household name'}</button>}
      <div className="invite-box">
        <span>Invite code</span><b>{household?.invite_code}</b>
        <p>Another caregiver can create their own First Bites account, choose “Join a family,” and enter this code.</p>
        <div className="button-row"><button className="secondary" onClick={copyCode}>{copied ? 'Copied!' : 'Copy code'}</button>{household?.role === 'owner' && <button className="secondary" disabled={busy === 'invite'} onClick={() => run('invite', regenerateInviteCode)}>New code</button>}</div>
      </div>
    </section>

    <section className="settings-card">
      <h2>Family members</h2>
      <div className="member-list">{members.map(member => {
        const isYou = member.user_id === session.user.id
        const canRemove = household?.role === 'owner' && !isYou && member.role !== 'owner'
        return <div className="member-row" key={member.user_id}>
          <Avatar profile={member.profile} small />
          <div className="member-info"><b>{member.profile?.display_name || 'Family member'}{isYou ? ' (you)' : ''}</b><small>{member.role === 'owner' ? 'Household owner' : 'Member'}</small></div>
          {canRemove && <button className="member-remove" disabled={busy === `remove-${member.user_id}`} onClick={() => {
            const name = member.profile?.display_name || 'this family member'
            if (!confirm(`Remove ${name} from ${household.name}? They will immediately lose access to this household's children and food data.`)) return
            run(`remove-${member.user_id}`, () => removeHouseholdMember(member.user_id))
          }}>{busy === `remove-${member.user_id}` ? 'Removing…' : 'Remove'}</button>}
        </div>
      })}</div>
      {household?.role === 'member' && <button className="danger subtle-danger" disabled={busy === 'leave-household'} onClick={() => {
        if (!confirm(`Leave ${household.name}? You will lose access to this household's children and food data.`)) return
        run('leave-household', leaveHousehold)
      }}>{busy === 'leave-household' ? 'Leaving…' : 'Leave this family'}</button>}
      {household?.role === 'owner' && <p className="settings-help">As the household owner, you can remove other members. Owner transfer is not enabled yet, so the owner cannot leave the household.</p>}
    </section>

    <section className="settings-card">
      <h2>Children</h2>
      <div className="child-tabs">{children.map(item => <button key={item.id} className={item.id === childId ? 'active' : ''} onClick={() => setChildId(item.id)}>👶 {item.name}</button>)}</div>
      <div className="settings-subsection">
        <h3>Edit {child?.name}</h3>
        <label className="settings-label">Name<input value={childDraft.name} onChange={e => setChildDraft({ ...childDraft, name: e.target.value })} /></label>
        <label className="settings-label">Birth date<input type="date" value={childDraft.birth_date || ''} onChange={e => setChildDraft({ ...childDraft, birth_date: e.target.value })} /></label>
        <button className="secondary" disabled={busy === 'child'} onClick={() => run('child', () => updateChild(childId, childDraft))}>{busy === 'child' ? 'Saving…' : 'Save child'}</button>
      </div>
      <div className="settings-subsection add-child">
        <h3>Add another child</h3>
        <label className="settings-label">Name<input value={newChild.name} onChange={e => setNewChild({ ...newChild, name: e.target.value })} placeholder="Name" /></label>
        <label className="settings-label">Birth date <span className="optional">(optional)</span><input type="date" value={newChild.birth_date} onChange={e => setNewChild({ ...newChild, birth_date: e.target.value })} /></label>
        <button className="secondary" disabled={busy === 'new-child'} onClick={() => run('new-child', async () => { await createChild(newChild); setNewChild({ name: '', birth_date: '' }) })}>{busy === 'new-child' ? 'Adding…' : '+ Add child'}</button>
      </div>
    </section>

    <section className="settings-card"><h2>Sync</h2><p>Food history is shared with every member of this household. Each log records which signed-in caregiver added it.</p><button className="secondary" onClick={refreshAll} disabled={syncing}>{syncing ? 'Syncing…' : 'Refresh from cloud'}</button></section>
    <section className="settings-card"><h2>Install on Android</h2><p>After deployment, open First Bites in Chrome → menu (⋮) → <b>Install app</b> or <b>Add to Home screen</b>.</p></section>
    <button className="danger" onClick={() => supabase.auth.signOut()}>Sign out</button>
  </div>
}

function Avatar({ profile, small = false }) {
  const initials = (profile?.display_name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  if (profile?.avatar_url) return <img className={small ? 'avatar small' : 'avatar'} src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
  return <span className={small ? 'avatar fallback small' : 'avatar fallback'}>{initials}</span>
}

function LogRow({ log, memberNames, removable, onRemove }) {
  const food = foodFor(log.food_id)
  if (!food) return null
  const who = memberNames?.[log.logged_by]
  return <div className="log-row">
    <span className="log-emoji">{food.emoji}</span>
    <div><b>{food.name}</b><small>{new Date(log.eaten_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} • {log.liked || 'logged'}{who ? ` • by ${who}` : ''}{log.reaction && log.reaction !== 'none' ? ` • ${log.reaction} reaction` : ''}</small></div>
    {removable && <button className="icon-button" onClick={onRemove}>×</button>}
  </div>
}

function Empty({ text }) { return <div className="empty">{text}</div> }
function NavButton({ active, icon, label, onClick }) { return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}><span>{icon}</span><small>{label}</small></button> }
