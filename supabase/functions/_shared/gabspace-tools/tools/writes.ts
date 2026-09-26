// Write tools. Deliberately limited to low-risk, easy-to-undo changes in
// the user's own workspace: nothing here sends anything to a client (no
// invoice sending, portal publishing, emails) and nothing deletes. Anything
// that could surface in a client portal (milestones) is created hidden. They're
// registered with readOnlyHint false so MCP clients ask before running them.
import { z } from 'npm:zod@^4.3.6'
import { businessForRecord, check, resolveBusiness, ToolError, type Business, type ToolContext } from '../context.ts'
import { businessIdField, defineTool, isoDate } from '../types.ts'

// Confirms a linked record (project/client) belongs to the same business
// before we attach something to it - RLS would allow a record from any of
// the caller's businesses, but a project from a different business than
// the task should be a clear error rather than a silently mismatched link.
async function assertInBusiness(ctx: ToolContext, table: 'projects' | 'clients', id: string, business: Business) {
  const row = check(
    await ctx.supabase.from(table).select('id, business_space_id').eq('id', id).maybeSingle(),
    table === 'projects' ? 'the project' : 'the client',
  ) as any
  if (!row?.id || row.business_space_id !== business.id) {
    throw new ToolError(`That ${table === 'projects' ? 'project' : 'client'} isn't in ${business.name}.`, 'denied')
  }
}

// The fields an update tool was actually given (undefined = leave alone,
// null = clear). Errors when there's nothing to change.
function changesFrom(changes: Record<string, unknown>, fieldNames: string): Record<string, unknown> {
  const update = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))
  if (!Object.keys(update).length) throw new ToolError(`Nothing to change - pass at least one of ${fieldNames}.`)
  return update
}

const CLIENT_STATUSES = ['lead', 'prospect', 'active', 'completed', 'inactive'] as const
const PROJECT_STATUSES = ['planning', 'active', 'on-hold', 'completed', 'cancelled'] as const
const CONTENT_STATUSES = ['idea', 'in-production', 'scheduled', 'published'] as const
const CLIENT_FIELDS = 'id, name, company, email, phone, status'
const PROJECT_FIELDS = 'id, title, status, project_type, start_date, end_date, budget, description, client_id, clients(name)'
const CONTENT_FIELDS = 'id, title, platform, status, scheduled_date, notes, project_id'

export const createTask = defineTool({
  name: 'create_task',
  title: 'Create task',
  description: 'Create a task in one of your businesses. Optionally link it to a project or client (use list_projects / list_clients to find ids).',
  input: z.object({
    business_space_id: businessIdField,
    title: z.string().trim().min(1).max(200),
    due_date: isoDate.optional(),
    start_date: isoDate.optional(),
    status: z.enum(['todo', 'in-progress', 'done']).default('todo'),
    project_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    assigned_to: z.string().trim().max(100).optional().describe('Free-text name of who it\'s for, as shown on the Tasks page.'),
  }),
  readOnly: false,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'clientManagement')
    if (args.project_id) await assertInBusiness(ctx, 'projects', args.project_id, business)
    if (args.client_id) await assertInBusiness(ctx, 'clients', args.client_id, business)

    const task = check(
      await ctx.supabase
        .from('tasks')
        .insert({
          business_space_id: business.id,
          title: args.title,
          status: args.status,
          due_date: args.due_date ?? null,
          start_date: args.start_date ?? null,
          project_id: args.project_id ?? null,
          client_id: args.client_id ?? null,
          assigned_to: args.assigned_to ?? null,
        })
        .select('id, title, status, start_date, due_date, assigned_to, project_id, client_id')
        .single(),
      'the new task',
    )
    return { business: business.name, created: task }
  },
})

export const updateTask = defineTool({
  name: 'update_task',
  title: 'Update task',
  description: 'Update a task: mark it done or in progress, rename it, or change its dates. Pass null for a date to clear it.',
  input: z.object({
    task_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(['todo', 'in-progress', 'done']).optional(),
    due_date: isoDate.nullable().optional(),
    start_date: isoDate.nullable().optional(),
    assigned_to: z.string().trim().max(100).nullable().optional(),
  }),
  readOnly: false,
  handler: async (ctx, { task_id, ...changes }) => {
    const existing = check(
      await ctx.supabase.from('tasks').select('id, business_space_id, title, status, due_date').eq('id', task_id).maybeSingle(),
      'the task',
    ) as any
    if (!existing?.id) throw new ToolError('Task not found.', 'denied')
    const business = businessForRecord(ctx, existing.business_space_id, 'clientManagement')

    const update = changesFrom(changes, 'title, status, due_date, start_date or assigned_to')

    const task = check(
      await ctx.supabase
        .from('tasks')
        .update(update)
        .eq('id', task_id)
        .select('id, title, status, start_date, due_date, assigned_to, project_id, client_id')
        .single(),
      'the task',
    )
    return {
      business: business.name,
      before: { title: existing.title, status: existing.status, due_date: existing.due_date },
      updated: task,
    }
  },
})

