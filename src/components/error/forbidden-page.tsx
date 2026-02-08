import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldX, Home } from 'lucide-react'

export function ForbiddenPage() {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
            Zugriff verweigert
          </h2>
          <p className="text-warmgray-600 mb-6">
            Sie haben keine Berechtigung f&uuml;r diesen Bereich.
          </p>
          <Button asChild>
            <Link href="/dashboard">
              <Home className="w-4 h-4 mr-2" />
              Zur&uuml;ck zum Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
