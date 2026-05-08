import { z } from 'zod';

const commandSpecSchema = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([])
});

const blockSchema = z.discriminatedUnion('type', [
  z.object({
    blockId: z.string().min(1),
    type: z.literal('command'),
    label: z.string().min(1),
    command: commandSpecSchema
  }),
  z.object({
    blockId: z.string().min(1),
    type: z.literal('file-snippet'),
    path: z.string().min(1),
    anchor: z.string().min(1)
  }),
  z.object({
    blockId: z.string().min(1),
    type: z.literal('project-open')
  })
]);

export const playgroundManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  snapshotId: z.string().min(1),
  snapshotUrl: z.string().min(1),
  defaultOpenFile: z.string().min(1),
  startup: z.object({
    installCommands: z.array(commandSpecSchema).default([]),
    runCommands: z.array(commandSpecSchema).default([]),
    env: z.array(z.string()).default([])
  }),
  blocks: z.array(blockSchema).min(1)
});

export type PlaygroundManifest = z.infer<typeof playgroundManifestSchema>;

export function parsePlaygroundManifest(input: unknown) {
  return playgroundManifestSchema.parse(input);
}
