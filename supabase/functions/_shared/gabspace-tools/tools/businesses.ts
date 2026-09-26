import { z } from 'npm:zod@^4.3.6'
import { MODULE_LABELS, type ModuleKey } from '../context.ts'
import { defineTool } from '../types.ts'

export const listBusinesses = defineTool({
  name: 'list_businesses',
  title: 'List businesses',
  description: 'List the gabspace businesses you are on the team for, your role in each, which modules each has turned on, and which one is currently active. Tools read from the active business.',
  input: z.object({}),
  readOnly: true,
  handler: async (ctx) => ({
    active_business_id: ctx.activeBusinessId,
    businesses: ctx.businesses.map(b => ({
      id: b.id,
      name: b.name,
      role: b.role,
      active: b.id === ctx.activeBusinessId,
      modules_on: (Object.keys(MODULE_LABELS) as ModuleKey[]).filter(k => b.modules[k]).map(k => MODULE_LABELS[k]),
    })),
  }),
})
