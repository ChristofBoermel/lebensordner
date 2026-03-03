export function useDocumentAuditLog() {
  const emit = (
    eventType: string,
    payload: Record<string, string | undefined>,
  ): void => {
    void (async () => {
      try {
        await fetch('/api/documents/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_type: eventType, ...payload }),
        })
      } catch {
      }
    })()
  }

  return { emit }
}
