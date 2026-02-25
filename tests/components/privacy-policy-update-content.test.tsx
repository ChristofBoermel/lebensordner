import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyPolicyUpdateContent } from '@/components/consent/privacy-policy-update-content'

describe('PrivacyPolicyUpdateContent', () => {
  it('should render without errors', () => {
    render(<PrivacyPolicyUpdateContent />)
    expect(screen.getByText(/Wichtige Änderungen/i)).toBeInTheDocument()
  })

  it('should render all sections', () => {
    render(<PrivacyPolicyUpdateContent />)

    expect(screen.getByText('Wichtige Änderungen')).toBeInTheDocument()
    expect(screen.getByText('Vollständige Datenschutzerklärung anzeigen')).toBeInTheDocument()
    expect(screen.getByText('Kontakt')).toBeInTheDocument()
  })

  it('should display contact information', () => {
    render(<PrivacyPolicyUpdateContent />)
    expect(screen.getByText(/matbo@matsbusiness.co.site/i)).toBeInTheDocument()
  })
})
