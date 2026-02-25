import type { Medication } from '@/types/medication'

export function parseBmpXml(xmlString: string): Medication[] {
  if (typeof DOMParser === 'undefined') {
    return []
  }

  const doc = new DOMParser().parseFromString(xmlString, 'text/xml')

  // Check for parse error
  if (doc.querySelector('parsererror')) {
    return []
  }

  // Validate root element
  if (doc.documentElement.tagName !== 'MP') {
    return []
  }

  const medications: Medication[] = []

  const sections = doc.querySelectorAll('S')
  sections.forEach((section) => {
    const mElements = section.querySelectorAll('M')
    mElements.forEach((m) => {
      const wEl = m.querySelector('W')

      const wirkstoff = (wEl?.getAttribute('w') ?? '').trim()
      const staerkeRaw = (wEl?.getAttribute('s') ?? '').trim()
      const staerke = staerkeRaw.length > 0 ? staerkeRaw : undefined

      // Morgens: use m attribute, fallback to t attribute
      const morgensRaw = m.getAttribute('m') ?? m.getAttribute('t') ?? undefined

      const med: Medication = {
        wirkstoff,
      }

      if (staerke) med.staerke = staerke
      if (m.getAttribute('f')) med.form = m.getAttribute('f')!
      if (morgensRaw) med.morgens = morgensRaw
      if (m.getAttribute('v')) med.mittags = m.getAttribute('v')!
      if (m.getAttribute('d')) med.abends = m.getAttribute('d')!
      if (m.getAttribute('h')) med.zur_nacht = m.getAttribute('h')!
      if (m.getAttribute('r')) med.grund = m.getAttribute('r')!
      if (m.getAttribute('p')) med.pzn = m.getAttribute('p')!

      // Einheit: prefer dud, fallback to du
      const einheit = m.getAttribute('dud') ?? m.getAttribute('du') ?? undefined
      if (einheit) med.einheit = einheit

      // Hinweise: combine i and x attributes
      const hinweisParts = [m.getAttribute('i'), m.getAttribute('x')]
        .filter((v): v is string => !!v && v.length > 0)
      if (hinweisParts.length > 0) med.hinweise = hinweisParts.join(' ')

      if (med.wirkstoff.trim().length > 0 || !!med.pzn) {
        medications.push(med)
      }
    })
  })

  return medications
}
