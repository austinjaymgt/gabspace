import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

function timeAgo(dateString) {
  if (!dateString) return ''
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

const feedTypes = {
  client: { color: '#0D9373', bg: '#E8F7F3', icon: '👥', label: 'New client' },
  project: { color: '#4466cc', bg: '#f0f4ff', icon: '📋', label: 'New project' },
  invoice: { color: '#10B981', bg: '#f0faf6', icon: '💵', label: 'Invoice' },
  event: { color: '#F59E0B', bg: '#FEF3C7', icon: '📅', label: 'Event' },
  task: { color: '#8B5CF6', bg: '#F5F3FF', icon: '✅', label: 'Task' },
  vendor: { color: '#EC4899', bg: '#FDF2F8', icon: '🏪', label: 'New vendor' },
  portal: { color: '#06B6D4', bg: '#ECFEFF', icon: '🔗', label: 'Portal update' },
}

const platformColors = {
  'Instagram': '#E1306C',
  'TikTok': '#000000',
  'Facebook': '#1877F2',
  'LinkedIn': '#0A66C2',
  'Email': '#FF6B35',
  'YouTube': '#FF0000',
  'Google Ads': '#4285F4',
  'Other': '#888',
}

function FeedCard({ item }) {
  const type = feedTypes[item.type] || feedTypes.client
  return (
    <div style={{
      display: 'flex',
      gap: '14px',
      padding: '16px 0',
      borderBottom: `1px solid ${t.colors.borderLight}`,
      fontFamily: t.fonts.sans,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: type.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0,
        }}>
          {type.icon}
        </div>
        <div style={{
          width: '1px',
          flex: 1,
          backgroundColor: t.colors.borderLight,
          marginTop: '6px',
        }} />
      </div>

      <div style={{ flex: 1, paddingBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '6px',
        }}>
          <div style={{
            fontSize: t.fontSizes.xs,
            fontWeight: '600',
            color: type.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {type.label}
          </div>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
            {timeAgo(item.created_at)}
          </div>
        </div>
        <div style={{
          fontSize: t.fontSizes.md,
          fontWeight: '600',
          color: t.colors.textPrimary,
          marginBottom: '4px',
          lineHeight: '1.3',
        }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{
            fontSize: t.fontSizes.base,
            color: t.colors.textSecondary,
            lineHeight: '1.5',
          }}>
            {item.subtitle}
          </div>
        )}
        {item.meta && (
          <div style={{
            marginTop: '8px',
            padding: '6px 12px',
            backgroundColor: type.bg,
            borderRadius: t.radius.md,
            fontSize: t.fontSizes.sm,
            color: type.color,
            fontWeight: '500',
            display: 'inline-block',
          }}>
            {item.meta}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ session }) {
  const [stats, setStats] = useState({
    activeClients: 0,
    totalClients: 0,
    activeProjects: 0,
    upcomingEvents: [],
    income: 0,
    totalExpenses: 0,
    revenue: 0,
    outstanding: 0,
    activeCampaigns: [],
  })
  const [feed, setFeed] = useState([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
  fetchStats()
  fetchFeed()
  fetchSettings()
}, [])
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

async function fetchSettings() {
  if (!session) return
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle()
  setSettings(data)
}
  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0]
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      { count: activeClients },
      { count: totalClients },
      { data: upcomingEvents },
      { count: activeProjects },
      { data: invoices },
      { data: expenses },
      { data: activeCampaigns },
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('name, event_date, venue, status').gte('event_date', today).lte('event_date', nextMonth).order('event_date', { ascending: true }).limit(3),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('invoices').select('amount_paid, total_amount, status'),
      supabase.from('expenses').select('amount'),
      supabase.from('campaigns').select('name, status, budget, spend, platform').eq('status', 'active').limit(3),
    ])

    const income = invoices?.reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || 0), 0) || 0
    const totalExpenses = expenses?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0
    const outstanding = invoices?.reduce((sum, inv) => sum + ((parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)), 0) || 0

    setStats({
      activeClients: activeClients || 0,
      totalClients: totalClients || 0,
      activeProjects: activeProjects || 0,
      upcomingEvents: upcomingEvents || [],
      income,
      totalExpenses,
      revenue: income - totalExpenses,
      outstanding,
      activeCampaigns: activeCampaigns || [],
    })
  }

  async function fetchFeed() {
    setLoadingFeed(true)
    const [
      { data: clients },
      { data: projects },
      { data: invoices },
      { data: events },
      { data: tasks },
      { data: vendors },
      { data: portalUpdates },
    ] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('invoices').select('*, clients(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('events').select('*, projects(title)').order('created_at', { ascending: false }).limit(5),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('vendors').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('portal_updates').select('*, clients(name)').order('created_at', { ascending: false }).limit(5),
    ])

    const feedItems = [
      ...(clients || []).map(c => ({
        type: 'client',
        title: c.name,
        subtitle: c.company ? `from ${c.company}` : 'New client added',
        meta: c.email || null,
        created_at: c.created_at,
        id: `client-${c.id}`,
      })),
      ...(projects || []).map(p => ({
        type: 'project',
        title: p.title,
        subtitle: p.clients?.name ? `for ${p.clients.name}` : 'New project created',
        meta: p.status,
        created_at: p.created_at,
        id: `project-${p.id}`,
      })),
      ...(invoices || []).map(inv => ({
        type: 'invoice',
        title: inv.invoice_number || 'Invoice',
        subtitle: inv.clients?.name ? `billed to ${inv.clients.name}` : null,
        meta: `$${parseFloat(inv.total_amount || 0).toLocaleString()} · ${inv.status}`,
        created_at: inv.created_at,
        id: `invoice-${inv.id}`,
      })),
      ...(events || []).map(e => ({
        type: 'event',
        title: e.name,
        subtitle: e.projects?.title ? `part of ${e.projects.title}` : null,
        meta: e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
        created_at: e.created_at,
        id: `event-${e.id}`,
      })),
      ...(tasks || []).map(task => ({
        type: 'task',
        title: task.title,
        subtitle: task.status === 'done' ? 'Completed' : `Status: ${task.status}`,
        meta: task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString()}` : null,
        created_at: task.created_at,
        id: `task-${task.id}`,
      })),
      ...(vendors || []).map(v => ({
        type: 'vendor',
        title: v.name,
        subtitle: v.category || 'New vendor added',
        meta: v.rate ? `$${parseFloat(v.rate).toLocaleString()}` : null,
        created_at: v.created_at,
        id: `vendor-${v.id}`,
      })),
      ...(portalUpdates || []).map(u => ({
        type: 'portal',
        title: u.title || 'Portal update',
        subtitle: u.clients?.name ? `sent to ${u.clients.name}` : null,
        meta: u.message?.substring(0, 80) + (u.message?.length > 80 ? '...' : ''),
        created_at: u.created_at,
        id: `portal-${u.id}`,
      })),
    ]

    feedItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setFeed(feedItems)
    setLoadingFeed(false)
  }

  return (
  <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{
        fontSize: '26px',
        fontWeight: '700',
        color: t.colors.textPrimary,
        margin: '0 0 4px',
        letterSpacing: '-0.5px',
      }}>
        {getGreeting()}, {settings?.first_name || session?.user?.email?.split('@')[0]} 👋
      </h2>
      <p style={{
        fontSize: t.fontSizes.base,
        color: t.colors.textTertiary,
        margin: 0,
      }}>
        Here's what's happening with your business today.
      </p>
    </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>

        {/* Active Clients */}
        <div style={{
          backgroundColor: t.colors.bgCard,
          borderRadius: t.radius.lg,
          padding: '24px',
          border: `1px solid ${t.colors.borderLight}`,
          borderTop: `3px solid ${t.colors.primary}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontWeight: '500', marginBottom: '4px' }}>Active Clients</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: t.colors.primary, letterSpacing: '-1px' }}>
                {stats.activeClients}
              </div>
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: t.radius.lg,
              backgroundColor: t.colors.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>👥</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1, height: '4px', backgroundColor: t.colors.borderLight, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${stats.totalClients > 0 ? (stats.activeClients / stats.totalClients) * 100 : 0}%`,
                backgroundColor: t.colors.primary,
                borderRadius: '2px',
              }} />
            </div>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
              {stats.totalClients} total
            </span>
          </div>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
            {stats.activeProjects} active project{stats.activeProjects !== 1 ? 's' : ''} across all clients
          </div>
        </div>

        {/* Upcoming Events */}
        <div style={{
          backgroundColor: t.colors.bgCard,
          borderRadius: t.radius.lg,
          padding: '24px',
          border: `1px solid ${t.colors.borderLight}`,
          borderTop: '3px solid #F59E0B',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontWeight: '500', marginBottom: '4px' }}>Upcoming Events</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#F59E0B', letterSpacing: '-1px' }}>
                {stats.upcomingEvents?.length || 0}
              </div>
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: t.radius.lg,
              backgroundColor: '#FEF3C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>📅</div>
          </div>
          {stats.upcomingEvents?.length === 0 ? (
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No events in the next 30 days</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.upcomingEvents.map((event, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  backgroundColor: '#FEF3C7',
                  borderRadius: t.radius.md,
                }}>
                  <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: '#92400E' }}>{event.name}</span>
                  <span style={{ fontSize: t.fontSizes.xs, color: '#B45309' }}>
                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Finance Snapshot */}
        <div style={{
          backgroundColor: t.colors.bgCard,
          borderRadius: t.radius.lg,
          padding: '24px',
          border: `1px solid ${t.colors.borderLight}`,
          borderTop: '3px solid #10B981',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontWeight: '500', marginBottom: '4px' }}>Finance Snapshot</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#10B981', letterSpacing: '-1px' }}>
                ${(stats.revenue || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>net revenue</div>
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: t.radius.lg,
              backgroundColor: '#D1FAE5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>💵</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#D1FAE5', borderRadius: t.radius.md }}>
              <span style={{ fontSize: t.fontSizes.sm, color: '#065F46', fontWeight: '500' }}>Income</span>
              <span style={{ fontSize: t.fontSizes.sm, color: '#065F46', fontWeight: '700' }}>${(stats.income || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#FEE2E2', borderRadius: t.radius.md }}>
              <span style={{ fontSize: t.fontSizes.sm, color: '#991B1B', fontWeight: '500' }}>Expenses</span>
              <span style={{ fontSize: t.fontSizes.sm, color: '#991B1B', fontWeight: '700' }}>${(stats.totalExpenses || 0).toLocaleString()}</span>
            </div>
            {stats.outstanding > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#FEF3C7', borderRadius: t.radius.md }}>
                <span style={{ fontSize: t.fontSizes.sm, color: '#92400E', fontWeight: '500' }}>Outstanding</span>
                <span style={{ fontSize: t.fontSizes.sm, color: '#92400E', fontWeight: '700' }}>${(stats.outstanding || 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Campaigns */}
        <div style={{
          backgroundColor: t.colors.bgCard,
          borderRadius: t.radius.lg,
          padding: '24px',
          border: `1px solid ${t.colors.borderLight}`,
          borderTop: '3px solid #8B5CF6',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontWeight: '500', marginBottom: '4px' }}>Active Campaigns</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#8B5CF6', letterSpacing: '-1px' }}>
                {stats.activeCampaigns?.length || 0}
              </div>
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: t.radius.lg,
              backgroundColor: '#F5F3FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>📣</div>
          </div>
          {stats.activeCampaigns?.length === 0 ? (
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No active campaigns right now</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.activeCampaigns.map((campaign, i) => {
                const budget = parseFloat(campaign.budget) || 0
                const spend = parseFloat(campaign.spend) || 0
                const pct = budget > 0 ? Math.min((spend / budget) * 100, 100) : 0
                return (
                  <div key={i} style={{ padding: '8px 10px', backgroundColor: '#F5F3FF', borderRadius: t.radius.md }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: '#4C1D95' }}>{campaign.name}</span>
                      {campaign.platform && (
                        <span style={{ fontSize: t.fontSizes.xs, color: platformColors[campaign.platform] || '#888', fontWeight: '600' }}>
                          {campaign.platform}
                        </span>
                      )}
                    </div>
                    {budget > 0 && (
                      <>
                        <div style={{ height: '3px', backgroundColor: '#DDD6FE', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: pct > 90 ? '#EF4444' : '#8B5CF6',
                            borderRadius: '2px',
                          }} />
                        </div>
                        <div style={{ fontSize: t.fontSizes.xs, color: '#6D28D9', marginTop: '3px' }}>
                          ${spend.toLocaleString()} of ${budget.toLocaleString()}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{
        backgroundColor: t.colors.bgCard,
        borderRadius: t.radius.lg,
        border: `1px solid ${t.colors.borderLight}`,
        padding: '24px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}>
          <h2 style={{
            fontSize: t.fontSizes.lg,
            fontWeight: '700',
            color: t.colors.textPrimary,
            margin: 0,
          }}>
            Recent Activity
          </h2>
          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
            {feed.length} updates
          </span>
        </div>
        <p style={{
          fontSize: t.fontSizes.sm,
          color: t.colors.textTertiary,
          margin: '0 0 20px',
        }}>
          Everything happening across your business
        </p>

        {loadingFeed ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>
            Loading activity...
          </div>
        ) : feed.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
            <div style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '4px' }}>
              Your feed is empty
            </div>
            <div style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>
              Start by adding a client or project
            </div>
          </div>
        ) : (
          <div>
            {feed.map(item => (
              <FeedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}