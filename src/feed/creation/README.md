# Feed creation previews

The three supplied reference layouts are rebuilt as React controls: the compact
post composer, post-settings bottom sheet and independent event form/review.
No reference screenshot is imported or used as a background.

## Current scope

Backend setup was cancelled. This feature intentionally uses React state only.
Post, event and scheduled-post previews are labelled as local/unpublished.
Attachments use temporary blob URLs that are revoked when their media components
unmount. Nothing is uploaded, published, delivered, scheduled on a server or saved
across reloads. No credentials or extra dependencies are required.

- Create a Post and all three Feed attachment controls open the post workflow.
- The four-option menu keeps Post, Event, Opportunity and Article independent.
- Post settings retain audience, comment permissions, collaborators and partnership
  disclosure in the draft. Collaborator selection sends no invitations.
- The schedule picker validates a future local-device time. It creates a preview
  only; no timer/background publication is installed.
- Improve your post provides writing tips and an explicitly labelled local
  spacing-cleanup tool, not simulated AI generation.
- Cover uploads accept JPG/PNG/WebP up to 5 MB and require width >= 480 pixels.
- Event dates are interpreted in the selected IANA timezone, including rejection
  of nonexistent DST times. End must be after start; start must be in the future.
- Next opens review, never publishes. Review can return to the form without losing
  entered values. Adding a preview shows it only in this mounted Feed.
- Drafts survive closing/reopening creation options while remaining in Feed.
  Navigating away from Feed or reloading clears them and their previews.
- Opportunity and Article each have a separate destination, but intentionally no
  detailed form until their reference images are supplied.
- The existing five-destination navigation is not redesigned. It is hidden while
  a creation workflow is open, then restored when returning to Feed.

## Production integration still required

Replace the preview callbacks with authenticated server operations before claiming
publication. Enforce recipient/audience permissions, comment rules, collaborator
consent, partnership disclosures, attachment type/content/size checks and storage
on the server. Real scheduling requires a durable job queue, cancellation and a
server clock. Generate saved IDs server-side and acknowledge success only after
the record/media/job is genuinely committed. Do not treat the local preview ID,
draft configuration or sample member list as authoritative production data.
