import type { TrustedAccessRelationshipStatus } from '@/lib/security/trusted-access'
import { canTrustedPersonPerformAction } from '@/lib/security/trusted-person-access'

export interface TrustedPersonRecord {
  id: string
  name: string | null
  access_level: string | null
  relationship_status: TrustedAccessRelationshipStatus | null
}

export interface TrustedPersonGuardResult {
  allowed: boolean
  trustedPerson: TrustedPersonRecord | null
  errorCode?:
    | 'NO_RELATIONSHIP'
    | 'INVITATION_PENDING'
    | 'RELATIONSHIP_INACTIVE'
    | 'ACCESS_LEVEL_DENIED'
    | 'SETUP_INCOMPLETE'
  details?: string
}

export async function guardTrustedPersonAccess(
  adminClient: any,
  ownerId: string,
  viewerId: string,
  action: 'view' | 'download'
): Promise<TrustedPersonGuardResult> {
  const { data: relationship, error: relationshipError } = await adminClient
    .from('trusted_persons')
    .select('id, invitation_status, relationship_status, is_active, name, access_level')
    .eq('user_id', ownerId)
    .eq('linked_user_id', viewerId)
    .single()

  if (relationshipError || !relationship) {
    return {
      allowed: false,
      trustedPerson: null,
      errorCode: 'NO_RELATIONSHIP',
      details: 'Sie wurden nicht als Vertrauensperson für diesen Benutzer hinzugefügt.',
    }
  }

  if (relationship.invitation_status !== 'accepted') {
    return {
      allowed: false,
      trustedPerson: null,
      errorCode: 'INVITATION_PENDING',
      details: `Die Einladung hat den Status: ${relationship.invitation_status}.`,
    }
  }

  if (!relationship.is_active || relationship.relationship_status === 'revoked') {
    return {
      allowed: false,
      trustedPerson: null,
      errorCode: 'RELATIONSHIP_INACTIVE',
      details: 'Der Zugriff wurde vom Besitzer deaktiviert.',
    }
  }

  if (relationship.relationship_status !== 'active') {
    return {
      allowed: false,
      trustedPerson: {
        id: relationship.id,
        name: relationship.name,
        access_level: relationship.access_level,
        relationship_status: relationship.relationship_status,
      },
      errorCode: 'SETUP_INCOMPLETE',
      details: 'Die sichere Verknuepfung ist noch nicht abgeschlossen.',
    }
  }

  if (!canTrustedPersonPerformAction(relationship.access_level, action)) {
    return {
      allowed: false,
      trustedPerson: {
        id: relationship.id,
        name: relationship.name,
        access_level: relationship.access_level,
        relationship_status: relationship.relationship_status,
      },
      errorCode: 'ACCESS_LEVEL_DENIED',
      details: 'Ihr Zugriff erlaubt diese Aktion nicht.',
    }
  }

  return {
    allowed: true,
    trustedPerson: {
      id: relationship.id,
      name: relationship.name,
      access_level: relationship.access_level,
      relationship_status: relationship.relationship_status,
    },
  }
}
