export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Document categories as defined in the concept
export type DocumentCategory =
  | 'identitaet'      // Identität
  | 'finanzen'        // Finanzen
  | 'versicherungen'  // Versicherungen
  | 'wohnen'          // Wohnen
  | 'gesundheit'      // Gesundheit
  | 'vertraege'       // Verträge
  | 'rente'           // Rente & Pension
  | 'familie'         // Familie
  | 'arbeit'          // Arbeit
  | 'religion'        // Religion
  | 'bevollmaechtigungen' // Bevollmächtigungen
  | 'testament'       // Testament
  | 'sonstige'        // Sonstige

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, {
  name: string
  description: string
  examples: string[]
  icon: string
}> = {
  identitaet: {
    name: 'Identität',
    description: 'Persönliche Ausweisdokumente und Nachweise',
    examples: ['Personalausweis', 'Reisepass', 'Geburtsurkunde', 'Heiratsurkunde', 'Führerschein'],
    icon: 'user',
  },
  finanzen: {
    name: 'Finanzen',
    description: 'Bankkonten, Anlagen und Vermögensübersichten',
    examples: ['Kontoauszüge', 'Depotübersicht', 'Sparverträge', 'Kreditverträge', 'Steuerbescheide'],
    icon: 'wallet',
  },
  versicherungen: {
    name: 'Versicherungen',
    description: 'Alle Versicherungspolicen und Verträge',
    examples: ['Krankenversicherung', 'Lebensversicherung', 'Haftpflicht', 'Hausrat', 'KFZ-Versicherung'],
    icon: 'shield',
  },
  wohnen: {
    name: 'Wohnen',
    description: 'Miet- oder Eigentumsunterlagen',
    examples: ['Mietvertrag', 'Grundbuchauszug', 'Kaufvertrag', 'Nebenkostenabrechnungen', 'Hausordnung'],
    icon: 'home',
  },
  gesundheit: {
    name: 'Gesundheit',
    description: 'Medizinische Unterlagen und Vorsorgedokumente',
    examples: ['Impfpass', 'Arztbriefe', 'Medikamentenliste', 'Allergieausweis', 'Patientenverfügung'],
    icon: 'heart-pulse',
  },
  vertraege: {
    name: 'Verträge',
    description: 'Laufende Verträge und Abonnements',
    examples: ['Handyvertrag', 'Stromvertrag', 'Internet', 'Zeitschriften-Abos', 'Mitgliedschaften'],
    icon: 'file-text',
  },
  rente: {
    name: 'Rente & Pension',
    description: 'Altersvorsorge und Rentenbescheide',
    examples: ['Rentenbescheid', 'Betriebsrente', 'Riester-Verträge', 'Private Altersvorsorge'],
    icon: 'landmark',
  },
  familie: {
    name: 'Familie',
    description: 'Familiendokumente und Urkunden',
    examples: ['Geburtsurkunden', 'Heiratsurkunde', 'Scheidungsurteil', 'Sorgerechtsdokumente', 'Stammbuch'],
    icon: 'users',
  },
  arbeit: {
    name: 'Arbeit',
    description: 'Berufliche Unterlagen und Zeugnisse',
    examples: ['Arbeitsvertrag', 'Arbeitszeugnisse', 'Gehaltsabrechnungen', 'Weiterbildungen', 'Kündigungen'],
    icon: 'briefcase',
  },
  religion: {
    name: 'Religion',
    description: 'Dokumente zur Religionszugehörigkeit',
    examples: ['Taufurkunde', 'Konfirmationsurkunde', 'Kirchenaustrittbescheinigung', 'Mitgliedsbescheinigung'],
    icon: 'church',
  },
  bevollmaechtigungen: {
    name: 'Vollmachten',
    description: 'Vollmachten und rechtliche Vertretungen',
    examples: ['Vorsorgevollmacht', 'Bankvollmacht', 'Generalvollmacht', 'Betreuungsvollmacht', 'Patientenverfügung'],
    icon: 'file-signature',
  },
  testament: {
    name: 'Testament',
    description: 'Testamente und Erbschaftsdokumente',
    examples: ['Letzter Wille', 'Erbvertrag', 'Testamentsvollstrecker', 'Erbschein'],
    icon: 'scroll',
  },
  sonstige: {
    name: 'Sonstige',
    description: 'Weitere Dokumente ohne spezielle Kategorie',
    examples: ['Verschiedene Dokumente', 'Temporäre Ablage'],
    icon: 'folder',
  },
}

