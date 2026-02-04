import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierStatusCard, InfoBadge } from '@/components/ui/info-badge'

describe('TierStatusCard', () => {
  describe('Premium Tier Display', () => {
    it('should display "Premium" title', () => {
      render(<TierStatusCard tier="premium" />)

      expect(screen.getByText('Premium')).toBeInTheDocument()
    })

    it('should display correct description for premium tier', () => {
      render(<TierStatusCard tier="premium" />)

      expect(
        screen.getByText('Ihre Vertrauenspersonen können Dokumente ansehen und herunterladen')
      ).toBeInTheDocument()
    })

    it('should display "Ihr Abo" badge', () => {
      render(<TierStatusCard tier="premium" />)

      expect(screen.getByText('Ihr Abo')).toBeInTheDocument()
    })

    it('should have green color scheme classes', () => {
      const { container } = render(<TierStatusCard tier="premium" />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-green-50')
      expect(card.className).toContain('border-green-200')
    })
  })

  describe('Basic Tier Display', () => {
    it('should display "Basis" title', () => {
      render(<TierStatusCard tier="basic" />)

      expect(screen.getByText('Basis')).toBeInTheDocument()
    })

    it('should display correct description for basic tier', () => {
      render(<TierStatusCard tier="basic" />)

      expect(
        screen.getByText('Ihre Vertrauenspersonen können Dokumente nur ansehen (ohne Download)')
      ).toBeInTheDocument()
    })

    it('should have blue color scheme classes', () => {
      const { container } = render(<TierStatusCard tier="basic" />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-blue-50')
      expect(card.className).toContain('border-blue-200')
    })
  })

  describe('Free Tier Display', () => {
    it('should display "Kostenlos" title', () => {
      render(<TierStatusCard tier="free" />)

      expect(screen.getByText('Kostenlos')).toBeInTheDocument()
    })

    it('should display correct description for free tier', () => {
      render(<TierStatusCard tier="free" />)

      expect(
        screen.getByText('Vertrauenspersonen-Funktion erfordert ein kostenpflichtiges Abo')
      ).toBeInTheDocument()
    })

    it('should have warmgray color scheme classes', () => {
      const { container } = render(<TierStatusCard tier="free" />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-warmgray-50')
      expect(card.className).toContain('border-warmgray-200')
    })
  })

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<TierStatusCard tier="premium" className="custom-class" />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('custom-class')
    })
  })
})

describe('InfoBadge', () => {
  describe('Premium Badge', () => {
    it('should display "Voller Zugriff" text', () => {
      render(<InfoBadge type="premium" />)

      expect(screen.getByText('Voller Zugriff')).toBeInTheDocument()
    })

    it('should have green color scheme', () => {
      const { container } = render(<InfoBadge type="premium" />)

      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-green-100')
      expect(badge.className).toContain('text-green-700')
    })
  })

  describe('Basic Badge', () => {
    it('should display "Nur Ansicht" text', () => {
      render(<InfoBadge type="basic" />)

      expect(screen.getByText('Nur Ansicht')).toBeInTheDocument()
    })

    it('should have blue color scheme', () => {
      const { container } = render(<InfoBadge type="basic" />)

      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-blue-100')
      expect(badge.className).toContain('text-blue-700')
    })
  })

  describe('Free Badge', () => {
    it('should display "Kein Zugriff" text', () => {
      render(<InfoBadge type="free" />)

      expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    })

    it('should have warmgray color scheme', () => {
      const { container } = render(<InfoBadge type="free" />)

      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('bg-warmgray-100')
      expect(badge.className).toContain('text-warmgray-600')
    })
  })

  describe('Compact Variant', () => {
    it('should render compact variant with smaller styling', () => {
      const { container } = render(<InfoBadge type="premium" variant="compact" />)

      const badge = container.firstChild as HTMLElement
      expect(badge.className).toContain('text-xs')
      expect(badge.className).toContain('px-2')
      expect(badge.className).toContain('py-0.5')
    })
  })
})
