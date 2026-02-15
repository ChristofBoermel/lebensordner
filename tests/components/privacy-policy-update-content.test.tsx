import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyPolicyUpdateContent } from '@/components/consent/privacy-policy-update-content'

describe('PrivacyPolicyUpdateContent', () => {
  it('should render without errors', () => {
    render(<PrivacyPolicyUpdateContent />)
    expect(screen.getByText(/Stand:/i)).toBeInTheDocument()
  })

  it('should render all sections', () => {
    render(<PrivacyPolicyUpdateContent />)

    expect(screen.getByText('1. Verantwortlicher')).toBeInTheDocument()
    expect(screen.getByText('2. Erhebung und Speicherung personenbezogener Daten')).toBeInTheDocument()
    expect(screen.getByText('3. Zweck der Datenverarbeitung')).toBeInTheDocument()
    expect(screen.getByText('4. Datensicherheit')).toBeInTheDocument()
    expect(screen.getByText('5. Ihre Rechte')).toBeInTheDocument()
    expect(screen.getByText('6. Aufbewahrung von Sicherheitsprotokollen')).toBeInTheDocument()
    expect(screen.getByText('7. Cookies')).toBeInTheDocument()
    expect(screen.getByText('8. Kontakt')).toBeInTheDocument()
  })

  it('should display contact information', () => {
    render(<PrivacyPolicyUpdateContent />)
    expect(screen.getByText(/datenschutz@lebensordner.org/i)).toBeInTheDocument()
  })
})
