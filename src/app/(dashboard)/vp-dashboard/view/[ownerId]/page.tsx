import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function VpDashboardViewOwnerRedirectPage({
  params,
}: {
  params: { ownerId: string }
}) {
  const ownerId = params?.ownerId

  if (ownerId) {
    redirect(`/zugriff?ownerId=${encodeURIComponent(ownerId)}#familie`)
  }

  redirect('/zugriff#familie')
}
