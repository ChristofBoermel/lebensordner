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
  sonstige: {
    name: 'Sonstige',
    description: 'Weitere Dokumente ohne spezielle Kategorie',
    examples: ['Verschiedene Dokumente', 'Temporäre Ablage'],
    icon: 'folder',
  },
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
          storage_used: number
          email_reminders_enabled: boolean
          email_reminder_days_before: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_current_period_end: string | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          sms_reminders_enabled: boolean
          sms_reminder_days_before: number
          phone_verified: boolean
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
          storage_used?: number
          email_reminders_enabled?: boolean
          email_reminder_days_before?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_current_period_end?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          sms_reminders_enabled?: boolean
          sms_reminder_days_before?: number
          phone_verified?: boolean
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
          storage_used?: number
          email_reminders_enabled?: boolean
          email_reminder_days_before?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_current_period_end?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          sms_reminders_enabled?: boolean
          sms_reminder_days_before?: number
          phone_verified?: boolean
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
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Document = Database['public']['Tables']['documents']['Row'] & {
  subcategory_id?: string | null
  subcategory?: Subcategory | null
  custom_category_id?: string | null
  custom_category?: CustomCategory | null
}
export type TrustedPerson = Database['public']['Tables']['trusted_persons']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type DownloadToken = Database['public']['Tables']['download_tokens']['Row']

// Subcategory for folder structure
export interface Subcategory {
  id: string
  created_at: string
  user_id: string
  parent_category: DocumentCategory
  name: string
  icon: string
}
