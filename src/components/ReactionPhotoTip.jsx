import React from 'react'
import { hasMeaningfulReaction } from './ReactionHistory'

export default function ReactionPhotoTip({ reaction, symptoms, reactionSeverity }) {
  const syntheticLog = {
    reaction,
    symptoms,
    reaction_severity: reactionSeverity
  }

  if (!hasMeaningfulReaction(syntheticLog)) return null

  return (
    <div className="reaction-photo-tip" role="note">
      <div className="reaction-photo-tip-icon" aria-hidden="true">📷</div>
      <div>
        <strong>Consider taking a photo</strong>
        <p>
          A clear photo taken with your phone&apos;s normal camera can be useful to show
          your pediatrician, allergist, or other medical professional later.
        </p>
        <p className="reaction-photo-tip-privacy">
          First Bites does not upload or store the photo.
        </p>
        <p className="reaction-photo-tip-urgent">
          If symptoms are severe, involve trouble breathing or swelling, or are rapidly
          worsening, seek urgent medical care and don&apos;t delay care to take a photo.
        </p>
      </div>
    </div>
  )
}
