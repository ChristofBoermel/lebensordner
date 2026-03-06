import { canTrustedPersonPerformAction } from '@/lib/security/trusted-person-access'

export interface TrustedPersonRecord {
  id: string
  name: string | null
  access_level: string | null
}

export interface TrustedPersonGuardResult {
  allowed: boolean
  trustedPerson: TrustedPersonRecord | null
  errorCode?:
    | 'NO_RELATIONSHIP'
    | 'INVITATION_PENDING'
    | 'RELATIONSHIP_INACTIVE'
    | 'ACCESS_LEVEL_DENIED'
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
    .select('id, invitation_status, is_active, name, access_level')
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

  if (!relationship.is_active) {
    return {
      allowed: false,
      trustedPerson: null,
      errorCode: 'RELATIONSHIP_INACTIVE',
      details: 'Der Zugriff wurde vom Besitzer deaktiviert.',
    }
  }

  if (!canTrustedPersonPerformAction(relationship.access_level, action)) {
    return {
      allowed: false,
      trustedPerson: {
        id: relationship.id,
        name: relationship.name,
        access_level: relationship.access_level,
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
    },
  }
}
