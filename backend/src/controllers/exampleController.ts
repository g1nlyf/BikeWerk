import { ExampleSchema, type ExampleInput } from '../schemas/exampleSchema'
import { listExamples, createExampleItem } from '../services/exampleService'

export async function getExamples() {
  return listExamples()
}

export async function createExample(input: unknown) {
  const parsed = ExampleSchema.parse(input as ExampleInput)
  return createExampleItem(parsed)
}