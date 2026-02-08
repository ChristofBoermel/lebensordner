/**
 * Migration script to encrypt existing plaintext PII data.
 *
 * Usage:
 *   npx tsx scripts/encrypt-existing-data.ts              # dry-run (default)
 *   npx tsx scripts/encrypt-existing-data.ts --execute     # actually encrypt
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ENCRYPTION_KEY
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// --- Encryption utilities (duplicated to keep script standalone) ---

interface EncryptedData {
  iv: string
  authTag: string
  ciphertext: string
}

function encrypt(plaintext: string, key: string): EncryptedData {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  const encrypted = cipher.update(plaintext, 'utf8', 'base64') + cipher.final('base64')
  const authTag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted,
  }
}

// --- Configuration ---

const DRY_RUN = !process.argv.includes('--execute')
const BATCH_SIZE = 100

// --- Supabase client ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const encryptionKey = process.env.ENCRYPTION_KEY

if (!supabaseUrl || !supabaseServiceKey || !encryptionKey) {
  console.error('Missing required environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

if (encryptionKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(encryptionKey)) {
  console.error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// --- Helpers ---

function encryptField(value: string | null): string | null {
  if (!value) return null
  return JSON.stringify(encrypt(value, encryptionKey!))
}

function encryptArray(arr: any): string | null {
  if (!arr || (Array.isArray(arr) && arr.length === 0)) return null
  const strValue = Array.isArray(arr) ? JSON.stringify(arr) : String(arr)
  return JSON.stringify(encrypt(strValue, encryptionKey!))
}

// --- Migration functions ---

async function migrateProfiles() {
  console.log('\n=== Migrating profiles ===')

  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .or('phone_encrypted.eq.false,address_encrypted.eq.false,date_of_birth_encrypted.eq.false,two_factor_secret_encrypted.eq.false')

  console.log(`Found ${count ?? 0} profiles to migrate`)

  let offset = 0
  let migrated = 0

  while (true) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, phone, address, date_of_birth, two_factor_secret, phone_encrypted, address_encrypted, date_of_birth_encrypted, two_factor_secret_encrypted')
      .or('phone_encrypted.eq.false,address_encrypted.eq.false,date_of_birth_encrypted.eq.false,two_factor_secret_encrypted.eq.false')
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error('Error fetching profiles:', error.message)
      break
    }

    if (!profiles || profiles.length === 0) break

    for (const profile of profiles) {
      const updateData: Record<string, any> = {}

      if (!profile.phone_encrypted && profile.phone) {
        updateData.phone = encryptField(profile.phone)
        updateData.phone_encrypted = true
      }

      if (!profile.address_encrypted && profile.address) {
        updateData.address = encryptField(profile.address)
        updateData.address_encrypted = true
      }

      if (!profile.date_of_birth_encrypted && profile.date_of_birth) {
        updateData.date_of_birth = encryptField(profile.date_of_birth)
        updateData.date_of_birth_encrypted = true
      }

      if (!profile.two_factor_secret_encrypted && profile.two_factor_secret) {
        updateData.two_factor_secret = encryptField(profile.two_factor_secret)
        updateData.two_factor_secret_encrypted = true
      }

      if (Object.keys(updateData).length > 0) {
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would encrypt profile ${profile.id}: ${Object.keys(updateData).filter(k => !k.endsWith('_encrypted')).join(', ')}`)
        } else {
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', profile.id)

          if (updateError) {
            console.error(`  Error encrypting profile ${profile.id}:`, updateError.message)
          } else {
            console.log(`  Encrypted profile ${profile.id} (${migrated + 1}/${count})`)
          }
        }
        migrated++
      }
    }

    offset += BATCH_SIZE
  }

  console.log(`Profiles migration: ${migrated} records ${DRY_RUN ? 'would be' : ''} encrypted`)
}

async function migrateMedicalInfo() {
  console.log('\n=== Migrating medical_info ===')

  const { data: records, error } = await supabase
    .from('medical_info')
    .select('*')

  if (error) {
    console.error('Error fetching medical_info:', error.message)
    return
  }

  if (!records || records.length === 0) {
    console.log('No medical_info records to migrate')
    return
  }

  let migrated = 0

  for (const record of records) {
    // Skip already encrypted records
    if (record.conditions_encrypted && record.medications_encrypted &&
        record.allergies_encrypted && record.blood_type_encrypted) {
      continue
    }

    const updateData: Record<string, any> = {}

    if (!record.conditions_encrypted && record.conditions) {
      updateData.conditions = encryptArray(record.conditions)
      updateData.conditions_encrypted = true
    }
    if (!record.medications_encrypted && record.medications) {
      updateData.medications = encryptArray(record.medications)
      updateData.medications_encrypted = true
    }
    if (!record.allergies_encrypted && record.allergies) {
      updateData.allergies = encryptArray(record.allergies)
      updateData.allergies_encrypted = true
    }
    if (!record.blood_type_encrypted && record.blood_type) {
      updateData.blood_type = encryptField(record.blood_type)
      updateData.blood_type_encrypted = true
    }

    if (Object.keys(updateData).length > 0) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would encrypt medical_info ${record.id}: ${Object.keys(updateData).filter(k => !k.endsWith('_encrypted')).join(', ')}`)
      } else {
        const { error: updateError } = await supabase
          .from('medical_info')
          .update(updateData)
          .eq('id', record.id)

        if (updateError) {
          console.error(`  Error encrypting medical_info ${record.id}:`, updateError.message)
        } else {
          console.log(`  Encrypted medical_info ${record.id}`)
        }
      }
      migrated++
    }
  }

  console.log(`medical_info migration: ${migrated} records ${DRY_RUN ? 'would be' : ''} encrypted`)
}

async function migrateEmergencyContacts() {
  console.log('\n=== Migrating emergency_contacts ===')

  const { data: records, error } = await supabase
    .from('emergency_contacts')
    .select('*')

  if (error) {
    console.error('Error fetching emergency_contacts:', error.message)
    return
  }

  if (!records || records.length === 0) {
    console.log('No emergency_contacts records to migrate')
    return
  }

  let migrated = 0

  for (const record of records) {
    if (record.phone_encrypted && record.relationship_encrypted) continue

    const updateData: Record<string, any> = {}

    if (!record.phone_encrypted && record.phone) {
      updateData.phone = encryptField(record.phone)
      updateData.phone_encrypted = true
    }
    if (!record.relationship_encrypted && record.relationship) {
      updateData.relationship = encryptField(record.relationship)
      updateData.relationship_encrypted = true
    }

    if (Object.keys(updateData).length > 0) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would encrypt emergency_contact ${record.id}: ${Object.keys(updateData).filter(k => !k.endsWith('_encrypted')).join(', ')}`)
      } else {
        const { error: updateError } = await supabase
          .from('emergency_contacts')
          .update(updateData)
          .eq('id', record.id)

        if (updateError) {
          console.error(`  Error encrypting emergency_contact ${record.id}:`, updateError.message)
        } else {
          console.log(`  Encrypted emergency_contact ${record.id}`)
        }
      }
      migrated++
    }
  }

  console.log(`emergency_contacts migration: ${migrated} records ${DRY_RUN ? 'would be' : ''} encrypted`)
}

async function migrateAdvanceDirectives() {
  console.log('\n=== Migrating advance_directives ===')

  const { data: records, error } = await supabase
    .from('advance_directives')
    .select('*')

  if (error) {
    console.error('Error fetching advance_directives:', error.message)
    return
  }

  if (!records || records.length === 0) {
    console.log('No advance_directives records to migrate')
    return
  }

  let migrated = 0

  for (const record of records) {
    if (record.patient_decree_location_encrypted && record.power_of_attorney_holder_encrypted &&
        record.care_directive_location_encrypted && record.bank_power_of_attorney_holder_encrypted &&
        record.notes_encrypted) {
      continue
    }

    const updateData: Record<string, any> = {}

    if (!record.patient_decree_location_encrypted && record.patient_decree_location) {
      updateData.patient_decree_location = encryptField(record.patient_decree_location)
      updateData.patient_decree_location_encrypted = true
    }
    if (!record.power_of_attorney_holder_encrypted && record.power_of_attorney_holder) {
      updateData.power_of_attorney_holder = encryptField(record.power_of_attorney_holder)
      updateData.power_of_attorney_holder_encrypted = true
    }
    if (!record.care_directive_location_encrypted && record.care_directive_location) {
      updateData.care_directive_location = encryptField(record.care_directive_location)
      updateData.care_directive_location_encrypted = true
    }
    if (!record.bank_power_of_attorney_holder_encrypted && record.bank_power_of_attorney_holder) {
      updateData.bank_power_of_attorney_holder = encryptField(record.bank_power_of_attorney_holder)
      updateData.bank_power_of_attorney_holder_encrypted = true
    }
    if (!record.notes_encrypted && record.notes) {
      updateData.notes = encryptField(record.notes)
      updateData.notes_encrypted = true
    }

    if (Object.keys(updateData).length > 0) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would encrypt advance_directive ${record.id}: ${Object.keys(updateData).filter(k => !k.endsWith('_encrypted')).join(', ')}`)
      } else {
        const { error: updateError } = await supabase
          .from('advance_directives')
          .update(updateData)
          .eq('id', record.id)

        if (updateError) {
          console.error(`  Error encrypting advance_directive ${record.id}:`, updateError.message)
        } else {
          console.log(`  Encrypted advance_directive ${record.id}`)
        }
      }
      migrated++
    }
  }

  console.log(`advance_directives migration: ${migrated} records ${DRY_RUN ? 'would be' : ''} encrypted`)
}

async function migrateFuneralWishes() {
  console.log('\n=== Migrating funeral_wishes ===')

  const { data: records, error } = await supabase
    .from('funeral_wishes')
    .select('*')

  if (error) {
    console.error('Error fetching funeral_wishes:', error.message)
    return
  }

  if (!records || records.length === 0) {
    console.log('No funeral_wishes records to migrate')
    return
  }

  let migrated = 0

  for (const record of records) {
    if (record.burial_location_encrypted && record.ceremony_wishes_encrypted &&
        record.music_wishes_encrypted && record.flowers_wishes_encrypted &&
        record.additional_wishes_encrypted) {
      continue
    }

    const updateData: Record<string, any> = {}

    if (!record.burial_location_encrypted && record.burial_location) {
      updateData.burial_location = encryptField(record.burial_location)
      updateData.burial_location_encrypted = true
    }
    if (!record.ceremony_wishes_encrypted && record.ceremony_wishes) {
      updateData.ceremony_wishes = encryptField(record.ceremony_wishes)
      updateData.ceremony_wishes_encrypted = true
    }
    if (!record.music_wishes_encrypted && record.music_wishes) {
      updateData.music_wishes = encryptField(record.music_wishes)
      updateData.music_wishes_encrypted = true
    }
    if (!record.flowers_wishes_encrypted && record.flowers_wishes) {
      updateData.flowers_wishes = encryptField(record.flowers_wishes)
      updateData.flowers_wishes_encrypted = true
    }
    if (!record.additional_wishes_encrypted && record.additional_wishes) {
      updateData.additional_wishes = encryptField(record.additional_wishes)
      updateData.additional_wishes_encrypted = true
    }

    if (Object.keys(updateData).length > 0) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would encrypt funeral_wishes ${record.id}: ${Object.keys(updateData).filter(k => !k.endsWith('_encrypted')).join(', ')}`)
      } else {
        const { error: updateError } = await supabase
          .from('funeral_wishes')
          .update(updateData)
          .eq('id', record.id)

        if (updateError) {
          console.error(`  Error encrypting funeral_wishes ${record.id}:`, updateError.message)
        } else {
          console.log(`  Encrypted funeral_wishes ${record.id}`)
        }
      }
      migrated++
    }
  }

  console.log(`funeral_wishes migration: ${migrated} records ${DRY_RUN ? 'would be' : ''} encrypted`)
}

// --- Main ---

async function main() {
  console.log('=================================')
  console.log('PII Encryption Migration Script')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'EXECUTE (writing changes)'}`)
  console.log('=================================')

  if (!DRY_RUN) {
    console.log('\nWARNING: This will encrypt data in-place. Ensure you have a backup.')
    console.log('Starting in 5 seconds...\n')
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  await migrateProfiles()
  await migrateMedicalInfo()
  await migrateEmergencyContacts()
  await migrateAdvanceDirectives()
  await migrateFuneralWishes()

  console.log('\n=================================')
  console.log('Migration complete!')
  if (DRY_RUN) {
    console.log('This was a dry run. Use --execute to apply changes.')
  }
  console.log('=================================')
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
