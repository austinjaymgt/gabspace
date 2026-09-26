import { z } from 'npm:zod@^4.3.6'
import { check, resolveBusiness, todayISO } from '../context.ts'
import { businessIdField, defineTool, isoDate, limitField } from '../types.ts'

export const listContentCalendar = defineTool({
  name: 'list_content_calendar',
  title: 'List content calendar',
  description: 'List scheduled content/social posts for a business. Defaults to upcoming items that are not yet published.',
  input: z.object({
    business_space_id: businessIdField,
    from: isoDate.optional().describe('Defaults to today (UTC).'),
    to: isoDate.optional(),
    platform: z.string().max(40).optional(),
    include_published: z.boolean().default(false),
    limit: limitField,
  }),
  readOnly: true,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'creativeCollective')
    let query = ctx.supabase
      .from('content_calendar')
      .select('id, title, platform, status, scheduled_date, notes, campaign_id, project_id')
      .eq('business_space_id', business.id)
      .gte('scheduled_date', args.from ?? todayISO())
      .order('scheduled_date')
      .limit(args.limit)
    if (args.to) query = query.lte('scheduled_date', args.to)
    if (args.platform) query = query.ilike('platform', args.platform)
    if (!args.include_published) query = query.neq('status', 'published')
    return { business: business.name, content: check(await query, 'the content calendar') }
  },
})

export const listNetworkingEvents = defineTool({
  name: 'list_networking_events',
  title: 'List networking events',
  description: 'List networking events, conferences and meetups a business is tracking (the Team > Networking page), with goals and outcomes. Defaults to upcoming events.',
  input: z.object({
    business_space_id: businessIdField,
    from: isoDate.optional().describe('Defaults to today (UTC). Pass an earlier date to include past events.'),
    to: isoDate.optional(),
    limit: limitField,
  }),
  readOnly: true,
  handler: async (ctx, args) => {
    const business = resolveBusiness(ctx, args.business_space_id, 'team')
    let query = ctx.supabase
      .from('business_events')
      .select('id, name, event_type, date, location, cost, status, goal_connections, goal_leads, goal_revenue, actual_connections, actual_leads, actual_revenue, notes, outcome_notes')
      .eq('business_space_id', business.id)
      .gte('date', args.from ?? todayISO())
      .order('date')
      .limit(args.limit)
    if (args.to) query = query.lte('date', args.to)
    return { business: business.name, events: check(await query, 'networking events') }
  },
})
