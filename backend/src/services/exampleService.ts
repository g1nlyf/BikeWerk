import { type ExampleInput } from '../schemas/exampleSchema'

const memoryStore: ExampleInput[] = []

export async function listExamples() {
  return memoryStore
}

export async function createExampleItem(item: ExampleInput) {
  memoryStore.push(item)
  return item
}