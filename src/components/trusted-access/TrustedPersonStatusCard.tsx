'use client'

import { CheckCircle2, Circle, Loader2, Key, Send, Shield, Edit2, Trash2, XCircle, Mail, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { TrustedPerson } from '@/types/database'
import type { TrustedAccessRelationshipStatus } from '@/lib/security/trusted-access'

const LIFECYCLE_STEPS = [
  'Einladung gesendet',
  'Einladung angenommen',
  'Sicheren Zugriff einrichten',
  'Dokumente freigeben',
  'Zugriff aktiv',
] as const

/**
 * Maps relationship_status to which step index (0-4) is currently active.
 * active + hasExplicitShares → step 4 (Zugriff aktiv)
 * active                    → step 3 (Dokumente freigeben — owner must share)
 */
function getCurrentStepIndex(
  status: TrustedAccessRelationshipStatus,
  hasExplicitShares: boolean
): number {
  switch (status) {
    case 'invited': return 0
    case 'accepted_pending_setup': return 1
    case 'setup_link_sent': return 2
    case 'active': return hasExplicitShares ? 4 : 3
    case 'revoked': return -1
    default: return 0
  }
}

function getStepState(
  stepIndex: number,
  currentStepIndex: number
): 'done' | 'current' | 'upcoming' {
  if (currentStepIndex < 0) return 'upcoming'
  if (stepIndex < currentStepIndex) return 'done'
  if (stepIndex === currentStepIndex) return 'current'
  return 'upcoming'
}

interface TrustedPersonStatusCardProps {
  person: TrustedPerson
  hasExplicitShares?: boolean
  isGeneratingSetupLink: boolean
  isSendingInvite?: boolean
  onCreateSetupLink: (person: TrustedPerson) => void
  onSendInvite: (personId: string) => void
  onEdit: (person: TrustedPerson) => void
  onDelete: (id: string) => void
  onToggleActive: (person: TrustedPerson) => void
}

export function TrustedPersonStatusCard({
  person,
  hasExplicitShares = false,
  isGeneratingSetupLink,
  isSendingInvite = false,
  onCreateSetupLink,
  onSendInvite,
  onEdit,
  onDelete,
  onToggleActive,
}: TrustedPersonStatusCardProps) {
  const status = (person.relationship_status ?? 'invited') as TrustedAccessRelationshipStatus
  const currentStepIndex = getCurrentStepIndex(status, hasExplicitShares)
  const inviteWasSent =
    Boolean(person.invitation_sent_at) ||
    person.email_status === 'sent' ||
    person.email_status === 'sending'
  const inviteActionLabel = isSendingInvite
    ? 'Wird gesendet...'
    : inviteWasSent
      ? 'Einladung erneut senden'
      : 'Einladen'
  const inviteStatusLabel = inviteWasSent
    ? 'Einladung gesendet'
    : 'Auf Annahme warten'

  const borderColor =
    status === 'active' ? 'border-l-sage-500' :
    status === 'setup_link_sent' ? 'border-l-blue-400' :
    status === 'accepted_pending_setup' ? 'border-l-amber-400' :
    status === 'revoked' ? 'border-l-warmgray-300' :
    'border-l-warmgray-200'

  return (
    <Card
      data-testid={`trusted-person-card-${person.id}`}
      className={`border-l-4 ${borderColor}`}
    >
      <CardContent className="pt-5 pb-4">
        {/* Header row: name, email, actions */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-5 h-5 text-sage-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-warmgray-900 truncate">{person.name}</h3>
              <p className="text-sm text-warmgray-500">{person.relationship}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-warmgray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {person.email}
                </span>
                {person.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {person.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => onEdit(person)} title="Bearbeiten" className="h-8 w-8">
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onToggleActive(person)} title="Deaktivieren" className="h-8 w-8">
              <XCircle className="w-3.5 h-3.5 text-warmgray-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(person.id)}
              title="Löschen"
              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Lifecycle checklist */}
        <div className="flex items-center gap-0 mb-4 overflow-x-auto pb-1">
          {LIFECYCLE_STEPS.map((label, idx) => {
            const stepStatus = getStepState(idx, currentStepIndex)
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center min-w-[72px]">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    stepStatus === 'done' ? 'bg-sage-500 text-white' :
                    stepStatus === 'current' ? 'bg-sage-600 text-white ring-2 ring-sage-200' :
                    'bg-warmgray-100 text-warmgray-400'
                  }`}>
                    {stepStatus === 'done' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                  </div>
                  <span className={`text-[10px] text-center mt-1 leading-tight px-0.5 ${
                    stepStatus === 'current' ? 'text-sage-700 font-medium' :
                    stepStatus === 'done' ? 'text-sage-600' :
                    'text-warmgray-400'
                  }`}>
                    {label}
                  </span>
                </div>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div className={`h-px w-4 flex-shrink-0 mb-3 ${
                    getStepState(idx + 1, currentStepIndex) !== 'upcoming' || stepStatus === 'done'
                      ? 'bg-sage-300' : 'bg-warmgray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Primary CTA row */}
        <div className="flex items-center gap-2 flex-wrap">
          {status === 'invited' && (
            <Button
              data-testid={`trusted-person-invite-${person.id}`}
              variant="outline"
              size="sm"
              disabled={isSendingInvite}
              onClick={() => onSendInvite(person.id)}
              className="text-warmgray-600"
            >
              {isSendingInvite ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {inviteActionLabel}
            </Button>
          )}

          {status === 'invited' && (
            <span
              data-testid={`trusted-person-status-${person.id}`}
              className="text-xs text-warmgray-400"
            >
              {inviteStatusLabel}
            </span>
          )}

          {(status === 'accepted_pending_setup' || status === 'setup_link_sent') && (
            <Button
              size="sm"
              disabled={isGeneratingSetupLink}
              onClick={() => onCreateSetupLink(person)}
              className="bg-sage-600 hover:bg-sage-700 text-white"
            >
              {isGeneratingSetupLink ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Key className="w-3.5 h-3.5 mr-1.5" />
              )}
              {status === 'setup_link_sent' ? 'Neuen Link senden' : 'Sicheren Link erstellen'}
            </Button>
          )}

          {status === 'active' && !hasExplicitShares && (
            <span className="text-xs text-sage-700 font-medium">
              Nächster Schritt: Freigaben einrichten
            </span>
          )}

          {status === 'revoked' && (
            <span className="text-xs text-warmgray-400">Status: deaktiviert</span>
          )}
        </div>

        {person.notes && (
          <p className="text-xs text-warmgray-400 mt-2 italic">{person.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
