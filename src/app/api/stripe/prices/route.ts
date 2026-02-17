import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
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
  })
}
