export const APP_PLATFORM_TARGETS = ['web', 'ios', 'android'] as const

export type AppPlatformTarget = (typeof APP_PLATFORM_TARGETS)[number]

export function getSharedWelcomeMessage(productName: string): string {
  return `${productName}: gemeinsame Logik fuer Web und Expo Mobile aktiviert.`
}
