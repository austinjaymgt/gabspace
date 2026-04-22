// src/components/events/ProposalGenerator.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

function formatDateLong(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const btnStyles = {
  primary:   { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondary: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #f0f0eb', backgroundColor: '#fff', color: '#3D3D5C', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  cancel:    { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
}

const fStyles = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1A1A2E', outline: 'none', backgroundColor: '#fff' },
}

export default function ProposalGenerator({ event, onClose }) {
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const [coverMessage, setCoverMessage] = useState('')
  const [scopeOfServices, setScopeOfServices] = useState('')
  const [milestones, setMilestones] = useState([{ label: '', date: '' }])
  const [investment, setInvestment] = useState(event.budget ? `$${parseFloat(event.budget).toLocaleString()}` : '')
  const [investmentNotes, setInvestmentNotes] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('user_settings').select('display_name, job_title').eq('user_id', user.id).maybeSingle().then(({ data }) => {
          setSenderName(data?.display_name || user.email)
          setSenderTitle(data?.job_title || '')
        })
      }
    })
  }, [])

  function addMilestone() { setMilestones(prev => [...prev, { label: '', date: '' }]) }
  function updateMilestone(i, key, val) { setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m)) }
  function removeMilestone(i) { setMilestones(prev => prev.filter((_, idx) => idx !== i)) }

  function generateHTML() {
    const milestonesHTML = milestones.filter(m => m.label).map(m => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0eb;font-weight:500;color:#1A1A2E;">${m.label}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0eb;color:#8585A0;text-align:right;">${m.date ? formatDateLong(m.date) : '—'}</td>
      </tr>`).join('')

    return `<!DOCTYPE html><html><head>
      <title>Proposal — ${event.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
      <style>* { box-sizing:border-box; margin:0; padding:0; } body { font-family:'DM Sans',sans-serif; color:#1A1A2E; background:#F7F5F0; padding:48px 24px; } .page { max-width:680px; margin:0 auto; } @media print { body { background:#fff; padding:24px; } }</style>
    </head><body><div class="page">
      <div style="background:#1A1A2E;border-radius:20px;padding:40px;margin-bottom:24px;position:relative;overflow:hidden;">
        <div style="position:absolute;width:300px;height:300px;border-radius:50%;background:#7C5CBF;opacity:0.1;top:-80px;right:-80px;"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
            <div style="background:linear-gradient(135deg,#7C5CBF,#6B8F71);padding:8px 18px;border-radius:10px;color:white;font-family:'Syne',sans-serif;font-weight:800;font-size:18px;">gabspace</div>
            <div style="text-align:right;">
              <div style="font-size:14px;font-weight:600;color:#fff;">${senderName}</div>
              ${senderTitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.5);">${senderTitle}</div>` : ''}
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px;">Event Proposal</div>
          <h1 style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin-bottom:6px;">${event.title}</h1>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);">Prepared for ${event.clients?.name || 'Client'} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">Event Overview</div>
        <table style="width:100%;border-collapse:collapse;">
          ${event.event_date ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;width:140px;">Date</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${formatDateLong(event.event_date)}</td></tr>` : ''}
          ${event.venue ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Venue</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${event.venue}</td></tr>` : ''}
          ${event.headcount ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Guest Count</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${event.headcount} estimated</td></tr>` : ''}
          ${event.clients?.name ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Client</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${event.clients.name}${event.clients.company ? ` · ${event.clients.company}` : ''}</td></tr>` : ''}
        </table>
      </div>
      ${coverMessage ? `<div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);"><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">A Note</div><p style="font-size:15px;color:#3D3D5C;line-height:1.75;font-weight:300;">${coverMessage.replace(/\n/g, '<br/>')}</p></div>` : ''}
      ${scopeOfServices ? `<div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);"><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">Scope of Services</div><p style="font-size:14px;color:#3D3D5C;line-height:1.75;">${scopeOfServices.replace(/\n/g, '<br/>')}</p></div>` : ''}
      ${milestones.filter(m => m.label).length > 0 ? `<div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);"><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">Key Milestones</div><table style="width:100%;border-collapse:collapse;">${milestonesHTML}</table></div>` : ''}
      ${investment ? `<div style="background:#1A1A2E;border-radius:16px;padding:28px;margin-bottom:20px;"><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);">Investment</div><div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:14px;color:rgba(255,255,255,0.6);">Total investment</div><div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#fff;">${investment}</div></div>${investmentNotes ? `<p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:12px;line-height:1.6;">${investmentNotes}</p>` : ''}</div>` : ''}
      <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(0,0,0,0.08);margin-top:8px;">
        <div style="font-size:12px;color:#8585A0;">Prepared by ${senderName}${senderTitle ? ` · ${senderTitle}` : ''}</div>
        <div style="font-size:11px;color:#B0B0C0;margin-top:4px;">Generated with gabspace · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </div><script>window.onload = () => window.print()<\/script></body></html>`
  }

  async function handleGenerate(mode) {
    setGenerating(true)
    const html = generateHTML()
    if (mode === 'print') {
      const w = window.open('', '_blank')
      w.document.write(html)
      w.document.close()
    }
    if (mode === 'share') {
      const blob = new Blob([html], { type: 'text/html' })
      const file = new File([blob], `proposal-${event.id}.html`, { type: 'text/html' })
      const fileName = `${event.id}/proposal-${Date.now()}.html`
      const { error: uploadError } = await supabase.storage.from('project-files').upload(fileName, file)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(fileName)
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('project_documents').insert({
          project_id: event.id, user_id: user.id,
          name: `Proposal — ${event.title}.html`,
          file_url: urlData.publicUrl, file_type: 'text/html',
        })
        navigator.clipboard.writeText(urlData.publicUrl).then(() => {
          alert('Proposal saved and share link copied to clipboard!')
        })
      }
    }
    setGenerating(false)
    if (mode !== 'share') onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '600px', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Generate Proposal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8585A0' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Sender (you)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={fStyles.field}>
                <label style={fStyles.label}>Your name</label>
                <input style={fStyles.input} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Your full name" />
              </div>
              <div style={fStyles.field}>
                <label style={fStyles.label}>Your title</label>
                <input style={fStyles.input} value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="e.g. Director of Events" />
              </div>
            </div>
          </div>
          <div style={fStyles.field}>
            <label style={fStyles.label}>Cover message / personal note</label>
            <textarea style={{ ...fStyles.input, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} rows={4} placeholder="Thank you for the opportunity..." value={coverMessage} onChange={e => setCoverMessage(e.target.value)} />
          </div>
          <div style={fStyles.field}>
            <label style={fStyles.label}>Scope of services</label>
            <textarea style={{ ...fStyles.input, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} rows={4} placeholder="Full event coordination and management..." value={scopeOfServices} onChange={e => setScopeOfServices(e.target.value)} />
          </div>
          <div>
            <label style={{ ...fStyles.label, display: 'block', marginBottom: '8px' }}>Key milestones</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              {milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input style={{ ...fStyles.input, flex: 2 }} placeholder="e.g. Contract signed" value={m.label} onChange={e => updateMilestone(i, 'label', e.target.value)} />
                  <input style={{ ...fStyles.input, flex: 1 }} type="date" value={m.date} onChange={e => updateMilestone(i, 'date', e.target.value)} />
                  {milestones.length > 1 && <button onClick={() => removeMilestone(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8585A0', fontSize: '14px' }}>✕</button>}
                </div>
              ))}
            </div>
            <button onClick={addMilestone} style={{ fontSize: '12px', color: '#7C5CBF', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add milestone</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Investment total</label>
              <input style={fStyles.input} placeholder="e.g. $12,500" value={investment} onChange={e => setInvestment(e.target.value)} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Investment notes</label>
              <input style={fStyles.input} placeholder="e.g. Deposit due upon signing" value={investmentNotes} onChange={e => setInvestmentNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f0eb' }}>
          <button onClick={onClose} style={btnStyles.cancel}>Cancel</button>
          <button onClick={() => handleGenerate('share')} disabled={generating} style={btnStyles.secondary}>{generating ? 'Saving...' : '🔗 Save & share link'}</button>
          <button onClick={() => handleGenerate('print')} disabled={generating} style={btnStyles.primary}>{generating ? 'Generating...' : '🖨 Download / Print'}</button>
        </div>
      </div>
    </div>
  )
}