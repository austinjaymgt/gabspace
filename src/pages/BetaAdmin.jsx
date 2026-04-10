import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  approved: { label: 'Approved', bg: '#f0faf6', color: '#1D9E75', border: '#1D9E75' },
  rejected: { label: 'Rejected', bg: '#fff0f0', color: '#cc3333', border: '#cc3333' },
}

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

export default function BetaAdmin() {
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchApplicants()
  }, [])

  async function fetchApplicants() {
    setLoading(true)
    const { data } = await supabase
      .from('beta_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setApplicants(data)
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setUpdating(id)
    await supabase.from('beta_requests').update({ status }).eq('id', id)
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    setUpdating(null)
  }

  const counts = {
    all: applicants.length,
    pending: applicants.filter(a => a.status === 'pending').length,
    approved: applicants.filter(a => a.status === 'approved').length,
    rejected: applicants.filter(a => a.status === 'rejected').length,
  }

  const filtered = applicants
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.creative_type?.toLowerCase().includes(q)
      )
    })

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          Beta Applicants
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
          Review and manage access to the Gabspace beta.
        </p>
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: 'All',      color: t.colors.textPrimary, bg: '#f0f0eb' },
          { key: 'pending',  label: 'Pending',  color: '#92400E', bg: '#FEF3C7' },
          { key: 'approved', label: 'Approved', color: '#1D9E75', bg: '#f0faf6' },
          { key: 'rejected', label: 'Rejected', color: '#cc3333', bg: '#fff0f0' },
        ].map(({ key, label, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '8px 16px',
              borderRadius: '100px',
              border: filter === key ? `1.5px solid ${color}` : '1.5px solid transparent',
              backgroundColor: filter === key ? bg : '#f7f7f4',
              color: filter === key ? color : t.colors.textTertiary,
              fontSize: t.fontSizes.sm,
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {label}
            <span style={{
              backgroundColor: filter === key ? color : '#ddd',
              color: filter === key ? '#fff' : '#999',
              borderRadius: '100px',
              fontSize: '11px',
              fontWeight: '700',
              padding: '1px 7px',
              lineHeight: '18px',
            }}>
              {counts[key]}
            </span>
          </button>
        ))}

        {/* Search */}
        <div style={{ marginLeft: 'auto' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, type..."
            style={{
              padding: '8px 14px',
              borderRadius: '100px',
              border: `1px solid ${t.colors.borderLight}`,
              fontSize: t.fontSizes.sm,
              color: t.colors.textPrimary,
              outline: 'none',
              backgroundColor: '#fff',
              fontFamily: t.fonts.sans,
              width: '240px',
            }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>
          Loading applicants...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '4px' }}>No applicants found</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>
            {search ? 'Try a different search' : `No ${filter === 'all' ? '' : filter} applicants yet`}
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1.8fr 1fr 1fr 0.8fr 1fr',
            padding: '11px 20px',
            backgroundColor: '#fafaf8',
            borderBottom: '1px solid #f0f0eb',
            fontSize: '11px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            <span>Name</span>
            <span>Email</span>
            <span>Creative type</span>
            <span>How they heard</span>
            <span>Applied</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          {filtered.map(applicant => {
            const sc = STATUS_CONFIG[applicant.status] || STATUS_CONFIG.pending
            const isUpdating = updating === applicant.id
            return (
              <div
                key={applicant.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.8fr 1fr 1fr 0.8fr 1fr',
                  padding: '14px 20px',
                  borderBottom: '1px solid #f9f9f7',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafaf8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {/* Name + social */}
                <div>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>{applicant.name || '—'}</div>
                  {applicant.social_link && (
                    <a
                      href={applicant.social_link.startsWith('http') ? applicant.social_link : `https://${applicant.social_link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: t.fontSizes.xs, color: t.colors.primary, textDecoration: 'none', fontWeight: '500' }}
                    >
                      {applicant.social_link.replace(/^https?:\/\//, '').substring(0, 30)}{applicant.social_link.length > 33 ? '…' : ''}
                    </a>
                  )}
                </div>

                {/* Email */}
                <a
                  href={`mailto:${applicant.email}`}
                  style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, textDecoration: 'none' }}
                >
                  {applicant.email}
                </a>

                {/* Creative type */}
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                  {applicant.creative_type || '—'}
                </span>

                {/* How heard */}
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                  {applicant.how_heard || '—'}
                </span>

                {/* Time */}
                <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                  {timeAgo(applicant.created_at)}
                </span>

                {/* Status + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    padding: '3px 10px',
                    borderRadius: '100px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: sc.bg,
                    color: sc.color,
                    flexShrink: 0,
                  }}>
                    {sc.label}
                  </div>
                  {applicant.status !== 'approved' && (
                    <button
                      onClick={() => updateStatus(applicant.id, 'approved')}
                      disabled={isUpdating}
                      title="Approve"
                      style={{
                        width: '26px', height: '26px',
                        borderRadius: '50%',
                        border: '1.5px solid #1D9E75',
                        backgroundColor: '#fff',
                        color: '#1D9E75',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        opacity: isUpdating ? 0.5 : 1,
                      }}
                    >
                      ✓
                    </button>
                  )}
                  {applicant.status !== 'rejected' && (
                    <button
                      onClick={() => updateStatus(applicant.id, 'rejected')}
                      disabled={isUpdating}
                      title="Reject"
                      style={{
                        width: '26px', height: '26px',
                        borderRadius: '50%',
                        border: '1.5px solid #cc3333',
                        backgroundColor: '#fff',
                        color: '#cc3333',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        opacity: isUpdating ? 0.5 : 1,
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {applicant.status !== 'pending' && (
                    <button
                      onClick={() => updateStatus(applicant.id, 'pending')}
                      disabled={isUpdating}
                      title="Reset to pending"
                      style={{
                        width: '26px', height: '26px',
                        borderRadius: '50%',
                        border: `1.5px solid ${t.colors.borderLight}`,
                        backgroundColor: '#fff',
                        color: t.colors.textTertiary,
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        opacity: isUpdating ? 0.5 : 1,
                      }}
                    >
                      ↩
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: t.fontSizes.xs, color: t.colors.textTertiary, textAlign: 'right' }}>
          Showing {filtered.length} of {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
