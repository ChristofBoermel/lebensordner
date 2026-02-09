import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { decrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'
import { logSecurityEvent, EVENT_GDPR_EXPORT_REQUESTED } from '@/lib/security/audit-log'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const key = getEncryptionKey()

    const [
      profileResult,
      documentsResult,
      consentResult,
      auditResult,
      trustedPersonsResult,
      remindersResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      supabase
        .from('documents')
        .select('id, title, category, file_name, file_size, created_at, expiry_date, metadata')
        .eq('user_id', user.id),
      supabase
        .from('consent_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false }),
      supabase
        .from('security_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false }),
      supabase
        .from('trusted_persons')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id),
    ])

    // Decrypt sensitive profile fields
    const profileData = profileResult.data
    if (profileData) {
      // Decrypt phone
      if (profileData.phone && profileData.phone_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(profileData.phone)
          profileData.phone = decrypt(parsed, key)
        } catch (e) {
          console.error('GDPR export: Failed to decrypt phone:', e)
          profileData.phone = null
        }
      }

      // Decrypt address
      if (profileData.address && profileData.address_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(profileData.address)
          profileData.address = decrypt(parsed, key)
        } catch (e) {
          console.error('GDPR export: Failed to decrypt address:', e)
          profileData.address = null
        }
      }

      // Decrypt date_of_birth
      if (profileData.date_of_birth && profileData.date_of_birth_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(profileData.date_of_birth)
          profileData.date_of_birth = decrypt(parsed, key)
        } catch (e) {
          console.error('GDPR export: Failed to decrypt date_of_birth:', e)
          profileData.date_of_birth = null
        }
      }

      // Remove encryption flag fields and sensitive secrets from export
      delete profileData.phone_encrypted
      delete profileData.address_encrypted
      delete profileData.date_of_birth_encrypted
      delete profileData.two_factor_secret
      delete profileData.two_factor_secret_encrypted
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const exportData = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      profile: profileData || null,
      documents: documentsResult.data || [],
      consent_history: consentResult.data || [],
      security_audit_log: auditResult.data || [],
      trusted_persons: trustedPersonsResult.data || [],
      reminders: remindersResult.data || [],
    }

    const jsonString = JSON.stringify(exportData, null, 2)

    // Log GDPR export event non-blockingly
    logSecurityEvent({
      event_type: EVENT_GDPR_EXPORT_REQUESTED,
      user_id: user.id,
      request,
    }).catch(() => {})

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="lebensordner-data-${user.id}-${timestamp}.json"`,
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('GDPR export error:', error)
    return NextResponse.json({ error: 'Fehler beim Exportieren der Daten' }, { status: 500 })
  }
}
