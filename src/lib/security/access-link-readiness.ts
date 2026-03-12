export type AccessLinkStatus = 'ready' | 'missing_on_device' | 'missing_on_owner'
export type AccessLinkDeviceStatus = 'ready' | 'missing_on_device' | 'unknown'
export type AccessLinkOwnerStatus = 'ready' | 'missing_on_owner'
export type AccessLinkDeviceSignal = 'present' | 'missing' | 'unknown'
export type AccessLinkUserMessageKey =
  | 'access_ready'
  | 'open_access_link_on_device'
  | 'owner_must_send_access_link'
export type ManualAccessLinkMessageKey =
  | 'copy_and_send_access_link'
  | 'generate_access_link'
  | 'no_active_shared_documents'

const ACCESS_LINK_HEADER = 'x-lebensordner-access-link-key'

export interface AccessLinkReadiness {
  accessLinkStatus: AccessLinkStatus
  requiresAccessLinkSetup: boolean
  userMessageKey: AccessLinkUserMessageKey
  ownerAccessLinkStatus: AccessLinkOwnerStatus
  deviceAccessLinkStatus: AccessLinkDeviceStatus
  relationshipKeyStoredByOwner: boolean
}

export interface ManualAccessLinkGuidance {
  ownerAccessLinkStatus: AccessLinkOwnerStatus
  requiresManualAccessLinkDelivery: boolean
  deliveryChannel: 'manual_out_of_band'
  userMessageKey: ManualAccessLinkMessageKey
}

export function parseAccessLinkDeviceSignal(request: Request): AccessLinkDeviceSignal {
  const rawHeader = request.headers.get(ACCESS_LINK_HEADER)?.trim().toLowerCase()

  if (!rawHeader) {
    return 'unknown'
  }

  if (rawHeader === '1' || rawHeader === 'true' || rawHeader === 'present' || rawHeader === 'ready') {
    return 'present'
  }

  if (rawHeader === '0' || rawHeader === 'false' || rawHeader === 'missing' || rawHeader === 'absent') {
    return 'missing'
  }

  return 'unknown'
}

export function buildAccessLinkReadiness(
  relationshipKeyStoredByOwner: boolean,
  deviceSignal: AccessLinkDeviceSignal
): AccessLinkReadiness {
  if (!relationshipKeyStoredByOwner) {
    return {
      accessLinkStatus: 'missing_on_owner',
      requiresAccessLinkSetup: true,
      userMessageKey: 'owner_must_send_access_link',
      ownerAccessLinkStatus: 'missing_on_owner',
      deviceAccessLinkStatus: 'unknown',
      relationshipKeyStoredByOwner,
    }
  }

  if (deviceSignal === 'present') {
    return {
      accessLinkStatus: 'ready',
      requiresAccessLinkSetup: false,
      userMessageKey: 'access_ready',
      ownerAccessLinkStatus: 'ready',
      deviceAccessLinkStatus: 'ready',
      relationshipKeyStoredByOwner,
    }
  }

  return {
    accessLinkStatus: 'missing_on_device',
    requiresAccessLinkSetup: true,
    userMessageKey: 'open_access_link_on_device',
    ownerAccessLinkStatus: 'ready',
    deviceAccessLinkStatus: deviceSignal === 'missing' ? 'missing_on_device' : 'unknown',
    relationshipKeyStoredByOwner,
  }
}

export function buildManualAccessLinkGuidance(
  relationshipKeyStoredByOwner: boolean,
  hasActiveSharedDocuments: boolean
): ManualAccessLinkGuidance {
  if (!hasActiveSharedDocuments) {
    return {
      ownerAccessLinkStatus: relationshipKeyStoredByOwner ? 'ready' : 'missing_on_owner',
      requiresManualAccessLinkDelivery: false,
      deliveryChannel: 'manual_out_of_band',
      userMessageKey: 'no_active_shared_documents',
    }
  }

  if (!relationshipKeyStoredByOwner) {
    return {
      ownerAccessLinkStatus: 'missing_on_owner',
      requiresManualAccessLinkDelivery: false,
      deliveryChannel: 'manual_out_of_band',
      userMessageKey: 'generate_access_link',
    }
  }

  return {
    ownerAccessLinkStatus: 'ready',
    requiresManualAccessLinkDelivery: true,
    deliveryChannel: 'manual_out_of_band',
    userMessageKey: 'copy_and_send_access_link',
  }
}

export async function fetchRelationshipKeyPairSet(
  adminClient: { from: (table: string) => any },
  pairs: Array<{ ownerId: string; trustedPersonId: string }>
): Promise<Set<string>> {
  const requestedPairs = [...new Set(
    pairs
      .filter((pair) => pair.ownerId && pair.trustedPersonId)
      .map((pair) => `${pair.ownerId}:${pair.trustedPersonId}`)
  )]

  if (requestedPairs.length === 0) {
    return new Set()
  }

  const ownerIds = [...new Set(pairs.map((pair) => pair.ownerId))]
  const trustedPersonIds = [...new Set(pairs.map((pair) => pair.trustedPersonId))]

  const { data, error } = await adminClient
    .from('document_relationship_keys')
    .select('owner_id, trusted_person_id')
    .in('owner_id', ownerIds)
    .in('trusted_person_id', trustedPersonIds)

  if (error) {
    throw new Error(error.message)
  }

  const requestedPairSet = new Set(requestedPairs)
  const relationshipKeyPairs = new Set<string>()
  for (const row of data ?? []) {
    const pairKey = `${row.owner_id}:${row.trusted_person_id}`
    if (requestedPairSet.has(pairKey)) {
      relationshipKeyPairs.add(pairKey)
    }
  }

  return relationshipKeyPairs
}

export function hasRelationshipKeyForPair(
  relationshipKeyPairs: Set<string>,
  ownerId: string,
  trustedPersonId: string
): boolean {
  return relationshipKeyPairs.has(`${ownerId}:${trustedPersonId}`)
}
