// Write tools. Deliberately limited to low-risk, easy-to-undo changes in
// the user's own workspace: nothing here sends anything to a client (no
// invoice sending, portal publishing, emails) and nothing deletes. They're
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

    const update = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))
    if (!Object.keys(update).length) throw new ToolError('Nothing to change - pass at least one of title, status, due_date, start_date or assigned_to.')

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

export const scheduleContent = defineTool({
  name: 'schedule_content',
  title: 'Add to content calendar',
  description: 'Add a post or content idea to a business\'s content calendar. Statuses: idea, in-production, scheduled, published.',
  input: z.object({
    business_space_id: businessIdField,
    title: z.string().trim().min(1).max(200),
    platform: z.string().trim().max(40).optional().describe('e.g. Instagram, TikTok, Blog.'),
    scheduled_date: isoDate.optional(),
    status: z.enum(['idea', 'in-production', 'scheduled', 'published']).default('idea'),
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
        .select('id, title, platform, status, scheduled_date, notes, project_id')
        .single(),
      'the content item',
    )
    return { business: business.name, created: item }
  },
})
