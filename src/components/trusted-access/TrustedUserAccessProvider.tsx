'use client'

import {
  createContext,
  use,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import {
  buildTrustedUserConnectionSnapshot,
  diffConnectionSnapshots,
} from '@/lib/security/trusted-access-live-status'
import type { RelationshipEntry, TrustedAccessReceivedShareEntry } from '@/types/trusted-access-frontend'

const REFRESH_INTERVAL_MS = 15000

interface TrustedUserAccessState {
  relationships: RelationshipEntry[]
  shares: TrustedAccessReceivedShareEntry[]
  isLoading: boolean
  error: string | null
}

interface TrustedUserAccessActions {
  refresh: () => Promise<void>
}

interface TrustedUserAccessMeta {
  lastLoadedAt: number | null
}

interface TrustedUserAccessContextValue {
  state: TrustedUserAccessState
  actions: TrustedUserAccessActions
  meta: TrustedUserAccessMeta
}

const TrustedUserAccessContext = createContext<TrustedUserAccessContextValue | null>(null)

async function loadTrustedUserAccessState(): Promise<{
  relationships: RelationshipEntry[]
  shares: TrustedAccessReceivedShareEntry[]
}> {
  const response = await fetch('/api/documents/share-token/received', {
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Fehler beim Laden')
  }

  return {
    relationships: data.relationships ?? [],
    shares: data.shares ?? [],
  }
}

function useTrustedUserAccessStore(options: {
  enabled: boolean
  emitToasts: boolean
  subscribeRealtime: boolean
}): TrustedUserAccessContextValue {
  const [state, setState] = useState<TrustedUserAccessState>({
    relationships: [],
    shares: [],
    isLoading: options.enabled,
    error: null,
  })
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  // allowed: imperative-sync - compare previous and next connection state across refreshes
  const snapshotRef = useRef<ReturnType<typeof buildTrustedUserConnectionSnapshot> | null>(null)
  // allowed: imperative-sync - prevent overlapping network refreshes across listeners and polling
  const refreshInFlightRef = useRef(false)

  const emitTransitionToasts = useCallback((nextState: {
    relationships: RelationshipEntry[]
    shares: TrustedAccessReceivedShareEntry[]
  }) => {
    if (!options.emitToasts) {
      return
    }

    const nextSnapshot = buildTrustedUserConnectionSnapshot(
      nextState.relationships,
      nextState.shares,
    )
    const previousSnapshot = snapshotRef.current
    snapshotRef.current = nextSnapshot

    if (!previousSnapshot) {
      return
    }

    const events = diffConnectionSnapshots(previousSnapshot, nextSnapshot)
    for (const event of events) {
      if (event.transition === 'connected') {
        toast({
          title: 'Verbindung aktiv',
          description: `${event.label} ist jetzt sicher mit Ihnen verbunden.`,
        })
      } else {
        toast({
          title: 'Verbindung entfernt',
          description: `${event.label} ist nicht mehr mit Ihnen verbunden.`,
        })
      }
    }
  }, [options.emitToasts])

  const refresh = useCallback(async () => {
    if (!options.enabled || refreshInFlightRef.current) {
      return
    }

    refreshInFlightRef.current = true
    setState((current) => ({
      ...current,
      isLoading: current.isLoading && current.relationships.length === 0 && current.shares.length === 0,
      error: null,
    }))

    try {
      const nextState = await loadTrustedUserAccessState()
      emitTransitionToasts(nextState)
      setState({
        relationships: nextState.relationships,
        shares: nextState.shares,
        isLoading: false,
        error: null,
      })
      setLastLoadedAt(Date.now())
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Fehler beim Laden',
      }))
    } finally {
      refreshInFlightRef.current = false
    }
  }, [emitTransitionToasts, options.enabled])

  // allowed: I/O - load trusted-user access state when provider is active
  useEffect(() => {
    if (!options.enabled) {
      return
    }

    void refresh()
  }, [options.enabled, refresh])

  // allowed: subscription - refresh trusted-user access on focus, visibility, and polling
  useEffect(() => {
    if (!options.enabled) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, REFRESH_INTERVAL_MS)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    function handleWindowFocus() {
      void refresh()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [options.enabled, refresh])

  // allowed: subscription - receive trusted-user relationship and share changes over Supabase Realtime
  useEffect(() => {
    if (!options.enabled || !options.subscribeRealtime) {
      return
    }

    const supabase = createClient()
    let isCancelled = false
    let relationshipChannel:
      | ReturnType<typeof supabase.channel>
      | null = null
    let shareChannel:
      | ReturnType<typeof supabase.channel>
      | null = null

    async function subscribeRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || isCancelled) {
        return
      }

      relationshipChannel = supabase
        .channel(`trusted-user-access-relationships-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trusted_persons',
            filter: `linked_user_id=eq.${user.id}`,
          },
          () => {
            void refresh()
          },
        )
        .subscribe()

      shareChannel = supabase
        .channel(`trusted-user-access-shares-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'document_share_tokens',
          },
          () => {
            void refresh()
          },
        )
        .subscribe()
    }

    void subscribeRealtime()

    return () => {
      isCancelled = true
      if (relationshipChannel) {
        void supabase.removeChannel(relationshipChannel)
      }
      if (shareChannel) {
        void supabase.removeChannel(shareChannel)
      }
    }
  }, [options.enabled, options.subscribeRealtime, refresh])

  return {
    state,
    actions: {
      refresh: async () => {
        await refresh()
      },
    },
    meta: {
      lastLoadedAt,
    },
  }
}

export function TrustedUserAccessProvider({ children }: { children: ReactNode }) {
  const value = useTrustedUserAccessStore({
    enabled: true,
    emitToasts: true,
    subscribeRealtime: true,
  })
  return (
    <TrustedUserAccessContext value={value}>
      {children}
    </TrustedUserAccessContext>
  )
}

export function useTrustedUserAccess() {
  const context = use(TrustedUserAccessContext)
  const fallbackValue = useTrustedUserAccessStore({
    enabled: context === null,
    emitToasts: false,
    subscribeRealtime: false,
  })

  return context ?? fallbackValue
}
