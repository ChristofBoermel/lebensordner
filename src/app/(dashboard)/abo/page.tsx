'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CreditCard, Check, X, Loader2, AlertTriangle, CheckCircle2,
  Calendar, Shield, FileText, Users, HardDrive, Crown, Sparkles, Star
} from 'lucide-react'
import { SUBSCRIPTION_TIERS, getActiveTiers, type SubscriptionTier, type TierConfig } from '@/lib/subscription-tiers'
import { TrustBadges } from '@/components/upgrade/TrustBadges'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'

interface SubscriptionInfo {
  status: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  price_id: string | null
}

interface StripePriceIds {
  basic: { monthly: string; yearly: string }
  premium: { monthly: string; yearly: string }
  family: { monthly: string; yearly: string }
}

// Map feature keys to human-readable German descriptions
const FEATURE_LABELS: Record<string, string> = {
  twoFactorAuth: 'Zwei-Faktor-Authentifizierung',
  emailReminders: 'E-Mail-Erinnerungen',
  documentExpiry: 'Dokument-Ablaufdatum',
  prioritySupport: 'Prioritäts-Support',
  smsNotifications: 'SMS-Benachrichtigungen',
  familyDashboard: 'Familien-Dashboard',
  customCategories: 'Eigene Kategorien',
}

