import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import Toggle from '../components/Toggle'

const PLAN_LABELS = { free: 'Free', duo: 'Duo', studio: 'Studio', enterprise: 'Enterprise', founding: 'Founders Circle' }

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminPanel() {
  const [settings, setSettings] = useState(null)
  const [waitlist, setWaitlist] = useState([])
  const [users, setUsers] = useState([])
  const [capInput, setCapInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingToggle, setSavingToggle] = useState(false)
  const [savingCap, setSavingCap] = useState(false)
  const [savingPlanFor, setSavingPlanFor] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [settingsRes, waitlistRes, usersRes] = await Promise.all([
      supabase.from('platform_settings').select('*').single(),
      supabase.from('waitlist').select('id, email, created_at').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_users'),
    ])
    if (settingsRes.data) {
      setSettings(settingsRes.data)
      setCapInput(settingsRes.data.founding_member_cap ?? '')
    }
    setWaitlist(waitlistRes.data || [])
    setUsers(usersRes.data || [])
    setLoading(false)
  }

  async function handleToggleSignups() {
    if (!settings) return
    setSavingToggle(true)
    setError(null)
    const nextValue = !settings.signups_open
    const { error: toggleError } = await supabase
      .from('platform_settings')
      .update({ signups_open: nextValue, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (toggleError) setError(toggleError.message)
    else setSettings(prev => ({ ...prev, signups_open: nextValue }))
    setSavingToggle(false)
  }

  async function handleSaveCap() {
    setSavingCap(true)
    setError(null)
    const capValue = capInput === '' ? null : parseInt(capInput, 10)
    const { error: capError } = await supabase
      .from('platform_settings')
      .update({ founding_member_cap: capValue, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (capError) setError(capError.message)
    else setSettings(prev => ({ ...prev, founding_member_cap: capValue }))
    setSavingCap(false)
  }

  async function handlePlanChange(userId, newPlan) {
    setSavingPlanFor(userId)
    setError(null)
    const { error: planError } = await supabase.rpc('admin_set_user_plan', {
      target_user_id: userId,
      new_plan: newPlan,
    })
    if (planError) setError(planError.message)
    else setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, plan: newPlan } : u))
    setSavingPlanFor(null)
  }

  function exportWaitlist() {
    downloadCsv(
      `waitlist-${new Date().toISOString().slice(0, 10)}.csv`,
      [['email', 'captured_at'], ...waitlist.map(w => [w.email, w.created_at])]
    )
  }

  const foundingCount = users.filter(u => u.plan === 'founding').length

  const cardStyle = { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden', marginBottom: '24px' }
  const headerStyle = { padding: '20px 24px', borderBottom: `1px solid ${t.colors.borderLight}` }
  const titleStyle = { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 4px' }
  const descStyle = { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }

  if (loading) {
    return <div style={{ padding: '32px', fontFamily: t.fonts.sans, color: t.colors.textTertiary }}>Loading…</div>
  }

  return (
    <div style={{ padding: '32px', maxWidth: '720px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>Admin</h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>Platform-wide controls — not scoped to any one business.</p>
      </div>

      {error && (
        <div style={{ marginBottom: '20px', padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
          {error}
        </div>
      )}

      {/* ── Signups ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Signups</h3>
          <p style={descStyle}>Turn new self-service signups on or off. When off, the signup page shows a waitlist form instead.</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
              Signups are {settings?.signups_open ? 'open' : 'closed'}
            </div>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              {settings?.signups_open ? 'Anyone can create an account.' : 'New visitors are shown the waitlist form.'}
            </div>
          </div>
          <Toggle checked={!!settings?.signups_open} onChange={handleToggleSignups} disabled={savingToggle} />
        </div>
      </div>

      {/* ── Founding members ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Founding members</h3>
          <p style={descStyle}>Informational only — set a cap to know when to stop offering the founding tier, nothing blocks automatically.</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: settings?.founding_member_cap != null && foundingCount >= settings.founding_member_cap ? t.colors.warning : t.colors.textPrimary }}>
              {foundingCount}{settings?.founding_member_cap != null ? ` / ${settings.founding_member_cap}` : ''}
            </div>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>on the founding plan</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Cap (blank = uncapped)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                min="0"
                value={capInput}
                onChange={e => setCapInput(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, width: '120px' }}
              />
              <button
                onClick={handleSaveCap}
                disabled={savingCap}
                style={{ padding: '8px 16px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Waitlist ── */}
      <div style={cardStyle}>
        <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={titleStyle}>Waitlist ({waitlist.length})</h3>
            <p style={descStyle}>Captured while signups were closed.</p>
          </div>
          <button
            onClick={exportWaitlist}
            disabled={waitlist.length === 0}
            style={{ padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: waitlist.length === 0 ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans }}
          >
            Export CSV
          </button>
        </div>
        {waitlist.length > 0 && (
          <div style={{ padding: '8px 24px 20px', maxHeight: '320px', overflowY: 'auto' }}>
            {waitlist.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm }}>
                <span style={{ color: t.colors.textPrimary }}>{w.email}</span>
                <span style={{ color: t.colors.textTertiary }}>{new Date(w.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Users ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Users ({users.length})</h3>
          <p style={descStyle}>Everyone with an account, across every business.</p>
        </div>
        <div style={{ padding: '8px 24px 20px', maxHeight: '420px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', padding: '8px 0', fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Email</span>
            <span>Signed up</span>
            <span>Confirmed</span>
            <span>Plan</span>
          </div>
          {users.map(u => (
            <div key={u.user_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', padding: '10px 0', borderTop: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm }}>
              <span style={{ color: t.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
              <span style={{ color: t.colors.textTertiary }}>{new Date(u.created_at).toLocaleDateString()}</span>
              <span style={{ color: u.confirmed ? t.colors.success : t.colors.textTertiary }}>{u.confirmed ? 'Yes' : 'No'}</span>
              <select
                value={u.plan || ''}
                onChange={e => handlePlanChange(u.user_id, e.target.value)}
                disabled={savingPlanFor === u.user_id}
                style={{ padding: '4px 8px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, fontFamily: t.fonts.sans, backgroundColor: t.colors.bgCard, cursor: savingPlanFor === u.user_id ? 'not-allowed' : 'pointer' }}
              >
                {Object.entries(PLAN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
