export type TrustedPersonAccessLevel = 'immediate' | 'emergency' | 'after_confirmation'
export type TrustedPersonAction = 'view' | 'download'

export function canTrustedPersonPerformAction(
  accessLevel: string | null | undefined,
  action: TrustedPersonAction
): boolean {
  if (!accessLevel) return false

  if (action === 'download') {
    return accessLevel === 'immediate'
  }

  return accessLevel === 'immediate' || accessLevel === 'emergency'
}

export function buildTrustedPersonAccessDeniedMessage(
  accessLevel: string | null | undefined,
  action: TrustedPersonAction
): string {
  if (!accessLevel || accessLevel === 'after_confirmation') {
    return 'Ihr Zugriff erfordert eine Bestätigung durch den Besitzer.'
  }

  if (action === 'download' && accessLevel === 'emergency') {
    return 'Ihr Zugriff ist auf Notfall-Ansicht beschränkt. Downloads sind nicht erlaubt.'
  }

  return 'Ihr Zugriff erlaubt diese Aktion nicht.'
}
