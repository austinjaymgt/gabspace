import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { Icon } from './Icon'
import Pixel from './Pixel'
import Toggle from './Toggle'
import { useIsMobile } from '../hooks/useMediaQuery'
import { MODULE_DEFS, toggleModuleState, setModules as persistModules } from '../utils/businessModules'

const NO_MODULES = MODULE_DEFS.reduce((acc, m) => ({ ...acc, [m.key]: false }), {})
const ALL_MODULES = MODULE_DEFS.reduce((acc, m) => ({ ...acc, [m.key]: true }), {})

function joinWithAnd(items) {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function proposalSentence(soloOrClients, money) {
  const clients = soloOrClients === 'clients'
  const moneyOn = money === 'yes'
  const picks = []
  if (clients || moneyOn) picks.push('Clients')
  if (moneyOn) picks.push('Money')
  const base = picks.length ? `Sounds like ${joinWithAnd(picks)}` : "Sounds like you're keeping it simple"
  return `${base} — want me to also turn on Goals?`
}

export default function AddBusinessFlow({ onCreate, onDone, onClose, forced = false }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState('name') // name | solo | money | proposal | creating | done
  const [name, setName] = useState('')
  const [soloOrClients, setSoloOrClients] = useState(null)
  const [money, setMoney] = useState(null)
  const [modules, setModules] = useState(NO_MODULES)
  const [dependencyNote, setDependencyNote] = useState(null)
  const [skipped, setSkipped] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (forced) return
    function handleKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, forced])

  useEffect(() => {
    if (step !== 'done') return
    const timer = setTimeout(() => onDone?.(), 1400)
    return () => clearTimeout(timer)
  }, [step, onDone])

  function toggleModule(key) {
    setModules(prev => {
      const { modules: next, note } = toggleModuleState(prev, key)
      setDependencyNote(note)
      return next
    })
  }

  function chooseSolo(choice) {
    setSoloOrClients(choice)
    setStep('money')
  }

  function chooseMoney(choice) {
    setMoney(choice)
    const clients = soloOrClients === 'clients'
    const moneyOn = choice === 'yes'
    setModules({ ...NO_MODULES, clientManagement: clients || moneyOn, money: moneyOn })
    setStep('proposal')
  }

  function handleSkip() {
    setModules(ALL_MODULES)
    setSkipped(true)
    if (name.trim()) handleConfirm()
  }

  async function handleConfirm() {
    if (!name.trim()) return
    setError(null)
    setStep('creating')
    const { error, businessSpaceId: newId } = await onCreate?.(name.trim()) || {}
    if (error) {
      setError(error.message || 'Something went wrong — try again.')
      setStep(skipped ? 'name' : 'proposal')
      return
    }
    if (newId) persistModules(newId, modules)
    setStep('done')
  }

  const gabiSize = isMobile ? 96 : 120
  const mood = step === 'creating' ? 'working' : step === 'done' ? 'celebrating' : 'idle'
  const canSkip = step !== 'creating' && step !== 'done'

  const voiceLine = {
    name: forced ? "You'll need at least one business to keep going. What should I call it?" : "Let's set up a new business. What should I call it?",
    solo: 'Solo, or working with clients?',
    money: 'Do you want to track money for this one — invoices, expenses, snapshots?',
    proposal: proposalSentence(soloOrClients, money),
    creating: 'Setting things up…',
    done: `You're all set — welcome to ${name}.`,
  }[step]

  return (
    <div style={s.overlay} onClick={forced ? undefined : onClose}>
      <style>{`
        @keyframes addbiz-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        {!forced && (
          <button onClick={onClose} aria-label="Close" style={s.closeBtn}>
            <Icon name="close" size="md" />
          </button>
        )}

        <div key={mood} style={s.pixelWrap}>
          <Pixel mood={mood} size={gabiSize} theme="light" />
        </div>

        <p key={`${step}-voice`} style={s.voiceLine}>{voiceLine}</p>

        <div key={`${step}-content`} style={s.contentCard}>
          {error && <div style={s.errorBanner}>{error}</div>}

          {step === 'name' && (
            <div style={s.column}>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) (skipped ? handleConfirm() : setStep('solo')) }}
                placeholder="Business name"
                style={s.input}
              />
              <button
                onClick={() => (skipped ? handleConfirm() : setStep('solo'))}
                disabled={!name.trim()}
                style={{ ...s.btnPrimary, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
              >
                {skipped ? 'Create business' : 'Continue'}
                <Icon name="expand" size="sm" style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>
          )}

          {step === 'solo' && (
            <div style={s.column}>
              <ChoiceButton label="Just me" onClick={() => chooseSolo('solo')} />
              <ChoiceButton label="Working with clients" onClick={() => chooseSolo('clients')} />
            </div>
          )}

          {step === 'money' && (
            <div style={s.column}>
              <ChoiceButton label="Yes, track money here" onClick={() => chooseMoney('yes')} />
              <ChoiceButton label="No, not this one" onClick={() => chooseMoney('no')} />
            </div>
          )}

          {step === 'proposal' && (
            <div style={s.column}>
              <div style={s.moduleList}>
                {MODULE_DEFS.map(m => (
                  <label key={m.key} style={s.moduleRow}>
                    <span style={s.moduleLabel}>
                      <Icon name={m.icon} size="sm" />
                      {m.label}
                    </span>
                    <Toggle checked={modules[m.key]} onChange={() => toggleModule(m.key)} />
                  </label>
                ))}
              </div>
              {dependencyNote && (
                <div style={s.noteRow}>
                  <Icon name="info" size="sm" />
                  <span>{dependencyNote}</span>
                </div>
              )}
              <button onClick={handleConfirm} style={s.btnPrimary}>
                Create business
                <Icon name="success" size="sm" />
              </button>
            </div>
          )}

          {step === 'creating' && (
            <div style={s.column}>
              <Icon name="loading" size="lg" />
            </div>
          )}

          {step === 'done' && (
            <div style={s.column}>
              <Icon name="success" size="xl" color={t.colors.primary} />
            </div>
          )}
        </div>

        {canSkip && (
          <button onClick={handleSkip} style={s.skipBtn}>
            Skip, add all features
          </button>
        )}
      </div>
    </div>
  )
}

function ChoiceButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={s.choiceBtn}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = t.colors.bgCard}
    >
      {label}
      <Icon name="expand" size="sm" style={{ transform: 'rotate(-90deg)', opacity: 0.5 }} />
    </button>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(26,26,46,0.55)',
    backdropFilter: 'blur(4px)',
    fontFamily: t.fonts.sans,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
  },
  sheet: {
    position: 'relative',
    width: '100%',
    maxWidth: '440px',
    maxHeight: '90vh',
    overflowY: 'auto',
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.xl,
    boxShadow: t.shadows.lg,
    padding: '32px 28px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    animation: 'addbiz-rise 0.25s ease',
  },
  closeBtn: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    background: 'none',
    border: 'none',
    color: t.colors.textTertiary,
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: t.colors.textTertiary,
    fontSize: t.fontSizes.sm,
    fontFamily: t.fonts.sans,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 0,
    marginTop: '16px',
  },
  pixelWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  voiceLine: {
    fontFamily: t.fonts.heading,
    fontSize: t.fontSizes['2xl'],
    fontWeight: 700,
    color: t.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
    margin: '0 0 20px',
  },
  contentCard: {
    width: '100%',
    boxSizing: 'border-box',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    padding: '12px 14px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.md,
    outline: 'none',
    color: t.colors.textPrimary,
    fontFamily: t.fonts.sans,
    boxSizing: 'border-box',
  },
  choiceBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textPrimary,
    fontSize: t.fontSizes.md,
    fontWeight: 500,
    fontFamily: t.fonts.sans,
    cursor: 'pointer',
    textAlign: 'left',
  },
  moduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  moduleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 4px',
    borderBottom: `1px solid ${t.colors.borderLight}`,
    cursor: 'pointer',
  },
  moduleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: t.fontSizes.md,
    color: t.colors.textPrimary,
    fontWeight: 500,
  },
  noteRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    backgroundColor: t.colors.primaryLight,
    borderRadius: t.radius.md,
    padding: '10px 12px',
    color: t.colors.primary,
    fontSize: t.fontSizes.sm,
    marginTop: '10px',
  },
  errorBanner: {
    backgroundColor: t.colors.dangerLight,
    color: t.colors.danger,
    borderRadius: t.radius.md,
    padding: '10px 12px',
    fontSize: t.fontSizes.sm,
    marginBottom: '14px',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    backgroundColor: t.colors.primary,
    color: t.colors.textInverse,
    border: 'none',
    borderRadius: t.radius.full,
    padding: '12px 20px',
    fontSize: t.fontSizes.md,
    fontWeight: 600,
    fontFamily: t.fonts.sans,
    cursor: 'pointer',
    marginTop: '4px',
  },
}
