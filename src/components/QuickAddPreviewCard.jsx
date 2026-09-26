import { theme as t } from '../theme'
import { Icon } from './Icon'

// Editable draft card for one Quick Add item (a client, task, expense, ...).
// Orbi drafts these from a jotted note; the user tweaks fields or removes
// cards before "Add all" saves them (src/lib/quickAddSave.js).

const QUICK_ADD_TYPE_META = {
  client: { label: 'Client', icon: 'client-add', color: '#534AB7', bg: '#EEEDF9' },
  task: { label: 'Task', icon: 'task', color: '#6B8F71', bg: '#EAF2EA' },
  business_event: { label: 'Event', icon: 'events', color: '#D4874E', bg: '#FBF0E6' },
  spark_idea: { label: 'Idea', icon: 'idea', color: '#D4874E', bg: '#FBF0E6' },
  project: { label: 'Project', icon: 'projects', color: '#3E6FB1', bg: '#E8EFF8' },
  content_idea: { label: 'Content idea', icon: 'campaigns', color: '#A34FA0', bg: '#F6EAF5' },
  vendor: { label: 'Vendor', icon: 'vendors', color: '#3E8F8A', bg: '#E7F3F2' },
  goal: { label: 'Goal', icon: 'team-goals', color: '#B18A3E', bg: '#F8F1E4' },
  income: { label: 'Income', icon: 'revenue', color: '#6B8F71', bg: '#EAF2EA' },
  expense: { label: 'Expense', icon: 'expense', color: '#B3453D', bg: '#F8EAE9' },
  invoice: { label: 'Invoice', icon: 'invoice', color: '#534AB7', bg: '#EEEDF9' },
}

const QUICK_ADD_FIELD_LABELS = {
  name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', note: 'Note',
  title: 'Title', due_date: 'Due date', client_name: 'Related client',
  date: 'Date', location: 'Location', notes: 'Notes',
  project_type: 'Project type', budget: 'Budget', start_date: 'Start date',
  platform: 'Platform', scheduled_date: 'Scheduled date',
  category: 'Category', owner: 'Owner',
  income_stream: 'Source', amount: 'Amount', description: 'Description',
}

function fieldInputStyle(multiline) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '7px 10px', borderRadius: multiline ? t.radius.md : t.radius.full,
    border: `1px solid ${t.colors.borderLight}`,
    backgroundColor: t.colors.bg, color: t.colors.textPrimary,
    fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, outline: 'none',
  }
}

export default function QuickAddPreviewCard({ item, onChange, onRemove }) {
  const meta = QUICK_ADD_TYPE_META[item.type] || QUICK_ADD_TYPE_META.spark_idea
  const fieldKeys = Object.keys(item.fields)
  return (
    <div style={{ backgroundColor: t.colors.bg, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.md, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: t.fontSizes.xs, fontWeight: '700', padding: '3px 10px',
          borderRadius: t.radius.full, backgroundColor: meta.bg, color: meta.color,
        }}>
          <Icon name={meta.icon} size="sm" />
          {meta.label}
        </span>
        <button
          onClick={onRemove}
          aria-label="Remove item"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, display: 'flex', padding: '2px' }}
        >
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {fieldKeys.map(key => (
          <label key={key} style={{ display: 'block' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px', display: 'block' }}>
              {QUICK_ADD_FIELD_LABELS[key] || key}
            </span>
            {key === 'note' || key === 'notes' ? (
              <textarea
                value={item.fields[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                rows={2}
                style={{ ...fieldInputStyle(true), resize: 'none' }}
              />
            ) : (
              <input
                type={key === 'due_date' || key === 'date' ? 'date' : key === 'amount' ? 'number' : 'text'}
                value={item.fields[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                style={fieldInputStyle(false)}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  )
}
