import { requireFeature } from '@/lib/auth/tier-guard'
import FamilienUebersichtClientPage from './client'

export const dynamic = 'force-dynamic'

export default async function FamilienUebersichtPage() {
  await requireFeature('familyDashboard')

  return <FamilienUebersichtClientPage />
}
