import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { NameFields, composeFullName, type NameFieldsValue } from '@/components/ui/name-fields'

const defaultValue: NameFieldsValue = {
  academic_title: null,
  first_name: '',
  middle_name: null,
  last_name: '',
}

const NameFieldsWithState = () => {
  const [value, setValue] = useState<NameFieldsValue>(defaultValue)
  return <NameFields value={value} onChange={setValue} />
}

describe('NameFields', () => {
  it('renders all 4 fields', () => {
    render(<NameFields value={defaultValue} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Akademischer Titel')).toBeInTheDocument()
    expect(screen.getByLabelText('Vorname')).toBeInTheDocument()
    expect(screen.getByLabelText('Zweiter Vorname (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Nachname')).toBeInTheDocument()
  })

  it('updates live preview when first and last name change', () => {
    render(<NameFieldsWithState />)

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Max' } })
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Mustermann' } })

    expect(screen.getByText('Anzeigename: Max Mustermann')).toBeInTheDocument()
  })

  it('updates live preview with academic title', () => {
    render(<NameFieldsWithState />)

    fireEvent.change(screen.getByLabelText('Akademischer Titel'), { target: { value: 'Dr.' } })
    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Max' } })
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Mustermann' } })

    expect(screen.getByText('Anzeigename: Dr. Max Mustermann')).toBeInTheDocument()
  })

  it('collapses spaces in live preview', () => {
    render(<NameFieldsWithState />)

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Max' } })
    fireEvent.change(screen.getByLabelText('Zweiter Vorname (optional)'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Mustermann' } })

    expect(screen.getByText(/Anzeigename:/).textContent).not.toContain('  ')
    expect(screen.getByText('Anzeigename: Max Mustermann')).toBeInTheDocument()
  })

  it('calls onChange with the correct shape', () => {
    const onChange = vi.fn()
    render(<NameFields value={defaultValue} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Anna' } })

    expect(onChange).toHaveBeenCalledWith({
      academic_title: null,
      first_name: 'Anna',
      middle_name: null,
      last_name: '',
    })
  })

  it('composeFullName helper works for empty and full values', () => {
    expect(composeFullName(defaultValue)).toBe('')
    expect(
      composeFullName({
        academic_title: 'Dr.',
        first_name: 'Max',
        middle_name: 'Karl',
        last_name: 'Mustermann',
      })
    ).toBe('Dr. Max Karl Mustermann')
    expect(
      composeFullName({
        academic_title: null,
        first_name: 'Max',
        middle_name: null,
        last_name: 'Mustermann',
      })
    ).toBe('Max Mustermann')
  })
})
