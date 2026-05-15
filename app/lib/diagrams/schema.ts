import { z } from 'zod'
import type { DiagramSchema } from './types'

const ToneEnum = z.enum(['blue', 'violet', 'cyan', 'orange', 'green', 'navy'])

const laneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  tone: ToneEnum
})

const nodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  x: z.number(),
  y: z.number(),
  tone: ToneEnum,
  phase: z.string().optional()
})

const edgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1)
})

const phaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string()
})

const stepSchema = z.object({
  id: z.union([z.number(), z.string()]),
  from: z.string().min(1),
  to: z.string().min(1),
  y: z.number().optional(),
  phase: z.string().optional(),
  tone: ToneEnum,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  detail: z.string(),
  engineering: z.string().optional()
})

export const diagramZodSchema = z
  .object({
    lanes: z.array(laneSchema).optional(),
    nodes: z.array(nodeSchema).optional(),
    edges: z.array(edgeSchema).optional(),
    phases: z.array(phaseSchema).optional(),
    steps: z.array(stepSchema).min(1)
  })
  .superRefine((value, ctx) => {
    const known = new Set<string>()
    value.lanes?.forEach((l) => known.add(l.id))
    value.nodes?.forEach((n) => known.add(n.id))
    if (known.size === 0) return
    value.steps.forEach((step, index) => {
      if (!known.has(step.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'from'],
          message: `Unknown lane/node id: ${step.from}`
        })
      }
      if (!known.has(step.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', index, 'to'],
          message: `Unknown lane/node id: ${step.to}`
        })
      }
    })
  })

export function parseDiagramSchema(input: unknown): DiagramSchema {
  return diagramZodSchema.parse(input) as DiagramSchema
}
