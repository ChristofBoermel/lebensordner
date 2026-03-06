import { describe, expect, it } from 'vitest'
import { guardTrustedPersonAccess } from '@/lib/security/trusted-person-guard'

function createAdminClient(record: any, error: any = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({ data: record, error }),
          }),
        }),
      }),
    }),
  }
}

describe('guardTrustedPersonAccess', () => {
  it('denies missing relationship', async () => {
    const result = await guardTrustedPersonAccess(createAdminClient(null, { message: 'not found' }), 'owner', 'viewer', 'view')
    expect(result.allowed).toBe(false)
    expect(result.errorCode).toBe('NO_RELATIONSHIP')
  })

  it('denies insufficient access level for download', async () => {
    const result = await guardTrustedPersonAccess(
      createAdminClient({ id: 'tp1', invitation_status: 'accepted', is_active: true, name: 'TP', access_level: 'emergency' }),
      'owner',
      'viewer',
      'download'
    )
    expect(result.allowed).toBe(false)
    expect(result.errorCode).toBe('ACCESS_LEVEL_DENIED')
  })

  it('allows immediate download', async () => {
    const result = await guardTrustedPersonAccess(
      createAdminClient({ id: 'tp1', invitation_status: 'accepted', is_active: true, name: 'TP', access_level: 'immediate' }),
      'owner',
      'viewer',
      'download'
    )
    expect(result.allowed).toBe(true)
    expect(result.trustedPerson?.id).toBe('tp1')
  })
})
