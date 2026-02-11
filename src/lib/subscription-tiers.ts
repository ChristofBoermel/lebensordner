// Subscription tier configuration
export type SubscriptionTier = 'free' | 'basic' | 'premium'

// Active tiers shown in the UI
export const ACTIVE_TIERS: SubscriptionTier[] = ['free', 'basic', 'premium']

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
    maxSubcategories: number // -1 = unlimited
    maxCustomCategories: number // -1 = unlimited
    emailReminders: boolean
    documentExpiry: boolean
    twoFactorAuth: boolean
    prioritySupport: boolean
    familyMembers: number
    // New feature flags
    smsNotifications: boolean
    familyDashboard: boolean
    customCategories: boolean
  }
  highlighted?: boolean
  badge?: string
  deprecated?: boolean
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
    // Family tier uses premium features - these price IDs should map to premium tier
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
      '3 Ordner',
      'Basis-Dashboard',
    ],
    limits: {
      maxDocuments: 10,
      maxStorageMB: 100,
      maxTrustedPersons: 0,
      maxSubcategories: 3,
      maxCustomCategories: 0,
      emailReminders: false,
      documentExpiry: false,
      twoFactorAuth: false,
      prioritySupport: false,
      familyMembers: 0,
      smsNotifications: false,
      familyDashboard: false,
      customCategories: false,
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
      '10 Ordner',
      '5 Eigene Kategorien',
      'E-Mail-Erinnerungen',
      'Dokument-Ablaufdatum',
      'Familien-Dashboard', // Added
    ],
    limits: {
      maxDocuments: 50,
      maxStorageMB: 500,
      maxTrustedPersons: 3,
      maxSubcategories: 10,
      maxCustomCategories: 5,
      emailReminders: true,
      documentExpiry: true,
      twoFactorAuth: false,
      prioritySupport: false,
      familyMembers: 0,
      smsNotifications: false,
      familyDashboard: true, // Changed to true
      customCategories: true,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Voller Schutz',
    priceMonthly: 11.90,
    priceYearly: 119,
    features: [
      'Unbegrenzte Dokumente',
      '4 GB Speicherplatz', // Changed from 10 GB to 4 GB
      '5 Vertrauenspersonen',
      'Unbegrenzte Unterordner',
      'Unbegrenzte Kategorien',
      'E-Mail-Erinnerungen',
      'Dokument-Ablaufdatum',
      'Zwei-Faktor-Auth',
      'Prioritäts-Support',
      'Familien-Dashboard',
      'SMS-Benachrichtigungen',
    ],
    limits: {
      maxDocuments: -1, // unlimited
      maxStorageMB: 4096, // Changed from 10240 (10GB) to 4096 (4GB)
      maxTrustedPersons: 5,
      maxSubcategories: -1, // unlimited
      maxCustomCategories: -1, // unlimited
      emailReminders: true,
      documentExpiry: true,
      twoFactorAuth: true,
      prioritySupport: true,
      familyMembers: 0,
      smsNotifications: true,
      familyDashboard: true,
      customCategories: true,
    },
    highlighted: true,
    badge: 'Beliebt',
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
  const normalizedPriceId = priceId?.toLowerCase()
  const normalizedPriceIds = {
    basic: {
      monthly: priceIds.basic.monthly?.toLowerCase(),
      yearly: priceIds.basic.yearly?.toLowerCase(),
    },
    premium: {
      monthly: priceIds.premium.monthly?.toLowerCase(),
      yearly: priceIds.premium.yearly?.toLowerCase(),
    },
    family: {
      monthly: priceIds.family.monthly?.toLowerCase(),
      yearly: priceIds.family.yearly?.toLowerCase(),
    },
  }

  // Check basic tier price IDs
  if (
    normalizedPriceId === normalizedPriceIds.basic.monthly ||
    normalizedPriceId === normalizedPriceIds.basic.yearly
  ) {
    return SUBSCRIPTION_TIERS.basic
  }

  // Check premium tier price IDs
  if (
    normalizedPriceId === normalizedPriceIds.premium.monthly ||
    normalizedPriceId === normalizedPriceIds.premium.yearly
  ) {
    return SUBSCRIPTION_TIERS.premium
  }

  // Family tier price IDs are treated as premium tier for feature access
  // This allows family plan subscribers to have full premium features
  if (
    normalizedPriceId === normalizedPriceIds.family.monthly ||
    normalizedPriceId === normalizedPriceIds.family.yearly
  ) {
    return SUBSCRIPTION_TIERS.premium
  }

  // If subscription is active but priceId is missing or unrecognized,
  // default to basic tier (safe default to prevent over-granting permissions)
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    if (!priceId) {
      // Silent fallback to basic tier
      return SUBSCRIPTION_TIERS.basic
    }
    // Unrecognized priceId with active subscription - default to basic
    // Silent fallback to basic tier
    return SUBSCRIPTION_TIERS.basic
  }

  return SUBSCRIPTION_TIERS.free
}

// Check if user has access to a specific feature flag
export function hasFeatureAccess(
  tier: TierConfig,
  feature: keyof TierConfig['limits']
): boolean {
  return !!tier.limits[feature]
}

// Check if user can perform action based on tier limits
export function canPerformAction(
  tier: TierConfig,
  action: 'uploadDocument' | 'addTrustedPerson' | 'use2FA' | 'useEmailReminders' | 'addSubcategory' | 'addCustomCategory',
  currentCount?: number
): boolean {
  switch (action) {
    case 'uploadDocument':
      if (tier.limits.maxDocuments === -1) return true
      return (currentCount || 0) < tier.limits.maxDocuments
    case 'addTrustedPerson':
      return (currentCount || 0) < tier.limits.maxTrustedPersons
    case 'addSubcategory':
      if (tier.limits.maxSubcategories === -1) return true
      return (currentCount || 0) < tier.limits.maxSubcategories
    case 'addCustomCategory':
      if (tier.limits.maxCustomCategories === -1) return true
      return (currentCount || 0) < tier.limits.maxCustomCategories
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

// Get active tiers for display (excludes deprecated)
export function getActiveTiers(): TierConfig[] {
  return ACTIVE_TIERS.map(id => SUBSCRIPTION_TIERS[id])
}

// Check if owner's tier allows document downloads for family members
export function allowsFamilyDownloads(tier: TierConfig): boolean {
  return tier.id === 'premium'
}

// Get tier display information
export function getTierDisplayInfo(tier: TierConfig): {
  name: string
  color: string
  badge: string
  viewOnly: boolean
} {
  switch (tier.id) {
    case 'premium':
      return { name: 'Premium', color: 'text-purple-600', badge: 'bg-purple-100', viewOnly: false }
    case 'basic':
      return { name: 'Basis', color: 'text-blue-600', badge: 'bg-blue-100', viewOnly: true }
    default:
      return { name: 'Kostenlos', color: 'text-gray-600', badge: 'bg-gray-100', viewOnly: false }
  }
}

// Get the download link type based on tier
export function getDownloadLinkType(tier: TierConfig): 'view' | 'download' | null {
  switch (tier.id) {
    case 'premium':
      return 'download'
    case 'basic':
      return 'view'
    default:
      return null
  }
}

// Check if user can create download links
export function canCreateDownloadLinks(tier: TierConfig): boolean {
  return tier.id === 'basic' || tier.id === 'premium'
}
