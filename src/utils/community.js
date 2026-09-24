import { supabase } from '../supabaseClient'
import { toThread, byLastActivity, normalizeWebsite, normalizeInstagram, formatCity } from './communityHelpers'

// Data access for the Community layer. Every select names its columns
// explicitly — the *_DISPLAY lists are what's safe to show anyone who can
// see the row (and what a future public view would expose); private/
// management columns are added separately only where the viewer owns the row.

export const LISTING_DISPLAY = 'business_space_id, display_name, pitch, tags, city, remote_ok, website, instagram, logo_url, slug'
const LISTING_PRIVATE = 'is_discoverable, visibility, updated_at'

export const REQUEST_DISPLAY = 'id, business_space_id, poster_display_name, title, description, category, tags, location, remote_ok, needed_by, status, expires_at, created_at'

const RESPONSE_FIELDS = 'id, request_id, responder_business_space_id, responder_display_name, note, status, created_at'

// ── Membership ──────────────────────────────────────────────────────────

// Businesses the signed-in user runs (owner/co-owner), with can_post per
// business. Empty for employees/clients.
export async function fetchMyCommunityBusinesses() {
  const { data, error } = await supabase.rpc('my_community_businesses')
  if (error) throw error
  return data || []
}

// ── Directory ───────────────────────────────────────────────────────────

export async function fetchDirectory() {
  const { data, error } = await supabase
    .from('business_listings')
    .select(LISTING_DISPLAY)
    .eq('is_discoverable', true)
    .order('display_name')
  if (error) throw error
  return data || []
}

export async function fetchListing(businessSpaceId) {
  const { data, error } = await supabase
    .from('business_listings')
    .select(LISTING_DISPLAY)
    .eq('business_space_id', businessSpaceId)
    .eq('is_discoverable', true)
    .maybeSingle()
  if (error) throw error
  return data
}

