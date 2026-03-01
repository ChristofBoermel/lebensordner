import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { requireAdmin, ForbiddenError, UnauthorizedError } from '@/lib/auth/guards'
import { ForbiddenPage } from '@/components/error/forbidden-page'

const AdminDashboard = dynamic(
  () => import('./admin-dashboard').then((mod) => ({ default: mod.AdminDashboard })),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-warmgray-600">Laden...</div>
      </div>
    ),
  }
)

const firstHeaderToken = (value: string | null) => value?.split(',')[0]?.trim() ?? null

const normalizeOrigin = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

const resolveRequestOrigin = async () => {
  const headerStore = await headers()
  const forwardedHost = firstHeaderToken(headerStore.get('x-forwarded-host'))
  const host = forwardedHost ?? firstHeaderToken(headerStore.get('host'))
  const forwardedProto = firstHeaderToken(headerStore.get('x-forwarded-proto'))
  const proto = forwardedProto ?? (host?.includes('localhost') ? 'http' : 'https')

  if (host) {
    const headerOrigin = normalizeOrigin(`${proto}://${host}`)
    if (headerOrigin) return headerOrigin
  }

  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.SITE_URL) ??
    'http://localhost:3000'
  )
}

export default async function AdminPage() {
  try {
    await requireAdmin()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect('/anmelden')
    }
    if (error instanceof ForbiddenError) {
      return <ForbiddenPage />
    }
    throw error
  }

  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  const origin = await resolveRequestOrigin()

  const [statsRes, usersRes] = await Promise.all([
    fetch(`${origin}/api/admin/stats`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    }),
    fetch(`${origin}/api/admin/users`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    }),
  ])

  if (!statsRes.ok || !usersRes.ok) {
    throw new Error('Failed to fetch admin data')
  }

  const [stats, users] = await Promise.all([
    statsRes.json(),
    usersRes.json(),
  ])

  return <AdminDashboard initialStats={stats} initialUsers={users} />
}
