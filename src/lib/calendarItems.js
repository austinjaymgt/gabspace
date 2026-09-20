import { supabase } from '../supabaseClient'

// Shared across the Dashboard agenda teaser and the full Calendar page —
// both aggregate the same five date-bearing sources across the business.
export const CALENDAR_TYPE_META = {
  task:      { label: 'Task',      icon: 'task',      color: '#6B8F71', bg: '#EAF2EA', page: 'tasks' },
  milestone: { label: 'Milestone', icon: 'deadline',   color: '#3E6FB1', bg: '#E8EFF8', page: 'projects' },
  event:     { label: 'Event',     icon: 'events',     color: '#D4874E', bg: '#FBF0E6', page: 'business-events' },
  content:   { label: 'Content',   icon: 'campaigns',  color: '#A34FA0', bg: '#F6EAF5', page: 'campaign-tracking' },
  goal:      { label: 'Goal',      icon: 'team-goals', color: '#B18A3E', bg: '#F8F1E4', page: 'team-goals' },
}

// start/end are 'YYYY-MM-DD' strings, inclusive on both ends.
export async function fetchCalendarItems(businessSpaceId, start, end) {
  if (!businessSpaceId) return []
  const inRange = (col) => (q) => q.gte(col, start).lte(col, end)

  const [tasksRes, milestonesRes, eventsRes, contentRes, goalsRes] = await Promise.all([
    inRange('due_date')(supabase.from('tasks').select('id, title, due_date, status').eq('business_space_id', businessSpaceId).not('due_date', 'is', null)),
    inRange('target_date')(supabase.from('project_milestones').select('id, title, target_date, status').eq('business_space_id', businessSpaceId).not('target_date', 'is', null)),
    inRange('date')(supabase.from('business_events').select('id, name, date, status').eq('business_space_id', businessSpaceId).not('date', 'is', null)),
    inRange('scheduled_date')(supabase.from('content_calendar').select('id, title, scheduled_date, status').eq('business_space_id', businessSpaceId).not('scheduled_date', 'is', null)),
    inRange('due_date')(supabase.from('team_goals').select('id, title, due_date, status').eq('business_space_id', businessSpaceId).not('due_date', 'is', null)),
  ])

  const items = [
    ...(tasksRes.data || []).map(r => ({ id: `task-${r.id}`, type: 'task', title: r.title, date: r.due_date, done: r.status === 'done' })),
    ...(milestonesRes.data || []).map(r => ({ id: `milestone-${r.id}`, type: 'milestone', title: r.title, date: r.target_date, done: r.status === 'done' })),
    ...(eventsRes.data || []).map(r => ({ id: `event-${r.id}`, type: 'event', title: r.name, date: r.date, done: r.status === 'completed' })),
    ...(contentRes.data || []).map(r => ({ id: `content-${r.id}`, type: 'content', title: r.title, date: r.scheduled_date, done: r.status === 'published' })),
    ...(goalsRes.data || []).map(r => ({ id: `goal-${r.id}`, type: 'goal', title: r.title, date: r.due_date, done: r.status === 'completed' })),
  ]
  items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  return items
}
