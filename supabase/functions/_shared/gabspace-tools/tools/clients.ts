import { z } from 'npm:zod@^4.3.6'
import { businessForRecord, check, resolveBusiness, ToolError } from '../context.ts'
import { businessIdField, defineTool, limitField } from '../types.ts'

export const listClients = defineTool({
  name: 'list_clients',
  title: 'List clients',
  description: 'List clients of a business, optionally filtered by a name/company search or status.',
  input: z.object({
    business_space_id: businessIdField,
    search: z.string().max(100).optional().describe('Matches client name or company.'),
    status: z.string().max(40).optional().describe('Exact client status, e.g. "active".'),
    limit: limitField,
  }),
  readOnly: true,
  handler: async (ctx, { business_space_id, search, status, limit }) => {
    const business = resolveBusiness(ctx, business_space_id, 'clientManagement')
    let query = ctx.supabase
      .from('clients')
      .select('id, name, company, email, phone, status, created_at')
      .eq('business_space_id', business.id)
      .order('name')
      .limit(limit)
    if (status) query = query.eq('status', status)
    if (search) {
      // Strip PostgREST filter syntax characters so a search can't widen the or().
      const term = search.replace(/[,()*%]/g, ' ').trim()
      if (term) query = query.or(`name.ilike.%${term}%,company.ilike.%${term}%`)
    }
    return { business: business.name, clients: check(await query, 'clients') }
  },
})

export const getClient = defineTool({
  name: 'get_client',
  title: 'Get client',
  description: 'Get one client with their projects, open tasks, and (if your role can see money) invoices.',
  input: z.object({ client_id: z.string().uuid() }),
  readOnly: true,
  handler: async (ctx, { client_id }) => {
    const client = check(
      await ctx.supabase
        .from('clients')
        .select('id, business_space_id, name, company, email, phone, status, created_at')
        .eq('id', client_id)
        .maybeSingle(),
      'the client',
    ) as any
    if (!client?.id) throw new ToolError('Client not found.', 'denied')
    const business = businessForRecord(ctx, client.business_space_id, 'clientManagement')

    const [projects, tasks] = await Promise.all([
      ctx.supabase.from('projects').select('id, title, status, start_date, end_date, project_type').eq('client_id', client_id).order('start_date', { ascending: false }),
      ctx.supabase.from('tasks').select('id, title, status, due_date, project_id').eq('client_id', client_id).neq('status', 'done').order('due_date'),
    ])

    let invoices: unknown = 'Not available - the Money module is off or your role can\'t see invoices.'
    if (business.modules.money && ['owner', 'co-owner'].includes(business.role)) {
      invoices = check(
        await ctx.supabase.from('invoices').select('id, invoice_number, status, total_amount, amount_paid, due_date, paid_date').eq('client_id', client_id).order('due_date', { ascending: false }),
        'invoices',
      )
    }

    const { business_space_id: _omit, ...rest } = client
    return {
      business: business.name,
      client: rest,
      projects: check(projects, 'projects'),
      open_tasks: check(tasks, 'tasks'),
      invoices,
    }
  },
})
