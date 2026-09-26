import { z } from 'npm:zod@^4.3.6'
import { businessForRecord, check, resolveBusiness, todayISO, ToolError } from '../context.ts'
import { businessIdField, defineTool, isoDate, limitField } from '../types.ts'

export const listProjects = defineTool({
  name: 'list_projects',
  title: 'List projects',
  description: 'List projects of a business. Statuses used in gabspace include planning, active, on-hold, completed and cancelled.',
  input: z.object({
    business_space_id: businessIdField,
    status: z.string().max(40).optional(),
    client_id: z.string().uuid().optional(),
    limit: limitField,
  }),
  readOnly: true,
  handler: async (ctx, { business_space_id, status, client_id, limit }) => {
    const business = resolveBusiness(ctx, business_space_id, 'clientManagement')
    let query = ctx.supabase
      .from('projects')
      .select('id, title, status, type, project_type, start_date, end_date, budget, client_id, clients(name)')
      .eq('business_space_id', business.id)
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (status) query = query.eq('status', status)
    if (client_id) query = query.eq('client_id', client_id)
    return { business: business.name, projects: check(await query, 'projects') }
  },
})

export const getProject = defineTool({
  name: 'get_project',
  title: 'Get project',
  description: 'Get one project with its milestones and tasks.',
  input: z.object({ project_id: z.string().uuid() }),
  readOnly: true,
  handler: async (ctx, { project_id }) => {
    const project = check(
      await ctx.supabase
        .from('projects')
        .select('id, business_space_id, title, status, type, project_type, description, notes, start_date, end_date, budget, venue, event_date, headcount, client_id, clients(name)')
        .eq('id', project_id)
        .maybeSingle(),
      'the project',
    ) as any
    if (!project?.id) throw new ToolError('Project not found.', 'denied')
    const business = businessForRecord(ctx, project.business_space_id, 'clientManagement')

    const [milestones, tasks] = await Promise.all([
      ctx.supabase.from('project_milestones').select('id, title, status, target_date').eq('project_id', project_id).order('sort_order'),
      ctx.supabase.from('tasks').select('id, title, status, start_date, due_date, assigned_to').eq('project_id', project_id).order('due_date'),
    ])

    const { business_space_id: _omit, ...rest } = project
    return {
      business: business.name,
      project: rest,
      milestones: check(milestones, 'milestones'),
      tasks: check(tasks, 'tasks'),
    }
  },
})

export const listTasks = defineTool({
  name: 'list_tasks',
  title: 'List tasks',
  description: `List tasks of a business. By default hides finished tasks. Task statuses are todo, in-progress and done. Dates are YYYY-MM-DD; "today" is computed in UTC.`,
  input: z.object({
    business_space_id: businessIdField,
    status: z.enum(['todo', 'in-progress', 'done']).optional(),
    include_done: z.boolean().default(false),
    due_before: isoDate.optional().describe('Only tasks due on or before this date.'),
    due_after: isoDate.optional().describe('Only tasks due on or after this date.'),
    overdue_only: z.boolean().default(false).describe('Only unfinished tasks whose due date has passed.'),
    project_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    limit: limitField,
  }),
  readOnly: true,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'clientManagement')
    const today = todayISO()
    let query = ctx.supabase
      .from('tasks')
      .select('id, title, status, start_date, due_date, assigned_to, project_id, projects(title), client_id, clients(name)')
      .eq('business_space_id', business.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(args.limit)
    if (args.status) query = query.eq('status', args.status)
    else if (!args.include_done || args.overdue_only) query = query.neq('status', 'done')
    if (args.overdue_only) query = query.lt('due_date', today)
    if (args.due_before) query = query.lte('due_date', args.due_before)
    if (args.due_after) query = query.gte('due_date', args.due_after)
    if (args.project_id) query = query.eq('project_id', args.project_id)
    if (args.client_id) query = query.eq('client_id', args.client_id)
    return { business: business.name, today, tasks: check(await query, 'tasks') }
  },
})
