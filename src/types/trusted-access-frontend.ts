/** Relationship state entry from GET /api/documents/share-token/received */
export interface RelationshipEntry {
  ownerId: string
  trustedPersonId: string
  status: 'not_linked_yet' | 'waiting_for_share'
  relationshipStatus: string
}
