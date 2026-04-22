// src/components/events/CampaignPanel.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function CampaignPanel({ projectId, workspaceId }) {
  const [campaign, setCampaign] = useState(null)
  const [allCampaigns, setAllCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId && workspaceId) fetchCampaign()
  }, [projectId, workspaceId])

  async function fetchCampaign() {
    setLoading(true)
    const [campRes, allRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('campaigns').select('id, name').eq('workspace_id', workspaceId).order('name'),
    ])
    setCampaign(campRes.data)
    setAllCampaigns(allRes.data || [])
    setLoading(false)
  }

  async function linkCampaign(campaignId) {
    if (campaign) {
      await supabase.from('campaigns').update({ project_id: null }).eq('id', campaign.id)
    }
    if (campaignId) {
      await supabase.from('campaigns').update({ project_id: projectId }).eq('id', campaignId)
    }
    fetchCampaign()
  }

  const statusColors = {
    draft:     { bg: '#F3F3F3', color: '#6B7280' },
    active:    { bg: '#F0EBF9', color: '#7C5CBF' },
    paused:    { bg: '#FBF0E6', color: '#D4874E' },
    completed: { bg: '#EAF2EA', color: '#6B8F71' },
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '16px' }}>Campaign Linkage</div>
      {campaign ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#F0EBF9', border: '1px solid #C9B9E8', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E' }}>{campaign.name}</div>
              <span style={{ fontSize: '10px', fontWeight: '500', background: statusColors[campaign.status]?.bg || '#F3F3F3', color: statusColors[campaign.status]?.color || '#6B7280', padding: '3px 8px', borderRadius: '100px' }}>
                {campaign.status}
              </span>
            </div>
            {campaign.overall_goal && (
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C5CBF', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{campaign.overall_goal}</div>
            )}
            {campaign.description && (
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 10px', lineHeight: 1.6 }}>{campaign.description}</p>
            )}
            {campaign.strategy_notes && (
              <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#3D3D5C', lineHeight: 1.6 }}>
                {campaign.strategy_notes}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              {campaign.start_date && <span style={{ fontSize: '11px', color: '#8585A0' }}>📅 {new Date(campaign.start_date).toLocaleDateString()} → {new Date(campaign.end_date).toLocaleDateString()}</span>}
              {campaign.budget > 0 && <span style={{ fontSize: '11px', color: '#8585A0' }}>💰 {Number(campaign.budget).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>}
              {campaign.channel && <span style={{ fontSize: '11px', color: '#8585A0' }}>📡 {campaign.channel}</span>}
              {campaign.platform && <span style={{ fontSize: '11px', color: '#8585A0' }}>🖥 {campaign.platform}</span>}
            </div>
          </div>
          <button onClick={() => linkCampaign(null)} style={{ alignSelf: 'flex-start', padding: '7px 14px', borderRadius: '8px', border: '1px solid #E8E8E8', background: 'transparent', color: '#EF4444', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
            Unlink Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '24px', background: '#F7F5F0', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎨</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E', marginBottom: '4px' }}>No campaign linked</div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Link this event to a campaign to see creative strategy here.</div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Link to campaign</label>
            <select onChange={e => linkCampaign(e.target.value)} defaultValue="" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E8E8E8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: '#1A1A2E' }}>
              <option value="" disabled>Select a campaign</option>
              {allCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}