import { requireFeature } from '@/lib/auth/tier-guard'
import FamilienUebersichtClientPage from './client'

export const dynamic = 'force-dynamic'

export default function FamilienUebersichtPage() {
  return <FamilienUebersichtClientPage />
}