// Metadata field definitions per category
export interface MetadataFieldDefinition {
  key: string
  name?: string // alias for key, for backwards compatibility
  label: string
  type: 'text' | 'date' | 'select'
  options?: string[]
  required?: boolean
}

export const CATEGORY_METADATA_FIELDS: Partial<Record<DocumentCategory, MetadataFieldDefinition[]>> = {
  identitaet: [],
  finanzen: [],
  versicherungen: [],
  wohnen: [],
  gesundheit: [],
  vertraege: [],
  rente: [],
  familie: [],
  arbeit: [],
  religion: [],
  bevollmaechtigungen: [
    { key: 'bevollmaechtigter', label: 'Bevollmächtigter', type: 'text', required: true },
    { key: 'ausstellungsdatum', label: 'Ausstellungsdatum', type: 'date', required: true },
    { key: 'gueltig_bis', label: 'Gültig bis', type: 'date' },
    { key: 'art_der_vollmacht', label: 'Art der Vollmacht', type: 'select', required: true, options: ['Vorsorgevollmacht', 'Bankvollmacht', 'Generalvollmacht', 'Betreuungsvollmacht'] },
  ],
  testament: [],
}

// Custom category interface for user-created categories
export interface CustomCategory {
  id: string
  created_at: string
  user_id: string
  name: string
  description: string | null
  icon: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          full_name: string | null
          phone: string | null
          date_of_birth: string | null
          address: string | null
          onboarding_completed: boolean
          onboarding_progress: string | null
          storage_used: number
          email_reminders_enabled: boolean
          email_reminder_days_before: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          subscription_status: string | null
          subscription_current_period_end: string | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          sms_reminders_enabled: boolean
          sms_reminder_days_before: number
          phone_verified: boolean
          profile_picture_url: string | null
          upgrade_email_7d_sent_at: string | null
          upgrade_email_30d_sent_at: string | null
          role: string
          phone_encrypted: boolean
          address_encrypted: boolean
          date_of_birth_encrypted: boolean
          two_factor_secret_encrypted: boolean
          health_data_consent_granted: boolean
          health_data_consent_timestamp: string | null
          first_name: string | null
          middle_name: string | null
          last_name: string | null
          academic_title: string | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          full_name?: string | null
          phone?: string | null
          date_of_birth?: string | null
          address?: string | null
          onboarding_completed?: boolean
          onboarding_progress?: string | null
          storage_used?: number
          email_reminders_enabled?: boolean
          email_reminder_days_before?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          subscription_status?: string | null
          subscription_current_period_end?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          sms_reminders_enabled?: boolean
          sms_reminder_days_before?: number
          phone_verified?: boolean
          profile_picture_url?: string | null
          upgrade_email_7d_sent_at?: string | null
          upgrade_email_30d_sent_at?: string | null
          role?: string
          phone_encrypted?: boolean
          address_encrypted?: boolean
          date_of_birth_encrypted?: boolean
          two_factor_secret_encrypted?: boolean
          health_data_consent_granted?: boolean
          health_data_consent_timestamp?: string | null
          first_name?: string | null
          middle_name?: string | null
          last_name?: string | null
          academic_title?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          date_of_birth?: string | null
          address?: string | null
          onboarding_completed?: boolean
          onboarding_progress?: string | null
          storage_used?: number
          email_reminders_enabled?: boolean
          email_reminder_days_before?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          subscription_status?: string | null
          subscription_current_period_end?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          sms_reminders_enabled?: boolean
          sms_reminder_days_before?: number
          phone_verified?: boolean
          profile_picture_url?: string | null
          upgrade_email_7d_sent_at?: string | null
          upgrade_email_30d_sent_at?: string | null
          role?: string
          phone_encrypted?: boolean
          address_encrypted?: boolean
          date_of_birth_encrypted?: boolean
          two_factor_secret_encrypted?: boolean
          health_data_consent_granted?: boolean
          health_data_consent_timestamp?: string | null
          first_name?: string | null
          middle_name?: string | null
          last_name?: string | null
          academic_title?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          category: DocumentCategory
          title: string
          notes: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          expiry_date: string | null
          reminder_date: string | null
          subcategory_id: string | null
          custom_reminder_days: number | null
          custom_category_id: string | null
          reminder_watcher_id: string | null
          reminder_watcher_notified_at: string | null
          metadata: Record<string, string> | null
          is_encrypted: boolean
          encryption_version: string | null
          wrapped_dek: string | null
          file_iv: string | null
          title_encrypted: string | null
          notes_encrypted: string | null
          file_name_encrypted: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          category: DocumentCategory
          title: string
          notes?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          expiry_date?: string | null
          reminder_date?: string | null
          subcategory_id?: string | null
          custom_reminder_days?: number | null
          custom_category_id?: string | null
          reminder_watcher_id?: string | null
          reminder_watcher_notified_at?: string | null
          metadata?: Record<string, string> | null
          is_encrypted?: boolean
          encryption_version?: string | null
          wrapped_dek?: string | null
          file_iv?: string | null
          title_encrypted?: string | null
          notes_encrypted?: string | null
          file_name_encrypted?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          category?: DocumentCategory
          title?: string
          notes?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          expiry_date?: string | null
          reminder_date?: string | null
          subcategory_id?: string | null
          custom_reminder_days?: number | null
          custom_category_id?: string | null
          reminder_watcher_id?: string | null
          reminder_watcher_notified_at?: string | null
          metadata?: Record<string, string> | null
          is_encrypted?: boolean
          encryption_version?: string | null
          wrapped_dek?: string | null
          file_iv?: string | null
          title_encrypted?: string | null
          notes_encrypted?: string | null
          file_name_encrypted?: string | null
        }
      }
      subcategories: {
        Row: {
          id: string
          created_at: string
          user_id: string
          parent_category: string
          name: string
          icon: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          parent_category: string
          name: string
          icon?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          parent_category?: string
          name?: string
          icon?: string
        }
      }
      trusted_persons: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          name: string
          email: string
          phone: string | null
          relationship: string
          access_level: 'immediate' | 'emergency' | 'after_confirmation'
          access_delay_hours: number
          notes: string | null
          is_active: boolean
          invitation_token: string | null
          invitation_status: 'pending' | 'sent' | 'accepted' | 'declined' | null
          invitation_sent_at: string | null
          invitation_accepted_at: string | null
          linked_user_id: string | null
          email_sent_at: string | null
          email_error: string | null
          email_retry_count: number
          email_status: 'pending' | 'sending' | 'sent' | 'failed' | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          name: string
          email: string
          phone?: string | null
          relationship: string
          access_level?: 'immediate' | 'emergency' | 'after_confirmation'
          access_delay_hours?: number
          notes?: string | null
          is_active?: boolean
          invitation_token?: string | null
          invitation_status?: 'pending' | 'sent' | 'accepted' | 'declined' | null
          invitation_sent_at?: string | null
          invitation_accepted_at?: string | null
          linked_user_id?: string | null
          email_sent_at?: string | null
          email_error?: string | null
          email_retry_count?: number
          email_status?: 'pending' | 'sending' | 'sent' | 'failed' | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          name?: string
          email?: string
          phone?: string | null
          relationship?: string
          access_level?: 'immediate' | 'emergency' | 'after_confirmation'
          access_delay_hours?: number
          notes?: string | null
          is_active?: boolean
          invitation_token?: string | null
          invitation_status?: 'pending' | 'sent' | 'accepted' | 'declined' | null
          invitation_sent_at?: string | null
          invitation_accepted_at?: string | null
          linked_user_id?: string | null
          email_sent_at?: string | null
          email_error?: string | null
          email_retry_count?: number
          email_status?: 'pending' | 'sending' | 'sent' | 'failed' | null
        }
      }
      email_retry_queue: {
        Row: {
          id: string
          trusted_person_id: string
          retry_count: number
          last_error: string | null
          next_retry_at: string
          created_at: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
        }
        Insert: {
          id?: string
          trusted_person_id: string
          retry_count?: number
          last_error?: string | null
          next_retry_at: string
          created_at?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
        }
        Update: {
          id?: string
          trusted_person_id?: string
          retry_count?: number
          last_error?: string | null
          next_retry_at?: string
          created_at?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
        }
      }
      reminders: {
        Row: {
          id: string
          created_at: string
          user_id: string
          document_id: string | null
          title: string
          description: string | null
          due_date: string
          is_completed: boolean
          reminder_type: 'document_expiry' | 'annual_review' | 'custom'
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          document_id?: string | null
          title: string
          description?: string | null
          due_date: string
          is_completed?: boolean
          reminder_type?: 'document_expiry' | 'annual_review' | 'custom'
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          document_id?: string | null
          title?: string
          description?: string | null
          due_date?: string
          is_completed?: boolean
          reminder_type?: 'document_expiry' | 'annual_review' | 'custom'
        }
      }
      onboarding_feedback: {
        Row: {
          id: string
          user_id: string | null
          step_name: string
          clarity_rating: number
          was_helpful: boolean | null
          comments: string | null
          time_spent_seconds: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          step_name: string
          clarity_rating: number
          was_helpful?: boolean | null
          comments?: string | null
          time_spent_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          step_name?: string
          clarity_rating?: number
          was_helpful?: boolean | null
          comments?: string | null
          time_spent_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      download_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          created_at: string
          expires_at: string
          used_at: string | null
          recipient_name: string | null
          recipient_email: string | null
          link_type: 'view' | 'download'
          created_ip: string | null
          access_count: number
          last_accessed_at: string | null
          last_accessed_ip: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          created_at?: string
          expires_at: string
          used_at?: string | null
          recipient_name?: string | null
          recipient_email?: string | null
          link_type?: 'view' | 'download'
          created_ip?: string | null
          access_count?: number
          last_accessed_at?: string | null
          last_accessed_ip?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          recipient_name?: string | null
          recipient_email?: string | null
          link_type?: 'view' | 'download'
          created_ip?: string | null
          access_count?: number
          last_accessed_at?: string | null
          last_accessed_ip?: string | null
        }
      }
      rate_limits: {
        Row: {
          id: string
          identifier: string
          endpoint: string
          window_start: string
          request_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          identifier: string
          endpoint: string
          window_start: string
          request_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          identifier?: string
          endpoint?: string
          window_start?: string
          request_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      auth_lockouts: {
        Row: {
          id: string
          email: string
          locked_at: string
          unlocked_at: string | null
          reason: string | null
        }
        Insert: {
          id?: string
          email: string
          locked_at?: string
          unlocked_at?: string | null
          reason?: string | null
        }
        Update: {
          id?: string
          email?: string
          locked_at?: string
          unlocked_at?: string | null
          reason?: string | null
        }
      }
      consent_ledger: {
        Row: {
          id: string
          user_id: string
          consent_type: string
          granted: boolean
          version: string
          timestamp: string
        }
        Insert: {
          id?: string
          user_id: string
          consent_type: string
          granted: boolean
          version: string
          timestamp?: string
        }
        Update: {
          id?: string
          user_id?: string
          consent_type?: string
          granted?: boolean
          version?: string
          timestamp?: string
        }
      }
      security_audit_log: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          event_data: Record<string, unknown> | null
          ip_address: string | null
          user_agent: string | null
          timestamp: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          event_data?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
          timestamp?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: string
          event_data?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
          timestamp?: string
        }
      }
      medical_info: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          conditions: string | null
          medications: string | null
          allergies: string | null
          doctor_name: string | null
          doctor_phone: string | null
          insurance_number: string | null
          additional_notes: string | null
          organ_donor: boolean | null
          organ_donor_card_location: string | null
          organ_donor_notes: string | null
          conditions_encrypted: boolean
          medications_encrypted: boolean
          allergies_encrypted: boolean
          medication_plan_updated_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          conditions?: string | null
          medications?: string | null
          allergies?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          insurance_number?: string | null
          additional_notes?: string | null
          organ_donor?: boolean | null
          organ_donor_card_location?: string | null
          organ_donor_notes?: string | null
          conditions_encrypted?: boolean
          medications_encrypted?: boolean
          allergies_encrypted?: boolean
          medication_plan_updated_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          conditions?: string | null
          medications?: string | null
          allergies?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          insurance_number?: string | null
          additional_notes?: string | null
          organ_donor?: boolean | null
          organ_donor_card_location?: string | null
          organ_donor_notes?: string | null
          conditions_encrypted?: boolean
          medications_encrypted?: boolean
          allergies_encrypted?: boolean
          medication_plan_updated_at?: string | null
        }
      }
      emergency_contacts: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          name: string
          phone: string
          email: string | null
          relationship: string
          is_primary: boolean
          notes: string | null
          phone_encrypted: boolean
          relationship_encrypted: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          name: string
          phone: string
          email?: string | null
          relationship: string
          is_primary?: boolean
          notes?: string | null
          phone_encrypted?: boolean
          relationship_encrypted?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          name?: string
          phone?: string
          email?: string | null
          relationship?: string
          is_primary?: boolean
          notes?: string | null
          phone_encrypted?: boolean
          relationship_encrypted?: boolean
        }
      }
      advance_directives: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          has_patient_decree: boolean
          patient_decree_location: string | null
          patient_decree_date: string | null
          patient_decree_document_id: string | null
          has_power_of_attorney: boolean
          power_of_attorney_location: string | null
          power_of_attorney_holder: string | null
          power_of_attorney_date: string | null
          power_of_attorney_document_id: string | null
          has_care_directive: boolean
          care_directive_location: string | null
          care_directive_date: string | null
          care_directive_document_id: string | null
          has_bank_power_of_attorney: boolean
          bank_power_of_attorney_holder: string | null
          bank_power_of_attorney_banks: string | null
          bank_power_of_attorney_document_id: string | null
          notes: string | null
          patient_decree_location_encrypted: boolean
          power_of_attorney_holder_encrypted: boolean
          care_directive_location_encrypted: boolean
          bank_power_of_attorney_holder_encrypted: boolean
          notes_encrypted: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          has_patient_decree?: boolean
          patient_decree_location?: string | null
          patient_decree_date?: string | null
          patient_decree_document_id?: string | null
          has_power_of_attorney?: boolean
          power_of_attorney_location?: string | null
          power_of_attorney_holder?: string | null
          power_of_attorney_date?: string | null
          power_of_attorney_document_id?: string | null
          has_care_directive?: boolean
          care_directive_location?: string | null
          care_directive_date?: string | null
          care_directive_document_id?: string | null
          has_bank_power_of_attorney?: boolean
          bank_power_of_attorney_holder?: string | null
          bank_power_of_attorney_banks?: string | null
          bank_power_of_attorney_document_id?: string | null
          notes?: string | null
          patient_decree_location_encrypted?: boolean
          power_of_attorney_holder_encrypted?: boolean
          care_directive_location_encrypted?: boolean
          bank_power_of_attorney_holder_encrypted?: boolean
          notes_encrypted?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          has_patient_decree?: boolean
          patient_decree_location?: string | null
          patient_decree_date?: string | null
          patient_decree_document_id?: string | null
          has_power_of_attorney?: boolean
          power_of_attorney_location?: string | null
          power_of_attorney_holder?: string | null
          power_of_attorney_date?: string | null
          power_of_attorney_document_id?: string | null
          has_care_directive?: boolean
          care_directive_location?: string | null
          care_directive_date?: string | null
          care_directive_document_id?: string | null
          has_bank_power_of_attorney?: boolean
          bank_power_of_attorney_holder?: string | null
          bank_power_of_attorney_banks?: string | null
          bank_power_of_attorney_document_id?: string | null
          notes?: string | null
          patient_decree_location_encrypted?: boolean
          power_of_attorney_holder_encrypted?: boolean
          care_directive_location_encrypted?: boolean
          bank_power_of_attorney_holder_encrypted?: boolean
          notes_encrypted?: boolean
        }
      }
      funeral_wishes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          burial_type: string | null
          burial_location: string | null
          ceremony_type: string | null
          ceremony_wishes: string | null
          music_wishes: string | null
          flowers_wishes: string | null
          additional_wishes: string | null
          has_funeral_insurance: boolean
          funeral_insurance_provider: string | null
          funeral_insurance_number: string | null
          burial_location_encrypted: boolean
          ceremony_wishes_encrypted: boolean
          music_wishes_encrypted: boolean
          flowers_wishes_encrypted: boolean
          additional_wishes_encrypted: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          burial_type?: string | null
          burial_location?: string | null
          ceremony_type?: string | null
          ceremony_wishes?: string | null
          music_wishes?: string | null
          flowers_wishes?: string | null
          additional_wishes?: string | null
          has_funeral_insurance?: boolean
          funeral_insurance_provider?: string | null
          funeral_insurance_number?: string | null
          burial_location_encrypted?: boolean
          ceremony_wishes_encrypted?: boolean
          music_wishes_encrypted?: boolean
          flowers_wishes_encrypted?: boolean
          additional_wishes_encrypted?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          burial_type?: string | null
          burial_location?: string | null
          ceremony_type?: string | null
          ceremony_wishes?: string | null
          music_wishes?: string | null
          flowers_wishes?: string | null
          additional_wishes?: string | null
          has_funeral_insurance?: boolean
          funeral_insurance_provider?: string | null
          funeral_insurance_number?: string | null
          burial_location_encrypted?: boolean
          ceremony_wishes_encrypted?: boolean
          music_wishes_encrypted?: boolean
          flowers_wishes_encrypted?: boolean
          additional_wishes_encrypted?: boolean
        }
      }
      user_vault_keys: {
        Row: {
          id: string
          user_id: string
          kdf_salt: string
          kdf_params: Json
          wrapped_mk: string
          wrapped_mk_with_recovery: string
          recovery_key_salt: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kdf_salt: string
          kdf_params: Json
          wrapped_mk: string
          wrapped_mk_with_recovery: string
          recovery_key_salt?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kdf_salt?: string
          kdf_params?: Json
          wrapped_mk?: string
          wrapped_mk_with_recovery?: string
          recovery_key_salt?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      document_relationship_keys: {
        Row: {
          id: string
          owner_id: string
          trusted_person_id: string
          wrapped_rk: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          trusted_person_id: string
          wrapped_rk: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          trusted_person_id?: string
          wrapped_rk?: string
          created_at?: string
        }
      }
      document_share_tokens: {
        Row: {
          id: string
          document_id: string
          owner_id: string
          trusted_person_id: string
          wrapped_dek_for_tp: string
          created_at: string
          expires_at: string | null
          permission: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          document_id: string
          owner_id: string
          trusted_person_id: string
          wrapped_dek_for_tp: string
          created_at?: string
          expires_at?: string | null
          permission?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          document_id?: string
          owner_id?: string
          trusted_person_id?: string
          wrapped_dek_for_tp?: string
          created_at?: string
          expires_at?: string | null
          permission?: string
          revoked_at?: string | null
        }
      }
      vaccinations: {
        Row: {
          id: string
          user_id: string
          name: string
          is_standard: boolean
          month: number | null
          year: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          is_standard?: boolean
          month?: number | null
          year?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          is_standard?: boolean
          month?: number | null
          year?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      download_link_documents: {
        Row: {
          id: string
          download_token_id: string
          document_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          download_token_id: string
          document_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          download_token_id?: string
          document_id?: string
          created_at?: string | null
        }
      }
      download_link_wrapped_deks: {
        Row: {
          id: string
          download_token_id: string
          document_id: string
          wrapped_dek_for_share: string
          file_iv: string
          file_name_encrypted: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          download_token_id: string
          document_id: string
          wrapped_dek_for_share: string
          file_iv: string
          file_name_encrypted?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          download_token_id?: string
          document_id?: string
          wrapped_dek_for_share?: string
          file_iv?: string
          file_name_encrypted?: string | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

// Document metadata for family/VP document viewing
export interface DocumentMetadata {
  id: string
  title: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  category: string
  subcategory: string | null
  expiry_date: string | null
  notes: string | null
  created_at: string
  streamToken: string | null
  metadata?: Record<string, string> | null
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Document = Database['public']['Tables']['documents']['Row'] & {
  subcategory?: Subcategory | null
  custom_category?: CustomCategory | null
}
export type TrustedPerson = Database['public']['Tables']['trusted_persons']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type DownloadToken = Database['public']['Tables']['download_tokens']['Row']
export type EmailRetryQueue = Database['public']['Tables']['email_retry_queue']['Row']
export type OnboardingFeedback = Database['public']['Tables']['onboarding_feedback']['Row']
export type RateLimit = Database['public']['Tables']['rate_limits']['Row']
export type AuthLockout = Database['public']['Tables']['auth_lockouts']['Row']
export type ConsentLedger = Database['public']['Tables']['consent_ledger']['Row']
export type SecurityAuditLog = Database['public']['Tables']['security_audit_log']['Row']
export type MedicalInfo = Database['public']['Tables']['medical_info']['Row']
export type EmergencyContact = Database['public']['Tables']['emergency_contacts']['Row']
export type AdvanceDirective = Database['public']['Tables']['advance_directives']['Row']
export type FuneralWishes = Database['public']['Tables']['funeral_wishes']['Row']
export type UserVaultKey = Database['public']['Tables']['user_vault_keys']['Row']
export type DocumentRelationshipKey = Database['public']['Tables']['document_relationship_keys']['Row']
export type DocumentShareToken = Database['public']['Tables']['document_share_tokens']['Row']
export type Vaccination = Database['public']['Tables']['vaccinations']['Row']
export type DownloadLinkDocument = Database['public']['Tables']['download_link_documents']['Row']
export type DownloadLinkWrappedDek = Database['public']['Tables']['download_link_wrapped_deks']['Row']

// Subcategory for folder structure
export interface Subcategory {
  id: string
  created_at: string
  user_id: string
  parent_category: DocumentCategory
  name: string
  icon: string
}
