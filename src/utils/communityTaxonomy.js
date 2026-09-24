// The fixed tag + category lists for the Community layer (directory
// listings, collab requests, and tag alerts). Edit freely — this is the
// single source of truth for the UI.
//
// Rules the database enforces (see 20260924000000_community_layer.sql):
//   - `key` must be a lowercase slug: letters, numbers, hyphens, max 40 chars
//   - at most 8 tags per listing / request
// Keys are what get stored, so renaming a key orphans existing rows that
// use it — change `label` instead if you just want different wording.
// Tag and category keys share one namespace for tag alerts, so keep them
// distinct from each other.

// Specialties — order doesn't matter here; they're shown A→Z with "Other"
// pinned last (see COMMUNITY_TAGS below).
const SPECIALTIES = [
  { key: 'photography', label: 'Photography' },
  { key: 'videography', label: 'Videography' },
  { key: 'graphic-design', label: 'Graphic Design' },
  { key: 'branding', label: 'Branding' },
  { key: 'web-design', label: 'Web Design' },
  { key: 'illustration', label: 'Illustration' },
  { key: 'copywriting', label: 'Copywriting' },
  { key: 'social-media', label: 'Social Media' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'pr', label: 'PR' },
  { key: 'event-planning', label: 'Event Planning' },
  { key: 'floral', label: 'Floral' },
  { key: 'styling', label: 'Styling' },
  { key: 'hair-makeup', label: 'Hair & Makeup' },
  { key: 'catering', label: 'Catering' },
  { key: 'music-dj', label: 'Music & DJ' },
  { key: 'venue', label: 'Venue' },
  { key: 'print-merch', label: 'Print & Merch' },
  { key: 'workshops', label: 'Workshops' },
  { key: 'consulting', label: 'Consulting' },
]

// "Other" is for creatives who don't fit a listed specialty — a plain tag
// (no free text) so listings and filters stay clean.
const OTHER_TAG = { key: 'other', label: 'Other' }

export const COMMUNITY_TAGS = [
  ...[...SPECIALTIES].sort((a, b) => a.label.localeCompare(b.label)),
  OTHER_TAG,
]

// Board request categories — shown A→Z (see COLLAB_CATEGORIES below).
// "Collaboration" is the catch-all, so there's no "Other" here.
const CATEGORIES = [
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'subcontract', label: 'Subcontract / Hire' },
  { key: 'referral', label: 'Referral' },
  { key: 'styled-shoot', label: 'Styled Shoot' },
  { key: 'event-partnership', label: 'Event Partnership' },
  { key: 'workshop-cohost', label: 'Workshop Co-host' },
  { key: 'space-share', label: 'Space Share' },
  { key: 'gear', label: 'Gear / Equipment' },
  { key: 'content-swap', label: 'Content Swap' },
]

export const COLLAB_CATEGORIES = [...CATEGORIES].sort((a, b) => a.label.localeCompare(b.label))

export const MAX_TAGS = 8
export const PITCH_MAX = 280
export const NOTE_MAX = 1000
export const REQUEST_DEFAULT_DAYS = 30
export const REQUEST_MAX_DAYS = 90

const tagLabels = Object.fromEntries(COMMUNITY_TAGS.map(t => [t.key, t.label]))
const categoryLabels = Object.fromEntries(COLLAB_CATEGORIES.map(c => [c.key, c.label]))

// Falls back to the raw key so a tag removed from this list still renders
// on older rows instead of disappearing.
export function tagLabel(key) {
  return tagLabels[key] || key
}

export function categoryLabel(key) {
  return categoryLabels[key] || key
}

// Tag alerts can match either a request's category or one of its tags.
export function subscriptionLabel(key) {
  return categoryLabels[key] || tagLabels[key] || key
}
