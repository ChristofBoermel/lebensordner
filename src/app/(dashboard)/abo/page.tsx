'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CreditCard, Check, Loader2, AlertTriangle, CheckCircle2, 
  Calendar, Shield, FileText, Users, HardDrive, Crown, Sparkles
} from 'lucide-react'
import { SUBSCRIPTION_TIERS, type SubscriptionTier, type TierConfig } from '@/lib/subscription-tiers'

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

export default function AboPage() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')
  
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [priceIds, setPriceIds] = useState<StripePriceIds | null>(null)
  
  const supabase = createClient()

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_current_period_end, stripe_customer_id, stripe_price_id')
      .eq('id', user.id)
      .single()
    
    if (data) {
      setSubscription({ 
        status: data.subscription_status, 
        current_period_end: data.subscription_current_period_end, 
        stripe_customer_id: data.stripe_customer_id,
        price_id: data.stripe_price_id
      })
    }
    setIsLoading(false)
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
      case 'family':
        return period === 'monthly' ? priceIds.family.monthly : priceIds.family.yearly
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
  const getCurrentTier = (): SubscriptionTier => {
    if (!isSubscribed || !priceIds || !subscription?.price_id) return 'free'
    
    const priceId = subscription.price_id
    if (priceId === priceIds.basic.monthly || priceId === priceIds.basic.yearly) return 'basic'
    if (priceId === priceIds.premium.monthly || priceId === priceIds.premium.yearly) return 'premium'
    if (priceId === priceIds.family.monthly || priceId === priceIds.family.yearly) return 'family'
    
    // Default to premium for legacy/unknown subscriptions
    return 'premium'
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">Abonnement wählen</h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Wählen Sie den Plan, der am besten zu Ihnen passt
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
                    {subscription?.status === 'trialing' ? 'Testphase aktiv' : 'Premium aktiv'}
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

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(SUBSCRIPTION_TIERS).map((tier) => {
          const isCurrent = tier.id === currentTier
          const savings = getSavings(tier)
          
          return (
            <Card 
              key={tier.id}
              className={`relative ${
                tier.highlighted 
                  ? 'border-2 border-sage-500 shadow-lg' 
                  : 'border-warmgray-200'
              } ${isCurrent ? 'ring-2 ring-sage-300' : ''}`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-sage-600 text-white">
                    {tier.badge}
                  </span>
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-warmgray-800 text-white">
                    Aktuell
                  </span>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold text-warmgray-900">{getPrice(tier)}</span>
                  {tier.priceMonthly > 0 && (
                    <span className="text-warmgray-500 text-sm"> / Monat</span>
                  )}
                  {billingPeriod === 'yearly' && savings && savings > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {savings}% sparen (jährlich abgerechnet)
                    </p>
                  )}
                </div>

                <ul className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-sage-600 mt-0.5 flex-shrink-0" />
                      <span className="text-warmgray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={tier.highlighted ? 'default' : 'outline'}
                  disabled={
                    isCurrent || 
                    tier.id === 'free' || 
                    isProcessing === tier.id ||
                    (!['free'].includes(tier.id) && !getPriceId(tier.id as Exclude<SubscriptionTier, 'free'>, billingPeriod))
                  }
                  onClick={() => handleSubscribe(tier)}
                >
                  {isProcessing === tier.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isCurrent ? 'Aktueller Plan' : tier.id === 'free' ? 'Kostenlos nutzen' : 'Auswählen'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Häufige Fragen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-warmgray-900">Kann ich jederzeit kündigen?</h4>
            <p className="text-sm text-warmgray-600 mt-1">
              Ja, Sie können Ihr Abonnement jederzeit kündigen. Sie behalten den Zugang bis zum Ende des aktuellen Abrechnungszeitraums.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-warmgray-900">Was passiert mit meinen Daten nach der Kündigung?</h4>
            <p className="text-sm text-warmgray-600 mt-1">
              Ihre Daten bleiben 30 Tage nach der Kündigung erhalten. Danach werden sie gemäß unserer Datenschutzrichtlinie gelöscht.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-warmgray-900">Kann ich zwischen Plänen wechseln?</h4>
            <p className="text-sm text-warmgray-600 mt-1">
              Ja, Sie können jederzeit upgraden oder downgraden. Bei einem Upgrade wird der anteilige Betrag sofort berechnet.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-warmgray-900">Welche Zahlungsmethoden werden akzeptiert?</h4>
            <p className="text-sm text-warmgray-600 mt-1">
              Wir akzeptieren alle gängigen Kreditkarten sowie SEPA-Lastschrift.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