// Owner view — includes the private toggle fields.
export async function fetchMyListing(businessSpaceId) {
  const { data, error } = await supabase
    .from('business_listings')
    .select(`${LISTING_DISPLAY}, ${LISTING_PRIVATE}`)
    .eq('business_space_id', businessSpaceId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchBusinessBasics(businessSpaceId) {
  const { data, error } = await supabase.from('business_spaces').select('name, logo_url').eq('id', businessSpaceId).maybeSingle()
  if (error) throw error
  return data
}

export async function saveMyListing(businessSpaceId, fields) {
  const { data, error } = await supabase
    .from('business_listings')
    .upsert({
      business_space_id: businessSpaceId,
      is_discoverable: fields.is_discoverable,
      display_name: fields.display_name.trim(),
      pitch: fields.pitch?.trim() || null,
      tags: fields.tags || [],
      city: formatCity(fields.city),
      remote_ok: !!fields.remote_ok,
      website: normalizeWebsite(fields.website),
      instagram: normalizeInstagram(fields.instagram),
      logo_url: fields.logo_url || null,
    }, { onConflict: 'business_space_id' })
    .select(`${LISTING_DISPLAY}, ${LISTING_PRIVATE}`)
    .single()
  if (error) throw error
  return data
}

// ── Requests ────────────────────────────────────────────────────────────

// Open, non-expired requests. Expiry is a query filter for now — there's
// no job that flips expired requests to closed.
export async function fetchOpenRequests() {
  const { data, error } = await supabase
    .from('collab_requests')
    .select(REQUEST_DISPLAY)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchOpenRequestsForBusiness(businessSpaceId) {
  const { data, error } = await supabase
    .from('collab_requests')
    .select(REQUEST_DISPLAY)
    .eq('business_space_id', businessSpaceId)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchRequest(id) {
  const { data, error } = await supabase
    .from('collab_requests')
    .select(REQUEST_DISPLAY)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchRequestsPostedBy(businessSpaceIds) {
  if (!businessSpaceIds.length) return []
  const { data, error } = await supabase
    .from('collab_requests')
    .select(`${REQUEST_DISPLAY}, collab_responses(${RESPONSE_FIELDS})`)
    .in('business_space_id', businessSpaceIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createRequest(fields) {
  const { data, error } = await supabase
    .from('collab_requests')
    .insert({ ...fields, location: formatCity(fields.location) })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function setRequestStatus(id, status) {
  const { error } = await supabase.from('collab_requests').update({ status }).eq('id', id)
  if (error) throw error
}

// ── Responses ───────────────────────────────────────────────────────────

// RLS returns only responses the caller is a party to — for a request
// detail page that's "my business's response", if any.
export async function fetchMyResponses(requestId, businessSpaceIds) {
  if (!businessSpaceIds.length) return []
  const { data, error } = await supabase
    .from('collab_responses')
    .select(RESPONSE_FIELDS)
    .eq('request_id', requestId)
    .in('responder_business_space_id', businessSpaceIds)
  if (error) throw error
  return data || []
}

export async function createResponse({ requestId, businessSpaceId, note }) {
  const { error } = await supabase.from('collab_responses').insert({
    request_id: requestId,
    responder_business_space_id: businessSpaceId,
    note: note?.trim() || null,
  })
  if (error) throw error
}

export async function setResponseStatus(id, status) {
  const { error } = await supabase.from('collab_responses').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteResponse(id) {
  const { error } = await supabase.from('collab_responses').delete().eq('id', id)
  if (error) throw error
}

// Every response the caller's businesses have sent, with its request —
// the responder's view (My Collabs → Responded).
export async function fetchResponsesSentBy(businessSpaceIds) {
  if (!businessSpaceIds.length) return []
  const { data, error } = await supabase
    .from('collab_responses')
    .select(`${RESPONSE_FIELDS}, collab_requests(${REQUEST_DISPLAY})`)
    .in('responder_business_space_id', businessSpaceIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Messages ────────────────────────────────────────────────────────────

// One thread per accepted response the caller is a party to, from either
// side, newest activity first. Unread counts come from unread
// 'collab_message' notifications for that thread.
export async function fetchThreads(businessSpaceIds) {
  if (!businessSpaceIds.length) return []
  const select = `${RESPONSE_FIELDS}, collab_requests!inner(id, title, business_space_id, poster_display_name)`
  const [sent, received] = await Promise.all([
    supabase.from('collab_responses').select(select).eq('status', 'accepted').in('responder_business_space_id', businessSpaceIds),
    supabase.from('collab_responses').select(select).eq('status', 'accepted').in('collab_requests.business_space_id', businessSpaceIds),
  ])
  if (sent.error) throw sent.error
  if (received.error) throw received.error

  const byId = new Map()
  for (const r of [...(sent.data || []), ...(received.data || [])]) byId.set(r.id, r)
  const responses = [...byId.values()]
  if (!responses.length) return []

  const ids = responses.map(r => r.id)
  const [{ data: messages, error: mErr }, { data: unread, error: nErr }] = await Promise.all([
    supabase.from('collab_messages').select('response_id, body, sender_display_name, created_at').in('response_id', ids).order('created_at', { ascending: false }),
    supabase.from('notifications').select('target_id').eq('type', 'collab_message').is('read_at', null).in('target_id', ids),
  ])
  if (mErr) throw mErr
  if (nErr) throw nErr

  const lastByThread = {}
  for (const m of messages || []) lastByThread[m.response_id] ||= m
  const unreadByThread = {}
  for (const n of unread || []) unreadByThread[n.target_id] = (unreadByThread[n.target_id] || 0) + 1

  return responses.map(r => toThread(r, businessSpaceIds, lastByThread[r.id], unreadByThread[r.id] || 0)).sort(byLastActivity)
}

export async function fetchThreadMessages(responseId) {
  const { data, error } = await supabase
    .from('collab_messages')
    .select('id, response_id, sender_business_space_id, sender_display_name, body, created_at')
    .eq('response_id', responseId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function sendMessage({ responseId, businessSpaceId, body }) {
  const { error } = await supabase.from('collab_messages').insert({
    response_id: responseId,
    sender_business_space_id: businessSpaceId,
    body: body.trim(),
  })
  if (error) throw error
}

// Clears this thread's unread message notifications (and the orb badge).
export async function markThreadRead(responseId) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'collab_message')
    .eq('target_id', responseId)
    .is('read_at', null)
  window.dispatchEvent(new Event('community-notifications-changed'))
}

// ── Tag alerts ──────────────────────────────────────────────────────────

export async function fetchTagSubscriptions() {
  const { data, error } = await supabase.from('tag_subscriptions').select('tag')
  if (error) throw error
  return (data || []).map(r => r.tag)
}

export async function addTagSubscription(tag) {
  const { error } = await supabase.from('tag_subscriptions').insert({ tag })
  if (error) throw error
}

export async function removeTagSubscription(tag) {
  const { error } = await supabase.from('tag_subscriptions').delete().eq('tag', tag)
  if (error) throw error
}

// ── Notifications ───────────────────────────────────────────────────────

export async function fetchNotifications(limit = 10) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, target_page, target_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function countUnreadNotifications() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count || 0
}

export async function markNotificationRead(id) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
}

export async function markAllNotificationsRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}

// Postgres errors → something a person can act on.
export function friendlyError(err) {
  const msg = err?.message || ''
  if (err?.code === '23505') return "Your business has already responded to this request."
  if (err?.code === '42501' || msg.includes('row-level security')) return "You don't have permission to do that. Posting and responding require an active membership."
  return msg || 'Something went wrong — try again.'
}
