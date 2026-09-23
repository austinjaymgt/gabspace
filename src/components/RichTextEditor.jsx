// src/components/RichTextEditor.jsx
//
// WYSIWYG editor (Tiptap) used for blog post content. Emits HTML, which the
// marketing site renders as-is. Pasting from Google Docs / Word keeps
// headings, bold, lists, and links.
//
// Older posts were stored as Markdown / plain text — toEditorHtml() converts
// those on load so they open formatted and get saved back as HTML.

import { useEffect } from 'react'
import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { marked } from 'marked'
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Minus, Undo2, Redo2,
} from 'lucide-react'
import { theme as t } from '../theme'

function looksLikeHtml(content) {
  return /^\s*<[a-z][\s\S]*>/i.test(content || '')
}

// Plain text pasted into the old textarea used single newlines between
// paragraphs, which Markdown collapses into one block — treat every
// non-empty line as its own block before parsing.
function toEditorHtml(content) {
  if (!content) return ''
  if (looksLikeHtml(content)) return content
  const md = content.split(/\r?\n/).filter(line => line.trim()).join('\n\n')
  return marked.parse(md)
}

export default function RichTextEditor({ value, onChange, minHeight = 280 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  // Emit the converted HTML once so legacy Markdown posts save as HTML even
  // if the user doesn't touch the body.
  useEffect(() => {
    if (editor && value && !looksLikeHtml(value)) onChange(editor.getHTML())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const state = useEditorState({
    editor,
    selector: ({ editor }) => editor && {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
      link: editor.isActive('link'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    },
  })

  if (!editor || !state) return null

  function setLink() {
    const previous = editor.getAttributes('link').href || ''
    const url = window.prompt('Link URL (leave blank to remove)', previous)
    if (url === null) return
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!url.trim()) chain.unsetLink().run()
    else chain.setLink({ href: url.trim() }).run()
  }

  const buttons = [
    { icon: Bold, label: 'Bold', active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, label: 'Italic', active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { icon: Underline, label: 'Underline', active: state.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { icon: Strikethrough, label: 'Strikethrough', active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    'divider',
    { icon: Heading2, label: 'Heading', active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: 'Subheading', active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    'divider',
    { icon: List, label: 'Bulleted list', active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: 'Numbered list', active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: Quote, label: 'Quote', active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { icon: LinkIcon, label: 'Link', active: state.link, run: setLink },
    { icon: Minus, label: 'Divider line', active: false, run: () => editor.chain().focus().setHorizontalRule().run() },
    'divider',
    { icon: Undo2, label: 'Undo', disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
    { icon: Redo2, label: 'Redo', disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
  ]

  return (
    <div style={{ border: `1px solid ${t.colors.border}`, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.colors.bgCard }}>
      <style>{editorCss}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '6px', borderBottom: `1px solid ${t.colors.borderLight}`, backgroundColor: t.colors.bg }}>
        {buttons.map((b, i) => b === 'divider' ? (
          <span key={i} style={{ width: '1px', alignSelf: 'stretch', margin: '4px 4px', backgroundColor: t.colors.border }} />
        ) : (
          <button
            key={b.label}
            type="button"
            title={b.label}
            aria-label={b.label}
            aria-pressed={b.active}
            disabled={b.disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={b.run}
            style={{
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: t.radius.sm, cursor: b.disabled ? 'not-allowed' : 'pointer',
              backgroundColor: b.active ? t.colors.bgHover : 'transparent',
              color: b.active ? t.colors.primary : t.colors.textSecondary,
              opacity: b.disabled ? 0.4 : 1,
            }}
          >
            <b.icon size={16} strokeWidth={b.active ? 2.25 : 1.75} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="gs-rte" style={{ minHeight }} />
    </div>
  )
}

const editorCss = `
.gs-rte .tiptap { outline: none; padding: 12px 14px; min-height: inherit; font-family: ${t.fonts.sans}; font-size: 15px; line-height: 1.6; color: ${t.colors.textPrimary}; }
.gs-rte { display: flex; flex-direction: column; }
.gs-rte > .tiptap { flex: 1; }
.gs-rte .tiptap > * + * { margin-top: 0.75em; }
.gs-rte .tiptap h2 { font-family: ${t.fonts.heading}; font-size: 1.35rem; font-weight: 700; margin-top: 1.25em; }
.gs-rte .tiptap h3 { font-family: ${t.fonts.heading}; font-size: 1.1rem; font-weight: 600; margin-top: 1em; }
.gs-rte .tiptap ul, .gs-rte .tiptap ol { padding-left: 1.4rem; }
.gs-rte .tiptap li p { margin: 0; }
.gs-rte .tiptap blockquote { border-left: 3px solid ${t.colors.primary}; padding-left: 1rem; color: ${t.colors.textSecondary}; }
.gs-rte .tiptap a { color: ${t.colors.primary}; text-decoration: underline; }
.gs-rte .tiptap hr { border: none; border-top: 1px solid ${t.colors.border}; margin: 1.25em 0; }
.gs-rte .tiptap code { background: ${t.colors.bgHover}; padding: 1px 4px; border-radius: 4px; font-size: 0.9em; }
`
