import { apiFetch } from '@/api/client'
import type { Tag } from '../types/recipe'

export function getTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('/tags')
}

export function createTag(name: string): Promise<Tag> {
  return apiFetch<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
