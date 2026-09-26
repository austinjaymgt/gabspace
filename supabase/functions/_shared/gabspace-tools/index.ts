// The Gabspace tool registry - one list shared by the MCP server (Claude
// connector) and, later, the in-app Orbi agent. Every handler runs with a
// Supabase client scoped to the caller, so RLS stays the real access gate.
import type { GabspaceTool } from './types.ts'
import { listBusinesses } from './tools/businesses.ts'
import { getClient, listClients } from './tools/clients.ts'
import { getProject, listProjects, listTasks } from './tools/work.ts'
import { getMoneySnapshot, listInvoices } from './tools/money.ts'
import { listContentCalendar, listNetworkingEvents } from './tools/schedule.ts'
import { searchBoard } from './tools/community.ts'
import {
  addClientNote,
  addNetworkingEvent,
  addProjectMilestone,
  createClient,
  createContentItem,
  createGoal,
  createInvoiceDraft,
  createProject,
  createTask,
  createVendor,
  logExpense,
  logIncome,
  updateClient,
  updateContentItem,
  updateProject,
  updateTask,
} from './tools/writes.ts'

export const TOOLS: GabspaceTool<any>[] = [
  listBusinesses,
  listClients,
  getClient,
  listProjects,
  getProject,
  listTasks,
  listInvoices,
  getMoneySnapshot,
  listContentCalendar,
  listNetworkingEvents,
  searchBoard,
  createClient,
  updateClient,
  addClientNote,
  createProject,
  updateProject,
  addProjectMilestone,
  createTask,
  updateTask,
  createInvoiceDraft,
  createContentItem,
  updateContentItem,
  logExpense,
  logIncome,
  createVendor,
  createGoal,
  addNetworkingEvent,
]

export { loadToolContext, ToolError, type ToolContext } from './context.ts'
export type { GabspaceTool } from './types.ts'