export const createInvoiceDraft = defineTool({
  name: 'create_invoice_draft',
  title: 'Create invoice draft',
  description: 'Create a DRAFT invoice in one of your businesses with line items. It is not sent to anyone - the user reviews and sends it from the Invoices page. Owners and co-owners only.',
  input: z.object({
    business_space_id: businessIdField,
    client_id: z.string().uuid(),
    project_id: z.string().uuid().optional(),
    due_date: isoDate.optional(),
    invoice_number: z.string().trim().max(40).optional(),
    line_items: z.array(z.object({
      description: z.string().trim().min(1).max(300),
      quantity: z.number().positive().max(100000).default(1),
      unit_price: z.number().min(0).max(10000000).describe('Price per unit in dollars, no currency symbol.'),
    })).min(1).max(25),
  }),
  readOnly: false,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'money')
    if (!['owner', 'co-owner'].includes(business.role)) {
      throw new ToolError(`Invoices in ${business.name} can only be created by owners and co-owners.`, 'denied')
    }
    await assertInBusiness(ctx, 'clients', args.client_id, business)
    if (args.project_id) await assertInBusiness(ctx, 'projects', args.project_id, business)

    const invoice = check(
      await ctx.supabase
        .from('invoices')
        .insert({
          business_space_id: business.id,
          user_id: ctx.userId,
          client_id: args.client_id,
          project_id: args.project_id ?? null,
          due_date: args.due_date ?? null,
          invoice_number: args.invoice_number || null,
          status: 'draft',
        })
        .select('id')
        .single(),
      'the new invoice',
    ) as any

    // total_amount is maintained by the line_items triggers.
    const { error: itemsError } = await ctx.supabase.from('line_items').insert(
      args.line_items.map(item => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price })),
    )
    if (itemsError) {
      // Don't leave an empty draft behind.
      await ctx.supabase.from('invoices').delete().eq('id', invoice.id)
      throw new Error(`Couldn't add the line items: ${itemsError.message}`)
    }

    const saved = check(
      await ctx.supabase
        .from('invoices')
        .select('id, invoice_number, status, total_amount, due_date, clients(name), line_items(description, quantity, unit_price, total)')
        .eq('id', invoice.id)
        .single(),
      'the new invoice',
    )
    return { business: business.name, created: saved, note: 'Saved as a draft. Nothing was sent - review and send it from Invoices in gabspace.' }
  },
})

export const createContentItem = defineTool({
  name: 'create_content_item',
  title: 'Create content item',
  description: 'Add a post or content idea to a business\'s content calendar. Statuses: idea, in-production, scheduled, published.',
  input: z.object({
    business_space_id: businessIdField,
    title: z.string().trim().min(1).max(200),
    platform: z.string().trim().max(40).optional().describe('e.g. Instagram, TikTok, Blog.'),
    scheduled_date: isoDate.optional(),
    status: z.enum(CONTENT_STATUSES).default('idea'),
    notes: z.string().trim().max(2000).optional(),
    project_id: z.string().uuid().optional(),
  }),
  readOnly: false,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'creativeCollective')
    if (args.project_id) await assertInBusiness(ctx, 'projects', args.project_id, business)

    const item = check(
      await ctx.supabase
        .from('content_calendar')
        .insert({
          business_space_id: business.id,
          user_id: ctx.userId,
          title: args.title,
          platform: args.platform ?? null,
          scheduled_date: args.scheduled_date ?? null,
          status: args.status,
          notes: args.notes ?? null,
          project_id: args.project_id ?? null,
        })
        .select(CONTENT_FIELDS)
        .single(),
      'the content item',
    )
    return { business: business.name, created: item }
  },
})

