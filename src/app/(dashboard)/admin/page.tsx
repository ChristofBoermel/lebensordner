import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin, ForbiddenError, UnauthorizedError } from '@/lib/auth/guards'
import { ForbiddenPage } from '@/components/error/forbidden-page'
import { AdminDashboard } from './admin-dashboard'

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const [statsRes, usersRes] = await Promise.all([
    fetch(`${baseUrl}/api/admin/stats`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    }),
    fetch(`${baseUrl}/api/admin/users`, {
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
