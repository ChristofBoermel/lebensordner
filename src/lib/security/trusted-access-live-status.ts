import type { TrustedPerson } from '@/types/database'
import type { RelationshipEntry, TrustedAccessReceivedShareEntry } from '@/types/trusted-access-frontend'

export type ConnectionTransition = 'connected' | 'disconnected'

export interface ConnectionTransitionEvent {
  key: string
  label: string
  transition: ConnectionTransition
}

interface ConnectionSnapshotEntry {
  connected: boolean
  label: string
}

export type ConnectionSnapshot = Map<string, ConnectionSnapshotEntry>

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

function resolveShareOwnerName(share: TrustedAccessReceivedShareEntry): string {
  const profile = share.profiles
  if (!profile) return 'Lebensordner'
  if (profile.full_name) return profile.full_name
  const combined = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return combined || 'Lebensordner'
}

export function buildOwnerConnectionSnapshot(persons: TrustedPerson[]): ConnectionSnapshot {
  const snapshot: ConnectionSnapshot = new Map()

  for (const person of persons) {
    const emailKey = normalizeEmail(person.email)
    if (!emailKey) {
      continue
    }

    snapshot.set(emailKey, {
      connected: person.is_active && person.relationship_status === 'active',
      label: person.name,
    })
  }

  return snapshot
}

export function buildTrustedUserConnectionSnapshot(
  relationships: RelationshipEntry[],
  shares: TrustedAccessReceivedShareEntry[]
): ConnectionSnapshot {
  const snapshot: ConnectionSnapshot = new Map()

  for (const relationship of relationships) {
    const key = `${relationship.ownerId}:${relationship.trustedPersonId}`
    snapshot.set(key, {
      connected: relationship.status === 'waiting_for_share',
      label: 'Lebensordner',
    })
  }

  for (const share of shares) {
    const key = `${share.owner_id}:${share.trusted_person_id}`
    snapshot.set(key, {
      connected: true,
      label: resolveShareOwnerName(share),
    })
  }

  return snapshot
}

export function diffConnectionSnapshots(
  previous: ConnectionSnapshot,
  next: ConnectionSnapshot
): ConnectionTransitionEvent[] {
  const events: ConnectionTransitionEvent[] = []
  const keys = new Set([...previous.keys(), ...next.keys()])

  for (const key of keys) {
    const previousEntry = previous.get(key)
    const nextEntry = next.get(key)
    const previousConnected = previousEntry?.connected ?? false
    const nextConnected = nextEntry?.connected ?? false

    if (previousConnected === nextConnected) {
      continue
    }

    events.push({
      key,
      label: nextEntry?.label ?? previousEntry?.label ?? 'Lebensordner',
      transition: nextConnected ? 'connected' : 'disconnected',
    })
  }

  return events
}
