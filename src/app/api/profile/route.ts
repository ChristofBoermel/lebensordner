import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { encrypt, decrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const key = getEncryptionKey()

    const { data, error } = await supabase
      .from('profiles')
      .select('phone, address, date_of_birth, two_factor_secret, phone_encrypted, address_encrypted, date_of_birth_encrypted, two_factor_secret_encrypted')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    }

    const profile: Record<string, string | null> = {
      phone: null,
      address: null,
      date_of_birth: null,
      two_factor_secret: null,
    }

    // Decrypt phone
    if (data.phone) {
      if (data.phone_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(data.phone)
          profile.phone = decrypt(parsed, key)
        } catch (e) {
          console.error('Failed to decrypt phone:', e)
          profile.phone = null
        }
      } else {
        profile.phone = data.phone
      }
    }

    // Decrypt address
    if (data.address) {
      if (data.address_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(data.address)
          profile.address = decrypt(parsed, key)
        } catch (e) {
          console.error('Failed to decrypt address:', e)
          profile.address = null
        }
      } else {
        profile.address = data.address
      }
    }

    // Decrypt date_of_birth
    if (data.date_of_birth) {
      if (data.date_of_birth_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(data.date_of_birth)
          profile.date_of_birth = decrypt(parsed, key)
        } catch (e) {
          console.error('Failed to decrypt date_of_birth:', e)
          profile.date_of_birth = null
        }
      } else {
        profile.date_of_birth = data.date_of_birth
      }
    }

    // Decrypt two_factor_secret
    if (data.two_factor_secret) {
      if (data.two_factor_secret_encrypted) {
        try {
          const parsed: EncryptedData = JSON.parse(data.two_factor_secret)
          profile.two_factor_secret = decrypt(parsed, key)
        } catch (e) {
          console.error('Failed to decrypt two_factor_secret:', e)
          profile.two_factor_secret = null
        }
      } else {
        profile.two_factor_secret = data.two_factor_secret
      }
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Profils' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const key = getEncryptionKey()

    const body = await request.json()
    const { phone, address, date_of_birth, two_factor_secret } = body

    const updateData: Record<string, any> = {}

    // Encrypt phone
    if (phone) {
      const encrypted = encrypt(phone, key)
      updateData.phone = JSON.stringify(encrypted)
      updateData.phone_encrypted = true
    } else if (phone !== undefined) {
      updateData.phone = null
      updateData.phone_encrypted = false
    }

    // Encrypt address
    if (address) {
      const encrypted = encrypt(address, key)
      updateData.address = JSON.stringify(encrypted)
      updateData.address_encrypted = true
    } else if (address !== undefined) {
      updateData.address = null
      updateData.address_encrypted = false
    }

    // Encrypt date_of_birth
    if (date_of_birth) {
      const encrypted = encrypt(date_of_birth, key)
      updateData.date_of_birth = JSON.stringify(encrypted)
      updateData.date_of_birth_encrypted = true
    } else if (date_of_birth !== undefined) {
      updateData.date_of_birth = null
      updateData.date_of_birth_encrypted = false
    }

    // Encrypt two_factor_secret
    if (two_factor_secret) {
      const encrypted = encrypt(two_factor_secret, key)
      updateData.two_factor_secret = JSON.stringify(encrypted)
      updateData.two_factor_secret_encrypted = true
    } else if (two_factor_secret !== undefined) {
      updateData.two_factor_secret = null
      updateData.two_factor_secret_encrypted = false
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Profile PUT error:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern des Profils' }, { status: 500 })
  }
}
