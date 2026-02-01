'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  minDate?: string
  placeholder?: string
  className?: string
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
]

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function DatePicker({ value, onChange, minDate, placeholder = 'Datum wählen', className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value)
    return new Date()
  })

  const selectedDate = value ? new Date(value) : null
  const minDateObj = minDate ? new Date(minDate) : null

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Get the day of week for the first day (0 = Sunday, adjust to Monday = 0)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6

    const days: (number | null)[] = []

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const isDateDisabled = (day: number) => {
    if (!minDateObj) return false
    const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    return checkDate < new Date(minDateObj.setHours(0, 0, 0, 0))
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      viewDate.getMonth() === today.getMonth() &&
      viewDate.getFullYear() === today.getFullYear()
    )
  }

  const handleDayClick = (day: number) => {
    if (isDateDisabled(day)) return

    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    const formatted = newDate.toISOString().split('T')[0]
    onChange(formatted)
    setIsOpen(false)
  }

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  const days = getDaysInMonth(viewDate)

  const isSelected = (day: number) => {
    return (
      selectedDate &&
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getFullYear() === viewDate.getFullYear()
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal h-12',
            !value && 'text-warmgray-500',
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4 text-warmgray-500" />
          {value ? formatDisplayDate(value) : placeholder}
          {value && (
            <X
              className="ml-auto h-4 w-4 text-warmgray-400 hover:text-warmgray-600"
              onClick={clearDate}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0 bg-white shadow-lg border border-warmgray-200" align="start">
        <div className="p-4">
          {/* Header with month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevMonth}
              className="h-8 w-8 hover:bg-warmgray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-warmgray-900">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              className="h-8 w-8 hover:bg-warmgray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-warmgray-600 py-2 w-9">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="w-9 h-9">
                {day !== null && (
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    disabled={isDateDisabled(day)}
                    className={cn(
                      'w-full h-full rounded-md text-sm font-medium flex items-center justify-center transition-colors',
                      // Disabled state
                      isDateDisabled(day) && 'text-warmgray-300 cursor-not-allowed',
                      // Normal state
                      !isDateDisabled(day) && !isSelected(day) && 'text-warmgray-700 hover:bg-sage-100 hover:text-sage-800',
                      // Today (not selected)
                      isToday(day) && !isSelected(day) && 'border-2 border-sage-400 text-sage-700',
                      // Selected state
                      isSelected(day) && 'bg-sage-600 text-white hover:bg-sage-700 font-semibold'
                    )}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-warmgray-200">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9 whitespace-nowrap px-2"
              onClick={() => {
                const today = new Date()
                today.setFullYear(today.getFullYear() + 1)
                onChange(today.toISOString().split('T')[0])
                setIsOpen(false)
              }}
            >
              +1 Jahr
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9 whitespace-nowrap px-2"
              onClick={() => {
                const today = new Date()
                today.setFullYear(today.getFullYear() + 5)
                onChange(today.toISOString().split('T')[0])
                setIsOpen(false)
              }}
            >
              +5 Jahre
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9 whitespace-nowrap px-2"
              onClick={() => {
                const today = new Date()
                today.setFullYear(today.getFullYear() + 10)
                onChange(today.toISOString().split('T')[0])
                setIsOpen(false)
              }}
            >
              +10 Jahre
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
