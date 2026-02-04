import { expect } from 'vitest'
import { screen } from '@testing-library/react'

export function mockDebugEnvironment() {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  return () => {
    process.env.NODE_ENV = previous
  }
}

export function mockProductionEnvironment() {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  return () => {
    process.env.NODE_ENV = previous
  }
}

export function createMockAdminUser(overrides: Partial<{ id: string; email: string; role: string }> = {}) {
  return {
    id: 'admin-user-id',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides,
  }
}

export function createMockPlatformStats(overrides: Partial<{
  total_users: number
  active_subscriptions: number
  trialing_users: number
  total_documents: number
  total_storage_used_mb: number
  users_completed_onboarding: number
  users_last_7_days: number
  users_last_30_days: number
}> = {}) {
  return {
    total_users: 150,
    active_subscriptions: 45,
    trialing_users: 12,
    total_documents: 3420,
    total_storage_used_mb: 1250.5,
    users_completed_onboarding: 120,
    users_last_7_days: 8,
    users_last_30_days: 35,
    ...overrides,
  }
}

export function expectConsoleLog(message: string) {
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining(message))
}

export function expectDebugPanelVisible() {
  expect(screen.getByText('Debug: Subscription Details')).toBeInTheDocument()
}
