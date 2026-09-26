import { z } from 'npm:zod@^4.3.6'
import type { ToolContext } from './context.ts'

export type GabspaceTool<S extends z.ZodObject = z.ZodObject> = {
  name: string
  title: string
  description: string
  input: S
  // Write tools set this false so clients (Claude) ask the user before
  // running them, and so the MCP server applies the tighter write limit.
  readOnly: boolean
  handler: (ctx: ToolContext, args: z.infer<S>) => Promise<unknown>
}

// Keeps each tool's handler args typed from its own schema.
export function defineTool<S extends z.ZodObject>(tool: GabspaceTool<S>): GabspaceTool<S> {
  return tool
}

// Shared input fields.
export const businessIdField = z.string().uuid().optional()
  .describe('Which of your businesses to use (ids from list_businesses). Defaults to the business currently active in gabspace. Use the business the user names.')
export const limitField = z.number().int().min(1).max(100).default(25)
  .describe('Maximum rows to return.')
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