export const updateContentItem = defineTool({
  name: 'update_content_item',
  title: 'Update content item',
  description: 'Update a content calendar item: change its status, date, platform, title or notes (ids from list_content_calendar). Pass null to clear a field.',
  input: z.object({
    content_item_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    platform: z.string().trim().max(40).nullable().optional(),
    scheduled_date: isoDate.nullable().optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
  readOnly: false,
  handler: async (ctx, { content_item_id, ...changes }) => {
    const existing = check(
      await ctx.supabase.from('content_calendar').select(`${CONTENT_FIELDS}, business_space_id`).eq('id', content_item_id).maybeSingle(),
      'the content item',
    ) as any
    if (!existing?.id) throw new ToolError('Content item not found.', 'denied')
    const business = businessForRecord(ctx, existing.business_space_id, 'creativeCollective')
    const update = changesFrom(changes, 'title, platform, scheduled_date, status or notes')

    const item = check(
      await ctx.supabase.from('content_calendar').update(update).eq('id', content_item_id).select(CONTENT_FIELDS).single(),
      'the content item',
    )
    const { business_space_id: _omit, ...before } = existing
    return { business: business.name, before, updated: item }
  },
})

export const createClient = defineTool({
  name: 'create_client',
  title: 'Create client',
  description: 'Add a client to one of your businesses, optionally with a first note about them. Check list_clients first so you don\'t create a duplicate. Nothing is sent to the client.',
  input: z.object({
    business_space_id: businessIdField,
    name: z.string().trim().min(1).max(200),
    company: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(40).optional(),
    status: z.enum(CLIENT_STATUSES).default('active'),
    note: z.string().trim().min(1).max(5000).optional().describe('Saved as a note on the client, like the Notes section of their profile.'),
  }),
  readOnly: false,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'clientManagement')

    const client = check(
      await ctx.supabase
        .from('clients')
        .insert({
          business_space_id: business.id,
          user_id: ctx.userId,
          name: args.name,
          company: args.company || null,
          email: args.email || null,
          phone: args.phone || null,
          status: args.status,
        })
        .select(CLIENT_FIELDS)
        .single(),
      'the new client',
    ) as any

    const result: Record<string, unknown> = { business: business.name, created: client }
    if (args.note) {
      // The client exists either way - report a failed note rather than
      // failing the whole call and inviting a duplicate retry.
      const { error } = await ctx.supabase.from('notes').insert({
        business_space_id: business.id, user_id: ctx.userId, client_id: client.id, content: args.note,
      })
      result.note = error ? `The client was created, but the note couldn't be saved: ${error.message}` : 'Note saved.'
    }
    return result
  },
})

export const updateClient = defineTool({
  name: 'update_client',
  title: 'Update client',
  description: 'Update a client\'s name, company, contact details or status. Pass null to clear company, email or phone.',
  input: z.object({
    client_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200).optional(),
    company: z.string().trim().max(200).nullable().optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    status: z.enum(CLIENT_STATUSES).optional(),
  }),
  readOnly: false,
  handler: async (ctx, { client_id, ...changes }) => {
    const existing = check(
      await ctx.supabase.from('clients').select(`${CLIENT_FIELDS}, business_space_id`).eq('id', client_id).maybeSingle(),
      'the client',
    ) as any
    if (!existing?.id) throw new ToolError('Client not found.', 'denied')
    const business = businessForRecord(ctx, existing.business_space_id, 'clientManagement')
    const update = changesFrom(changes, 'name, company, email, phone or status')

    const client = check(
      await ctx.supabase.from('clients').update(update).eq('id', client_id).select(CLIENT_FIELDS).single(),
      'the client',
    )
    const { business_space_id: _omit, ...before } = existing
    return { business: business.name, before, updated: client }
  },
})

export const addClientNote = defineTool({
  name: 'add_note',
  title: 'Add client note',
  description: 'Add a note to a client\'s profile (meeting notes, preferences, follow-ups). Notes are internal - clients never see them.',
  input: z.object({
    client_id: z.string().uuid(),
    content: z.string().trim().min(1).max(5000),
  }),
  readOnly: false,
  handler: async (ctx, { client_id, content }) => {
    const client = check(
      await ctx.supabase.from('clients').select('id, name, business_space_id').eq('id', client_id).maybeSingle(),
      'the client',
    ) as any
    if (!client?.id) throw new ToolError('Client not found.', 'denied')
    const business = businessForRecord(ctx, client.business_space_id, 'clientManagement')

    const note = check(
      await ctx.supabase
        .from('notes')
        .insert({ business_space_id: business.id, user_id: ctx.userId, client_id, content })
        .select('id, content, created_at')
        .single(),
      'the note',
    )
    return { business: business.name, client: client.name, created: note }
  },
})

