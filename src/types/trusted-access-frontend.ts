/** Relationship state entry from GET /api/documents/share-token/received */
export interface RelationshipEntry {
  ownerId: string
  trustedPersonId: string
  status: 'not_linked_yet' | 'waiting_for_share'
  relationshipStatus: string
}

/** Minimal received-share data used by the trusted-user status surface */
export interface TrustedAccessReceivedShareEntry {
  id: string
  owner_id: string
  trusted_person_id: string
  profiles?: {
    full_name: string | null
    first_name: string | null
    last_name: string | null
  } | null
}
