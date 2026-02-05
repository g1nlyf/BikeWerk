import { z } from 'zod'

export const ExampleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
})

export type ExampleInput = z.infer<typeof ExampleSchema>