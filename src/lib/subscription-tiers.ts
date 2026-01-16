// Subscription tier configuration
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'family'

export interface TierConfig {
  id: SubscriptionTier
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  features: string[]
  limits: {
    maxDocuments: number
    maxStorageMB: number
    maxTrustedPersons: number
    emailReminders: boolean
    documentExpiry: boolean
    twoFactorAuth: boolean
    prioritySupport: boolean
    familyMembers: number
  }
  highlighted?: boolean
  badge?: string
}

// Helper to get price IDs at runtime (for server-side use)
export function getStripePriceIds() {
  return {
    basic: {
      monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || '',
    },
    premium: {
      monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || process.env.STRIPE_PRICE_ID || '',
      yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || '',
    },
    family: {
      monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_FAMILY_YEARLY || '',
    },
  }
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Kostenlos',
    description: 'Für den Einstieg',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Bis zu 10 Dokumente',
      '100 MB Speicherplatz',
      '1 Vertrauensperson',
      'Basis-Dashboard',
    ],
    limits: {
      maxDocuments: 10,
      maxStorageMB: 100,
      maxTrustedPersons: 1,
      emailReminders: false,
      documentExpiry: false,
      twoFactorAuth: false,
      prioritySupport: false,
      familyMembers: 0,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basis',
    description: 'Für Einzelpersonen',
    priceMonthly: 4.90,
    priceYearly: 49,
    features: [
      'Bis zu 50 Dokumente',
      '500 MB Speicherplatz',
      '3 Vertrauenspersonen',
      'E-Mail-Erinnerungen',
      'Dokument-Ablaufdatum',
    ],
    limits: {
      maxDocuments: 50,
      maxStorageMB: 500,
      maxTrustedPersons: 3,
      emailReminders: true,
      documentExpiry: true,
      twoFactorAuth: false,
      prioritySupport: false,
      familyMembers: 0,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Voller Schutz',
    priceMonthly: 9.90,
    priceYearly: 99,
    features: [
      'Unbegrenzte Dokumente',
      '2 GB Speicherplatz',
      '10 Vertrauenspersonen',
      'E-Mail-Erinnerungen',
      'Dokument-Ablaufdatum',
      'Zwei-Faktor-Auth',
      'Prioritäts-Support',
    ],
    limits: {
      maxDocuments: -1, // unlimited
      maxStorageMB: 2048,
      maxTrustedPersons: 10,
      emailReminders: true,
      documentExpiry: true,
      twoFactorAuth: true,
      prioritySupport: true,
      familyMembers: 0,
    },
    highlighted: true,
    badge: 'Beliebt',
  },
  family: {
    id: 'family',
    name: 'Familie',
    description: 'Für die ganze Familie',
    priceMonthly: 14.90,
    priceYearly: 149,
    features: [
      'Alles aus Premium',
      '5 GB Speicherplatz',
      'Bis zu 5 Familienmitglieder',
      'Gemeinsame Dokumente',
      'Familien-Dashboard',
    ],
    limits: {
      maxDocuments: -1,
      maxStorageMB: 5120,
      maxTrustedPersons: 20,
      emailReminders: true,
      documentExpiry: true,
      twoFactorAuth: true,
      prioritySupport: true,
      familyMembers: 5,
    },
  },
}

// Helper function to get tier by subscription status
export function getTierFromSubscription(
  subscriptionStatus: string | null,
  priceId: string | null
): TierConfig {
  if (!subscriptionStatus || subscriptionStatus === 'canceled') {
    return SUBSCRIPTION_TIERS.free
  }

  // Check price ID against known price IDs
  const priceIds = getStripePriceIds()
  
  if (priceId === priceIds.basic.monthly || priceId === priceIds.basic.yearly) {
    return SUBSCRIPTION_TIERS.basic
  }
  if (priceId === priceIds.premium.monthly || priceId === priceIds.premium.yearly) {
    return SUBSCRIPTION_TIERS.premium
  }
  if (priceId === priceIds.family.monthly || priceId === priceIds.family.yearly) {
    return SUBSCRIPTION_TIERS.family
  }

  // Default to premium for legacy subscriptions with active status
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    return SUBSCRIPTION_TIERS.premium
  }

  return SUBSCRIPTION_TIERS.free
}

// Check if user can perform action based on tier limits
export function canPerformAction(
  tier: TierConfig,
  action: 'uploadDocument' | 'addTrustedPerson' | 'use2FA' | 'useEmailReminders',
  currentCount?: number
): boolean {
  switch (action) {
    case 'uploadDocument':
      if (tier.limits.maxDocuments === -1) return true
      return (currentCount || 0) < tier.limits.maxDocuments
    case 'addTrustedPerson':
      return (currentCount || 0) < tier.limits.maxTrustedPersons
    case 'use2FA':
      return tier.limits.twoFactorAuth
    case 'useEmailReminders':
      return tier.limits.emailReminders
    default:
      return false
  }
}

// Check storage limit
export function canUploadFile(
  tier: TierConfig,
  currentStorageMB: number,
  fileSizeMB: number
): { allowed: boolean; reason?: string } {
  const maxStorage = tier.limits.maxStorageMB
  const newTotal = currentStorageMB + fileSizeMB
  
  if (newTotal > maxStorage) {
    return {
      allowed: false,
      reason: `Speicherlimit erreicht. Sie haben ${currentStorageMB.toFixed(1)} MB von ${maxStorage} MB verwendet. Upgrade für mehr Speicherplatz.`
    }
  }
  
  return { allowed: true }
}
