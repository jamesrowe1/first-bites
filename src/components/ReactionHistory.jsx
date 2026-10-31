import React from 'react'

const NONE_VALUES = new Set([
  '',
  'none',
  'no',
  'no reaction',
  'no_reaction',
  'false',
  '0',
  'null',
  'undefined'
])

export function hasMeaningfulReaction(log) {
  if (!log) return false

  if (log.had_reaction === true || log.reaction === true) return true

  const candidates = [
    log.reaction,
    log.reaction_level,
    log.reaction_severity,
    log.severity
  ]

  for (const candidate of candidates) {
    if (candidate == null) continue
    const normalized = String(candidate).trim().toLowerCase()
    if (!NONE_VALUES.has(normalized)) return true
  }

  const symptoms = log.reaction_symptoms ?? log.symptoms
  if (Array.isArray(symptoms) && symptoms.length > 0) return true
  if (typeof symptoms === 'string' && symptoms.trim()) return true

  return false
}

function foodNameForLog(log, foods) {
  if (log.food?.name) return log.food.name
  if (log.food_name) return log.food_name

  const id = log.food_id ?? log.foodId
  const match = foods?.find(food => String(food.id) === String(id))
  return match?.name ?? 'Food'
}

function reactionLabel(log) {
  const raw =
    log.reaction_severity ??
    log.reaction_level ??
    log.reaction ??
    log.severity ??
    'Reaction recorded'

  if (raw === true) return 'Reaction recorded'

  const text = String(raw).trim()
  if (!text || NONE_VALUES.has(text.toLowerCase())) return 'Reaction recorded'

  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function symptomsLabel(log) {
  const symptoms = log.reaction_symptoms ?? log.symptoms
  if (Array.isArray(symptoms)) return symptoms.filter(Boolean).join(', ')
  return typeof symptoms === 'string' ? symptoms.trim() : ''
}

function reactionNotes(log) {
  return (
    log.reaction_notes ??
    log.reaction_note ??
    log.notes ??
    ''
  )
}

function logDate(log) {
  const raw =
    log.logged_at ??
    log.occurred_at ??
    log.exposure_at ??
    log.created_at ??
    log.date

  if (!raw) return ''

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed)
}

export default function ReactionHistory({ logs = [], foods = [] }) {
  const reactionLogs = logs
    .filter(hasMeaningfulReaction)
    .sort((a, b) => {
      const aDate = new Date(a.logged_at ?? a.occurred_at ?? a.created_at ?? 0)
      const bDate = new Date(b.logged_at ?? b.occurred_at ?? b.created_at ?? 0)
      return bDate - aDate
    })

  const affectedFoods = new Set(
    reactionLogs.map(log => String(log.food_id ?? log.foodId ?? foodNameForLog(log, foods)))
  ).size

  return (
    <section className="reaction-history-section">
      <div className="reaction-history-heading">
        <div>
          <p className="reaction-history-kicker">REACTIONS</p>
          <h2>Reaction history</h2>
        </div>
        <div className="reaction-history-count">
          {affectedFoods} {affectedFoods === 1 ? 'food' : 'foods'}
        </div>
      </div>

      {reactionLogs.length === 0 ? (
        <div className="reaction-history-empty">
          <strong>No reactions recorded</strong>
          <span>Foods with a recorded reaction will appear here for quick reference.</span>
        </div>
      ) : (
        <div className="reaction-history-list">
          {reactionLogs.map(log => {
            const symptoms = symptomsLabel(log)
            const notes = reactionNotes(log)
            const date = logDate(log)

            return (
              <article
                className="reaction-history-card"
                key={log.id ?? `${log.food_id}-${log.created_at ?? Math.random()}`}
              >
                <div className="reaction-history-card-top">
                  <div>
                    <strong>{foodNameForLog(log, foods)}</strong>
                    {date && <span>{date}</span>}
                  </div>
                  <span className="reaction-history-badge">{reactionLabel(log)}</span>
                </div>

                {symptoms && (
                  <div className="reaction-history-detail">
                    <span>Symptoms</span>
                    <strong>{symptoms}</strong>
                  </div>
                )}

                {notes && (
                  <div className="reaction-history-detail">
                    <span>Notes</span>
                    <p>{notes}</p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
