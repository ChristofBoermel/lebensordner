import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthDataConsentContent } from '@/components/consent/health-data-consent-content'

describe('HealthDataConsentContent', () => {
  it('should render without errors', () => {
    render(<HealthDataConsentContent />)
    expect(screen.getByText(/Notfall- und Gesundheitsfunktionen/i)).toBeInTheDocument()
  })

  it('should display encryption, withdrawal rights, and purpose', () => {
    render(<HealthDataConsentContent />)

    expect(screen.getByText(/verschlüsselt gespeichert/i)).toBeInTheDocument()
    expect(screen.getByText(/Einwilligung jederzeit/i)).toBeInTheDocument()
    expect(screen.getByText(/Notfallfunktion bereitzustellen/i)).toBeInTheDocument()
  })
})
