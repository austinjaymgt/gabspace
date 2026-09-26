// Runs one Gabspace tool call on behalf of a user: input validation, rate
// limits, the handler itself, and the mcp_request_log audit row. Shared by
// the MCP server (Claude connector) and the in-app Orbi agent so both
// enforce the same limits and leave the same audit trail.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { ToolError, type ToolContext } from './context.ts'
import { TOOLS } from './index.ts'
import type { GabspaceTool } from './types.ts'

export const TOOL_CALLS_PER_HOUR = 300
export const WRITE_CALLS_PER_HOUR = 60

export type RunOptions = {
  // Service-role client - only for the audit log / rate-limit counts.
  adminClient: SupabaseClient
  // Who made the call: the OAuth client id for connector calls, or a fixed
  // label like 'orbi-in-app' for Orbi. Stored in mcp_request_log.
  clientId: string | null
}

export type RunResult = { ok: boolean; text: string }

type CallLog = {
  user_id: string
  oauth_client_id: string | null
  tool_name: string
  business_space_id: string | null
  status: 'ok' | 'error' | 'denied' | 'rate_limited'
  error_message?: string
  duration_ms: number
}

async function logCall(admin: SupabaseClient, entry: CallLog) {
  const { error } = await admin.from('mcp_request_log').insert(entry)
  if (error) console.error('mcp_request_log insert failed', error.message)
}

// Returns the message to show when a limit is hit, or null. Writes get a
// tighter limit of their own on top of the overall one, counting only
// successful writes so a burst of rejected attempts doesn't lock anyone out.
async function rateLimitMessage(admin: SupabaseClient, userId: string, isWrite: boolean): Promise<string | null> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('mcp_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)
  if ((count || 0) >= TOOL_CALLS_PER_HOUR) {
    return `You've hit the limit of ${TOOL_CALLS_PER_HOUR} gabspace tool calls per hour. Try again a bit later.`
  }
  if (!isWrite) return null

  const writeToolNames = (TOOLS as GabspaceTool<any>[]).filter(t => !t.readOnly).map(t => t.name)
  const { count: writes } = await admin
    .from('mcp_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'ok')
    .in('tool_name', writeToolNames)
    .gte('created_at', windowStart)
  if ((writes || 0) >= WRITE_CALLS_PER_HOUR) {
    return `You've hit the limit of ${WRITE_CALLS_PER_HOUR} changes to gabspace per hour. Try again a bit later.`
  }
  return null
}

// `rawArgs` is validated here with the tool's own schema, so callers can
// pass untrusted model output straight through. (The MCP SDK validates
// before calling us too; re-parsing there is harmless.)
export async function runTool(ctx: ToolContext, tool: GabspaceTool<any>, rawArgs: unknown, opts: RunOptions): Promise<RunResult> {
  const started = Date.now()
  const parsed = tool.input.safeParse(rawArgs ?? {})
  const args: any = parsed.success ? parsed.data : {}
  const base = {
    user_id: ctx.userId,
    oauth_client_id: opts.clientId,
    tool_name: tool.name,
    business_space_id: args?.business_space_id ?? ctx.activeBusinessId,
  }

  if (!parsed.success) {
    const message = `Invalid input for ${tool.name}: ${parsed.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`
    await logCall(opts.adminClient, { ...base, status: 'error', error_message: message.slice(0, 500), duration_ms: Date.now() - started })
    return { ok: false, text: message }
  }

  const limited = await rateLimitMessage(opts.adminClient, ctx.userId, !tool.readOnly)
  if (limited) {
    await logCall(opts.adminClient, { ...base, status: 'rate_limited', duration_ms: Date.now() - started })
    return { ok: false, text: limited }
  }

  try {
    const result = await tool.handler(ctx, args)
    await logCall(opts.adminClient, { ...base, status: 'ok', duration_ms: Date.now() - started })
    return { ok: true, text: JSON.stringify(result, null, 2) }
  } catch (err) {
    const known = err instanceof ToolError
    const message = err instanceof Error ? err.message : String(err)
    await logCall(opts.adminClient, { ...base, status: known ? (err as ToolError).kind : 'error', error_message: message.slice(0, 500), duration_ms: Date.now() - started })
    if (!known) console.error(`tool ${tool.name} failed`, message)
    return { ok: false, text: known ? message : 'Something went wrong reading gabspace. Try again in a moment.' }
  }
}
