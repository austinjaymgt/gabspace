import { theme as t } from '../theme'

const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: t.fonts.sans, padding: '20px' },
  panel: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '28px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '90vh', overflowY: 'auto', boxShadow: t.shadows.lg },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: '20px', fontWeight: '800', color: t.colors.textPrimary, margin: 0, flex: 1, paddingRight: '12px', fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  headerActions: { display: 'flex', gap: '8px', flexShrink: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: t.fontSizes.md, color: t.colors.textTertiary, cursor: 'pointer', padding: '2px' },
}

const maxWidths = { sm: '380px', md: '440px', lg: '560px', xl: '720px' }

export default function Modal({ isOpen, onClose, title, headerActions, size = 'md', children }) {
  if (!isOpen) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.panel, maxWidth: maxWidths[size] || maxWidths.md }} onClick={e => e.stopPropagation()}>
        {(title || onClose) && (
          <div style={styles.header}>
            {typeof title === 'string' ? <h3 style={styles.title}>{title}</h3> : (title || <div style={{ flex: 1 }} />)}
            <div style={styles.headerActions}>
              {headerActions}
              {onClose && <button onClick={onClose} style={styles.closeBtn}>✕</button>}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