export const createProject = defineTool({
  name: 'create_project',
  title: 'Create project',
  description: 'Create a project in one of your businesses, optionally for a client (ids from list_clients). Statuses: planning, active, on-hold, completed, cancelled. Nothing is shared with the client.',
  input: z.object({
    business_space_id: businessIdField,
    title: z.string().trim().min(1).max(200),
    client_id: z.string().uuid().optional(),
    status: z.enum(PROJECT_STATUSES).default('planning'),
    project_type: z.string().trim().max(60).optional().describe('Free-text category, e.g. Branding, Website, Photography.'),
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
    budget: z.number().min(0).max(100000000).optional().describe('In dollars, no currency symbol.'),
    description: z.string().trim().max(5000).optional(),
  }),
  readOnly: false,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'clientManagement')
    if (args.client_id) await assertInBusiness(ctx, 'clients', args.client_id, business)
    if (args.start_date && args.end_date && args.end_date < args.start_date) {
      throw new ToolError('end_date is before start_date.')
    }

    const project = check(
      await ctx.supabase
        .from('projects')
        .insert({
          business_space_id: business.id,
          user_id: ctx.userId,
          type: 'project',
          has_event_features: false,
          title: args.title,
          client_id: args.client_id ?? null,
          status: args.status,
          project_type: args.project_type || null,
          start_date: args.start_date ?? null,
          end_date: args.end_date ?? null,
          budget: args.budget ?? null,
          description: args.description || null,
        })
        .select(PROJECT_FIELDS)
        .single(),
      'the new project',
    )
    return { business: business.name, created: project }
  },
})

export const updateProject = defineTool({
  name: 'update_project',
  title: 'Update project',
  description: 'Update a project: change its status, title, client, type, dates, budget or description. Pass null to clear a field.',
  input: z.object({
    project_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    client_id: z.string().uuid().nullable().optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    project_type: z.string().trim().max(60).nullable().optional(),
    start_date: isoDate.nullable().optional(),
    end_date: isoDate.nullable().optional(),
    budget: z.number().min(0).max(100000000).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  }),
  readOnly: false,
  handler: async (ctx, { project_id, ...changes }) => {
    const existing = check(
      await ctx.supabase.from('projects').select(`${PROJECT_FIELDS}, business_space_id`).eq('id', project_id).maybeSingle(),
      'the project',
    ) as any
    if (!existing?.id) throw new ToolError('Project not found.', 'denied')
    const business = businessForRecord(ctx, existing.business_space_id, 'clientManagement')
    const update = changesFrom(changes, 'title, client_id, status, project_type, start_date, end_date, budget or description')
    if (update.client_id) await assertInBusiness(ctx, 'clients', update.client_id as string, business)

    const start = update.start_date !== undefined ? update.start_date : existing.start_date
    const end = update.end_date !== undefined ? update.end_date : existing.end_date
    if (start && end && end < start) throw new ToolError('end_date would be before start_date.')

    const project = check(
      await ctx.supabase.from('projects').update(update).eq('id', project_id).select(PROJECT_FIELDS).single(),
      'the project',
    )
    const { business_space_id: _omit, ...before } = existing
    return { business: business.name, before, updated: project }
  },
})

export const addProjectMilestone = defineTool({
  name: 'add_project_milestone',
  title: 'Add project milestone',
  description: 'Add a milestone to a project (ids from list_projects). It starts hidden from the client portal - the user can choose to show it from the project page.',
  input: z.object({
    project_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    target_date: isoDate.optional(),
    status: z.enum(['upcoming', 'in_progress', 'done']).default('upcoming'),
  }),
  readOnly: false,
  handler: async (ctx, args) => {
    const project = check(
      await ctx.supabase.from('projects').select('id, title, business_space_id').eq('id', args.project_id).maybeSingle(),
      'the project',
    ) as any
    if (!project?.id) throw new ToolError('Project not found.', 'denied')
    const business = businessForRecord(ctx, project.business_space_id, 'clientManagement')

    const milestone = check(
      await ctx.supabase
        .from('project_milestones')
        .insert({
          business_space_id: business.id,
          project_id: args.project_id,
          title: args.title,
          target_date: args.target_date ?? null,
          status: args.status,
          show_in_portal: false,
        })
        .select('id, title, status, target_date')
        .single(),
      'the milestone',
    )
    return { business: business.name, project: project.title, created: milestone }
  },
})
