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
export type Document = Database['public']['Tables']['documents']['Row']
export type TrustedPerson = Database['public']['Tables']['trusted_persons']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
