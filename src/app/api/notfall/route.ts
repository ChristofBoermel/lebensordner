import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { encrypt, decrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'

// --- Encryption helpers ---

function encryptField(value: string | null | undefined, key: string): string | null {
  if (!value) return null
  return JSON.stringify(encrypt(value, key))
}

function decryptField(value: string | null | undefined, isEncrypted: boolean, key: string): string | null {
  if (!value) return null
  if (!isEncrypted) return value
  try {
    const parsed: EncryptedData = JSON.parse(value)
    return decrypt(parsed, key)
  } catch (e) {
    console.error('Failed to decrypt field:', e)
    return null
  }
}

function encryptArray(arr: string[] | null | undefined, key: string): string | null {
  if (!arr || arr.length === 0) return null
  return JSON.stringify(encrypt(JSON.stringify(arr), key))
}

function decryptArray(value: string | null | undefined, isEncrypted: boolean, key: string): string[] {
  if (!value) return []
  if (!isEncrypted) {
    // Original format: stored as postgres array, returned as string[]
    if (Array.isArray(value)) return value
    try { return JSON.parse(value) } catch { return [] }
  }
  try {
    const parsed: EncryptedData = JSON.parse(value)
    const decrypted = decrypt(parsed, key)
    return JSON.parse(decrypted)
  } catch (e) {
    console.error('Failed to decrypt array field:', e)
    return []
  }
}

function encryptMedicalInfo(data: any, key: string) {
  return {
    conditions: encryptArray(data.conditions, key),
    conditions_encrypted: !!(data.conditions?.length),
    medications: encryptArray(data.medications, key),
    medications_encrypted: !!(data.medications?.length),
    allergies: encryptArray(data.allergies, key),
    allergies_encrypted: !!(data.allergies?.length),
    blood_type: encryptField(data.blood_type, key),
    blood_type_encrypted: !!data.blood_type,
  }
}

function decryptMedicalInfo(data: any, key: string) {
  return {
    ...data,
    conditions: decryptArray(data.conditions, data.conditions_encrypted, key),
    medications: decryptArray(data.medications, data.medications_encrypted, key),
    allergies: decryptArray(data.allergies, data.allergies_encrypted, key),
    blood_type: decryptField(data.blood_type, data.blood_type_encrypted, key) || '',
  }
}

function encryptEmergencyContact(contact: any, key: string) {
  return {
    phone: encryptField(contact.phone, key),
    phone_encrypted: !!contact.phone,
    relationship: encryptField(contact.relationship, key),
    relationship_encrypted: !!contact.relationship,
  }
}

function decryptEmergencyContact(contact: any, key: string) {
  return {
    ...contact,
    phone: decryptField(contact.phone, contact.phone_encrypted, key) || '',
    relationship: decryptField(contact.relationship, contact.relationship_encrypted, key) || '',
  }
}

function encryptDirective(directive: any, key: string) {
  return {
    patient_decree_location: encryptField(directive.patient_decree_location, key),
    patient_decree_location_encrypted: !!directive.patient_decree_location,
    power_of_attorney_holder: encryptField(directive.power_of_attorney_holder, key),
    power_of_attorney_holder_encrypted: !!directive.power_of_attorney_holder,
    care_directive_location: encryptField(directive.care_directive_location, key),
    care_directive_location_encrypted: !!directive.care_directive_location,
    bank_power_of_attorney_holder: encryptField(directive.bank_power_of_attorney_holder, key),
    bank_power_of_attorney_holder_encrypted: !!directive.bank_power_of_attorney_holder,
    notes: encryptField(directive.notes, key),
    notes_encrypted: !!directive.notes,
  }
}

function decryptDirective(directive: any, key: string) {
  return {
    ...directive,
    patient_decree_location: decryptField(directive.patient_decree_location, directive.patient_decree_location_encrypted, key) || '',
    power_of_attorney_holder: decryptField(directive.power_of_attorney_holder, directive.power_of_attorney_holder_encrypted, key) || '',
    care_directive_location: decryptField(directive.care_directive_location, directive.care_directive_location_encrypted, key) || '',
    bank_power_of_attorney_holder: decryptField(directive.bank_power_of_attorney_holder, directive.bank_power_of_attorney_holder_encrypted, key) || '',
    notes: decryptField(directive.notes, directive.notes_encrypted, key) || '',
  }
}

function encryptFuneralWishes(wishes: any, key: string) {
  return {
    burial_location: encryptField(wishes.burial_location, key),
    burial_location_encrypted: !!wishes.burial_location,
    ceremony_wishes: encryptField(wishes.ceremony_wishes, key),
    ceremony_wishes_encrypted: !!wishes.ceremony_wishes,
    music_wishes: encryptField(wishes.music_wishes, key),
    music_wishes_encrypted: !!wishes.music_wishes,
    flowers_wishes: encryptField(wishes.flowers_wishes, key),
    flowers_wishes_encrypted: !!wishes.flowers_wishes,
    additional_wishes: encryptField(wishes.additional_wishes, key),
    additional_wishes_encrypted: !!wishes.additional_wishes,
  }
}

function decryptFuneralWishes(wishes: any, key: string) {
  return {
    ...wishes,
    burial_location: decryptField(wishes.burial_location, wishes.burial_location_encrypted, key) || '',
    ceremony_wishes: decryptField(wishes.ceremony_wishes, wishes.ceremony_wishes_encrypted, key) || '',
    music_wishes: decryptField(wishes.music_wishes, wishes.music_wishes_encrypted, key) || '',
    flowers_wishes: decryptField(wishes.flowers_wishes, wishes.flowers_wishes_encrypted, key) || '',
    additional_wishes: decryptField(wishes.additional_wishes, wishes.additional_wishes_encrypted, key) || '',
  }
}

// --- Route handlers ---

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const key = getEncryptionKey()

    const [contactsRes, medicalRes, directivesRes, funeralRes] = await Promise.all([
      supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false }),
      supabase
        .from('medical_info')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('advance_directives')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('funeral_wishes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const emergencyContacts = contactsRes.data
      ? contactsRes.data.map((c: any) => decryptEmergencyContact(c, key))
      : []

    const medicalInfo = medicalRes.data
      ? decryptMedicalInfo(medicalRes.data, key)
      : null

    const directives = directivesRes.data
      ? decryptDirective(directivesRes.data, key)
      : null

    const funeralWishes = funeralRes.data
      ? decryptFuneralWishes(funeralRes.data, key)
      : null

    return NextResponse.json({
      emergencyContacts,
      medicalInfo,
      directives,
      funeralWishes,
    })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Notfall GET error:', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Notfalldaten' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const key = getEncryptionKey()

    const body = await request.json()
    const { medicalInfo, emergencyContacts, directives, funeralWishes } = body

    // Save medical info
    if (medicalInfo !== undefined) {
      const encryptedFields = encryptMedicalInfo(medicalInfo, key)
      const medicalData = {
        user_id: user.id,
        ...encryptedFields,
        doctor_name: medicalInfo.doctor_name || null,
        doctor_phone: medicalInfo.doctor_phone || null,
        insurance_number: medicalInfo.insurance_number || null,
        additional_notes: medicalInfo.additional_notes || null,
        organ_donor: medicalInfo.organ_donor,
        organ_donor_card_location: medicalInfo.organ_donor_card_location || null,
        organ_donor_notes: medicalInfo.organ_donor_notes || null,
      }

      if (medicalInfo.id) {
        const { error } = await supabase
          .from('medical_info')
          .update(medicalData)
          .eq('id', medicalInfo.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('medical_info')
          .insert(medicalData)
        if (error) throw error
      }
    }

    // Save emergency contacts
    if (emergencyContacts !== undefined) {
      for (const contact of emergencyContacts) {
        const encryptedFields = encryptEmergencyContact(contact, key)
        const contactData = {
          user_id: user.id,
          name: contact.name,
          ...encryptedFields,
          email: contact.email || null,
          is_primary: contact.is_primary,
          notes: contact.notes || null,
        }

        if (contact.id) {
          const { error } = await supabase
            .from('emergency_contacts')
            .update(contactData)
            .eq('id', contact.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('emergency_contacts')
            .insert(contactData)
          if (error) throw error
        }
      }
    }

    // Save directives
    if (directives !== undefined) {
      const encryptedFields = encryptDirective(directives, key)
      const directiveData = {
        user_id: user.id,
        ...encryptedFields,
        has_patient_decree: directives.has_patient_decree,
        patient_decree_date: directives.patient_decree_date || null,
        patient_decree_document_id: directives.patient_decree_document_id || null,
        has_power_of_attorney: directives.has_power_of_attorney,
        power_of_attorney_location: directives.power_of_attorney_location || null,
        power_of_attorney_date: directives.power_of_attorney_date || null,
        power_of_attorney_document_id: directives.power_of_attorney_document_id || null,
        has_care_directive: directives.has_care_directive,
        care_directive_date: directives.care_directive_date || null,
        care_directive_document_id: directives.care_directive_document_id || null,
        has_bank_power_of_attorney: directives.has_bank_power_of_attorney,
        bank_power_of_attorney_banks: directives.bank_power_of_attorney_banks || null,
        bank_power_of_attorney_document_id: directives.bank_power_of_attorney_document_id || null,
      }

      if (directives.id) {
        const { error } = await supabase
          .from('advance_directives')
          .update(directiveData)
          .eq('id', directives.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('advance_directives')
          .insert(directiveData)
        if (error) throw error
      }
    }

    // Save funeral wishes
    if (funeralWishes !== undefined) {
      const encryptedFields = encryptFuneralWishes(funeralWishes, key)
      const funeralData = {
        user_id: user.id,
        ...encryptedFields,
        burial_type: funeralWishes.burial_type || null,
        ceremony_type: funeralWishes.ceremony_type || null,
        has_funeral_insurance: funeralWishes.has_funeral_insurance,
        funeral_insurance_provider: funeralWishes.funeral_insurance_provider || null,
        funeral_insurance_number: funeralWishes.funeral_insurance_number || null,
      }

      if (funeralWishes.id) {
        const { error } = await supabase
          .from('funeral_wishes')
          .update(funeralData)
          .eq('id', funeralWishes.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('funeral_wishes')
          .insert(funeralData)
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Notfall PUT error:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Notfalldaten' }, { status: 500 })
  }
}