export default function AboPage() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')
  // Handle upgrade context from tier-guard redirects
  const upgradeFeature = searchParams.get('upgrade')
  // Backward compatibility: support old param names
  const legacyRequired = searchParams.get('required')
  const legacyTier = searchParams.get('tier')

  // Determine the feature that triggered the upgrade redirect
  const requiredFeature = upgradeFeature || legacyRequired
  const requiredFeatureLabel = requiredFeature ? FEATURE_LABELS[requiredFeature] || requiredFeature : null

  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [priceIds, setPriceIds] = useState<StripePriceIds | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const { capture } = usePostHog()

  // Track page view
  useEffect(() => {
    capture(ANALYTICS_EVENTS.PRICING_PAGE_VIEWED)
  }, [capture])

  // Fetch Stripe price IDs from API
  useEffect(() => {
    async function fetchPriceIds() {
      try {
        const response = await fetch('/api/stripe/prices')
        const data = await response.json()
        setPriceIds(data)
      } catch (err) {
        console.error('Failed to fetch price IDs:', err)
      }
    }
    fetchPriceIds()
  }, [])

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true)
    try {
      const userResult = await supabase.auth.getUser()
      const user = userResult?.data?.user
      if (!user) return

      const result = await supabase
        .from('profiles')
        .select('subscription_status, subscription_current_period_end, stripe_customer_id, stripe_price_id')
        .eq('id', user.id)
        .single()

      const data = result?.data
      if (data) {
        setSubscription({
          status: data.subscription_status,
          current_period_end: data.subscription_current_period_end,
          stripe_customer_id: data.stripe_customer_id,
          price_id: data.stripe_price_id
        })
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchSubscription() }, [fetchSubscription])

  // Refetch after successful checkout
  useEffect(() => {
    if (success) {
      // Wait a bit for webhook to process
      const timer = setTimeout(() => {
        fetchSubscription()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [success, fetchSubscription])

  const getPriceId = (tierId: SubscriptionTier, period: 'monthly' | 'yearly'): string => {
    if (!priceIds) return ''

    switch (tierId) {
      case 'basic':
        return period === 'monthly' ? priceIds.basic.monthly : priceIds.basic.yearly
      case 'premium':
        return period === 'monthly' ? priceIds.premium.monthly : priceIds.premium.yearly
      default:
        return ''
    }
  }

  const handleSubscribe = async (tier: TierConfig) => {
    if (tier.id === 'free') return

    setIsProcessing(tier.id)
    setError(null)

    try {
      const priceId = getPriceId(tier.id, billingPeriod)

      if (!priceId) {
        throw new Error('Preis nicht konfiguriert')
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setIsProcessing(null)
    }
  }

  const handleManageSubscription = async () => {
    setIsProcessing('manage')
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setIsProcessing(null)
    }
  }

  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'trialing'

  // Determine current tier based on price ID
  // This mirrors the server-side getTierFromSubscription logic exactly
  const getCurrentTier = (): SubscriptionTier => {
    const status = subscription?.status ?? null

    // No status or canceled → free (matches server logic)
    if (!status || status === 'canceled') return 'free'

    // Only active/trialing subscriptions continue
    const isActiveOrTrialing = status === 'active' || status === 'trialing'
    if (!isActiveOrTrialing) return 'free'

    // If priceIds not loaded yet, return 'basic' as safe temporary fallback
    if (!priceIds) return 'basic'

    const priceId = subscription?.price_id ?? null

    // Check basic tier price IDs
    if (priceId === priceIds.basic.monthly || priceId === priceIds.basic.yearly) return 'basic'

    // Check premium tier price IDs
    if (priceId === priceIds.premium.monthly || priceId === priceIds.premium.yearly) return 'premium'

    // Family tier price IDs are treated as premium tier for feature access
    if (priceId === priceIds.family.monthly || priceId === priceIds.family.yearly) return 'premium'

    // Null or unknown price_id with active subscription → basic (matches server logic)
    if (!priceId) {

      return 'basic'
    }

    // Unrecognized price_id → basic (matches server logic)
    console.warn(`Unrecognized price ID: ${priceId}, defaulting to basic tier`)
    return 'basic'
  }

  const currentTier = getCurrentTier()

  const getPrice = (tier: TierConfig) => {
    if (tier.priceMonthly === 0) return 'Kostenlos'
    if (billingPeriod === 'yearly') {
      const monthlyEquivalent = tier.priceYearly / 12
      return `${monthlyEquivalent.toFixed(2).replace('.', ',')} €`
    }
    return `${tier.priceMonthly.toFixed(2).replace('.', ',')} €`
  }

  const getSavings = (tier: TierConfig) => {
    if (tier.priceMonthly === 0) return null
    const yearlyMonthly = tier.priceYearly / 12
    const savings = ((tier.priceMonthly - yearlyMonthly) / tier.priceMonthly) * 100
    return Math.round(savings)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  // Feature comparison data - synced with SUBSCRIPTION_TIERS constants
  const featureComparison = [
    { name: 'Dokumente', free: '10', basic: '50', premium: 'Unbegrenzt' },
    { name: 'Speicherplatz', free: '100 MB', basic: '500 MB', premium: '4 GB' },
    { name: 'Vertrauenspersonen', free: '1', basic: '3', premium: '5' },
    { name: 'Ordner', free: '3', basic: '10', premium: 'Unbegrenzt' },
    { name: 'E-Mail-Erinnerungen', free: false, basic: true, premium: true },
    { name: 'Dokument-Ablaufdatum', free: false, basic: true, premium: true },
    { name: 'Eigene Kategorien', free: false, basic: '5', premium: 'Unbegrenzt' },
    { name: 'Zwei-Faktor-Auth', free: false, basic: false, premium: true },
    { name: 'Prioritäts-Support', free: false, basic: false, premium: true },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header - Senior friendly */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900">
          Welcher Tarif passt zu Ihnen?
        </h1>
        <p className="text-xl text-warmgray-600 max-w-2xl mx-auto">
          Alle Tarife sind transparent und fair. Sie können jederzeit wechseln oder kündigen.
        </p>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <CheckCircle2 className="w-5 h-5" />
          <span>Vielen Dank! Ihr Abonnement wurde erfolgreich aktiviert.</span>
        </div>
      )}

      {canceled && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          <span>Der Bezahlvorgang wurde abgebrochen.</span>
        </div>
      )}

      {requiredFeature && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
          <Crown className="w-5 h-5" />
          <span>
            <strong>{requiredFeatureLabel || 'Diese Funktion'}</strong> erfordert ein Upgrade.
            Wählen Sie unten einen passenden Tarif.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Current Subscription Status */}
      {isSubscribed && (
        <Card className="border-sage-200 bg-sage-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sage-600 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-warmgray-900">
                    {subscription?.status === 'trialing'
                      ? 'Testphase aktiv'
                      : `${SUBSCRIPTION_TIERS[currentTier].name} aktiv`}
                  </p>
                  {subscription?.current_period_end && (
                    <p className="text-sm text-warmgray-600">
                      {subscription.status === 'trialing' ? 'Testphase endet' : 'Nächste Zahlung'}: {new Date(subscription.current_period_end).toLocaleDateString('de-DE')}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" onClick={handleManageSubscription} disabled={isProcessing === 'manage'}>
                {isProcessing === 'manage' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Abo verwalten
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Period Toggle */}
      <div className="flex justify-center">
        <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as 'monthly' | 'yearly')}>
          <TabsList className="grid w-[300px] grid-cols-2">
            <TabsTrigger value="monthly">Monatlich</TabsTrigger>
            <TabsTrigger value="yearly" className="relative">
              Jährlich
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-green-500 text-white">
                -17%
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Pricing Cards - Senior friendly with larger text */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {getActiveTiers().map((tier) => {
          const isCurrent = tier.id === currentTier
          const savings = getSavings(tier)
          const tierFeatures = featureComparison.map(f => ({
            name: f.name,
            value: tier.id === 'free' ? f.free : tier.id === 'basic' ? f.basic : f.premium,
          }))

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${tier.highlighted
                ? 'border-2 border-sage-500 shadow-xl scale-[1.02]'
                : 'border-warmgray-200'
                } ${isCurrent ? 'ring-2 ring-sage-300' : ''}`}
            >
              {/* Badges */}
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-full bg-sage-600 text-white shadow-lg">
                    <Star className="w-4 h-4 fill-current" />
                    Empfohlen
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-warmgray-800 text-white">
                    Ihr aktueller Tarif
                  </span>
                </div>
              )}

              <CardHeader className="pb-4 pt-8">
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-base">
                  {tier.id === 'free' && 'Für den Start'}
                  {tier.id === 'basic' && 'Für Einzelpersonen'}
                  {tier.id === 'premium' && 'Für umfassenden Schutz'}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col space-y-5">
                {/* Price Display */}
                <div className="pb-4 border-b border-warmgray-200">
                  {tier.priceMonthly === 0 ? (
                    <span className="text-4xl font-bold text-warmgray-900">Kostenlos</span>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-warmgray-900">{getPrice(tier)}</span>
                        <span className="text-lg text-warmgray-500">/ Monat</span>
                      </div>
                      {billingPeriod === 'yearly' && (
                        <p className="text-base text-warmgray-600 mt-1">
                          {tier.priceYearly.toFixed(0).replace('.', ',')} € pro Jahr
                        </p>
                      )}
                      {billingPeriod === 'yearly' && savings && savings > 0 && (
                        <p className="text-base text-green-600 font-medium mt-1">
                          Sie sparen {savings}% gegenüber monatlich
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Features List with Check/X */}
                <ul className="space-y-3 flex-1">
                  {tierFeatures.map((feature, idx) => {
                    const hasFeature = feature.value !== false
                    return (
                      <li key={idx} className="flex items-start gap-3">
                        {hasFeature ? (
                          <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <X className="w-5 h-5 text-warmgray-300 mt-0.5 flex-shrink-0" />
                        )}
                        <span className={`text-base ${hasFeature ? 'text-warmgray-700' : 'text-warmgray-400'}`}>
                          {feature.name}
                          {typeof feature.value === 'string' && hasFeature && (
                            <span className="font-medium text-warmgray-900"> ({feature.value})</span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA Button */}
                <Button
                  className={`w-full text-lg py-6 ${tier.highlighted ? 'shadow-md' : ''}`}
                  size="lg"
                  variant={tier.highlighted ? 'default' : 'outline'}
                  disabled={
                    isCurrent ||
                    tier.id === 'free' ||
                    isProcessing === tier.id ||
                    (!['free'].includes(tier.id) && !getPriceId(tier.id as Exclude<SubscriptionTier, 'free'>, billingPeriod))
                  }
                  onClick={() => {
                    capture(ANALYTICS_EVENTS.CHECKOUT_STARTED, { tier: tier.id, billing_period: billingPeriod })
                    handleSubscribe(tier)
                  }}
                >
                  {isProcessing === tier.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  {isCurrent
                    ? 'Ihr aktueller Tarif'
                    : tier.id === 'free'
                      ? 'Kostenlos starten'
                      : '30 Tage kostenlos testen'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Trust Badges */}
      <TrustBadges className="max-w-2xl mx-auto" />

      {/* FAQ Section - Senior friendly with larger text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Häufige Fragen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-lg font-medium text-warmgray-900">Kann ich jederzeit kündigen?</h4>
            <p className="text-base text-warmgray-600 mt-2">
              Ja, Sie können Ihr Abonnement jederzeit kündigen. Sie behalten den Zugang bis zum Ende des aktuellen Abrechnungszeitraums. Es gibt keine versteckten Kosten oder Mindestlaufzeiten.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium text-warmgray-900">Was passiert mit meinen Daten nach der Kündigung?</h4>
            <p className="text-base text-warmgray-600 mt-2">
              Ihre Daten bleiben 30 Tage nach der Kündigung erhalten, sodass Sie genug Zeit haben, alles herunterzuladen. Danach werden sie sicher gelöscht.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium text-warmgray-900">Kann ich zwischen Tarifen wechseln?</h4>
            <p className="text-base text-warmgray-600 mt-2">
              Ja, Sie können jederzeit upgraden oder zu einem günstigeren Tarif wechseln. Beim Upgrade wird nur der anteilige Betrag berechnet.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium text-warmgray-900">Welche Zahlungsmethoden werden akzeptiert?</h4>
            <p className="text-base text-warmgray-600 mt-2">
              Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express) sowie SEPA-Lastschrift für bequeme Abbuchung von Ihrem Bankkonto.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-medium text-warmgray-900">Wie funktioniert die 30-Tage-Testphase?</h4>
            <p className="text-base text-warmgray-600 mt-2">
              Sie können jeden kostenpflichtigen Tarif 30 Tage lang kostenlos testen. Wenn Sie nicht zufrieden sind, kündigen Sie einfach vor Ablauf der Testphase – es entstehen keine Kosten.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Final reassurance */}
      <div className="text-center py-6 border-t border-warmgray-200">
        <p className="text-lg text-warmgray-600 flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-sage-500" />
          Sie können jederzeit wechseln oder kündigen. Keine versteckten Kosten.
        </p>
      </div>

      {/* Debug Panel - Only visible in development */}
      {process.env.NODE_ENV === 'development' && subscription && (
        <details className="mt-8 p-4 bg-warmgray-100 rounded-lg text-sm">
          <summary className="cursor-pointer font-medium text-warmgray-700 mb-2">
            Debug: Subscription Details
          </summary>
          <div className="mt-3 space-y-2 font-mono text-xs">
            <p>Status: <span className="text-warmgray-500">{subscription.status || 'null'}</span></p>
            <p>Price ID: <span className="text-warmgray-500">{subscription.price_id || 'null'}</span></p>
            <p>Customer ID: <span className="text-warmgray-500">{subscription.stripe_customer_id || 'null'}</span></p>
            <p>Period End: <span className="text-warmgray-500">{subscription.current_period_end || 'null'}</span></p>
            <p>Detected Tier: <span className="text-warmgray-500">{currentTier}</span></p>
            <p>Tier Name: <span className="text-warmgray-500">{SUBSCRIPTION_TIERS[currentTier].name}</span></p>
            {priceIds && (
              <div className="mt-2 pt-2 border-t border-warmgray-300">
                <p className="text-warmgray-500 mb-1">Known Price IDs:</p>
                <p>Basic Monthly: {priceIds.basic.monthly || 'not set'}</p>
                <p>Basic Yearly: {priceIds.basic.yearly || 'not set'}</p>
                <p>Premium Monthly: {priceIds.premium.monthly || 'not set'}</p>
                <p>Premium Yearly: {priceIds.premium.yearly || 'not set'}</p>
                <p>Family Monthly: {priceIds.family.monthly || 'not set'}</p>
                <p>Family Yearly: {priceIds.family.yearly || 'not set'}</p>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-warmgray-300">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSubscription}
                className="text-xs"
              >
                Refresh Subscription Data
              </Button>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
