import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import RoleBadge from '../components/RoleBadge'

export default function TeamMembers({ businessSpaceId }) {
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('employee')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [memberError, setMemberError] = useState(null)

  useEffect(() => { if (businessSpaceId) { fetchMembers(); fetchInvites() } }, [businessSpaceId])

  async function fetchMembers() {
    const { data: memberRows } = await supabase
      .from('business_space_members')
      .select('id, user_id, role, display_name, created_at')
      .eq('business_space_id', businessSpaceId)
      .order('created_at', { ascending: true })
    if (!memberRows) return

    // Fall back to the person's global first name for anyone who hasn't
    // set a display name for this specific business yet.
    const { data: settingsRows } = await supabase
      .from('user_settings')
      .select('user_id, first_name')
      .in('user_id', memberRows.map(m => m.user_id))

    const firstNameByUser = Object.fromEntries((settingsRows || []).map(s => [s.user_id, s.first_name]))
    setMembers(memberRows.map(m => ({ ...m, display_name: m.display_name || firstNameByUser[m.user_id] })))
  }

  async function fetchInvites() {
    const { data } = await supabase
      .from('invites')
      .select('id, email, role, accepted, created_at')
      .eq('business_space_id', businessSpaceId)
      .eq('accepted', false)
      .order('created_at', { ascending: false })
    if (data) setInvites(data)
  }

  async function handleInvite() {
    if (!inviteEmail) return setInviteError('Enter an email address.')
    setInviting(true)
    setInviteError(null)
    setInviteSent(false)

    const { data: { session: currentSession } } = await supabase.auth.getSession()

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        businessSpaceId,
        invitedBy: currentSession.user.id,
      }),
    })

    const result = await res.json()
    if (import.meta.env.DEV) console.log('invite result:', result)

    if (result.error) {
      setInviteError(result.error.includes('unique') ? 'This email has already been invited.' : result.error)
      setInviting(false)
      return
    }

    setInviteSent(true)
    setInviteEmail('')
    setInviteRole('employee')
    setInviting(false)
    fetchInvites()
    if (result.alreadyMember) fetchMembers()
    setTimeout(() => setInviteSent(false), 3000)
  }

  async function handleRevokeInvite(inviteId) {
    await supabase.from('invites').delete().eq('id', inviteId)
    fetchInvites()
  }

  async function handleUpdateRole(userId, newRole) {
    const { error } = await supabase.rpc('update_member_role', {
      target_user_id: userId,
      target_business_space_id: businessSpaceId,
      new_role: newRole,
    })
    if (error) { setMemberError(error.message); return }
    setMemberError(null)
    fetchMembers()
  }

  async function handleRemoveMember(userId) {
    if (!window.confirm('Remove this member from the workspace?')) return
    const { error } = await supabase.rpc('remove_business_member', {
      target_user_id: userId,
      target_business_space_id: businessSpaceId,
    })
    if (error) { setMemberError(error.message); return }
    setMemberError(null)
    fetchMembers()
  }

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.md,
    outline: 'none',
    color: t.colors.textPrimary,
    fontFamily: t.fonts.sans,
  }

  return (
    <div style={{ padding: '32px', maxWidth: '640px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>
          Team members
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
          Invite staff and clients to your workspace
        </p>
      </div>

      <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden' }}>
        {/* Invite form */}
        <div style={{ padding: '24px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
              type="email"
              placeholder="teammate@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', backgroundColor: t.colors.bgCard }}
            >
              <option value="co-owner">Co-Owner</option>
              <option value="employee">Employee</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting}
              style={{
                padding: '10px 20px', borderRadius: t.radius.full, border: 'none',
                backgroundColor: inviteSent ? t.colors.success : t.colors.primary,
                color: t.colors.textInverse, fontSize: t.fontSizes.md,
                fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans,
                transition: 'background 0.2s', whiteSpace: 'nowrap',
              }}
            >
              {inviteSent ? '✓ Sent!' : inviting ? 'Sending...' : 'Send invite'}
            </button>
          </div>
          {inviteError && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
              {inviteError}
            </div>
          )}
        </div>

        {/* Current members */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textTertiary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Members ({members.length})
          </div>
          {memberError && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
              {memberError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: t.colors.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: t.colors.textTertiary, fontWeight: '600' }}>
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                    {m.display_name || 'No name set'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {m.role === 'owner' ? (
                    <RoleBadge role="owner" />
                  ) : (
                    <select
                      value={m.role}
                      onChange={e => handleUpdateRole(m.user_id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, fontFamily: t.fonts.sans, backgroundColor: t.colors.bgCard, cursor: 'pointer' }}
                    >
                      <option value="co-owner">Co-Owner</option>
                      <option value="employee">Employee</option>
                    </select>
                  )}
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: '16px', padding: '2px 6px', borderRadius: t.radius.full, lineHeight: 1 }}
                      title="Remove member"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textTertiary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Pending invites ({invites.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {invites.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: t.colors.bg, borderRadius: t.radius.md, border: `1px dashed ${t.colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>{inv.email}</div>
                    <RoleBadge role={inv.role} />
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: '16px', padding: '2px 6px', borderRadius: t.radius.full, lineHeight: 1 }}
                    title="Revoke invite"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
