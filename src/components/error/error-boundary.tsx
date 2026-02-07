'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorId?: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a timestamp-based error ID for support tracking
    const errorId = `ERR-${Date.now()}`
    return { hasError: true, error, errorId }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Track error in PostHog if available
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('error_boundary_triggered', {
        error_message: error.message,
        error_stack: error.stack,
        component_stack: errorInfo.componentStack,
      })
    }

    // Send error details to server-side logging in production
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      try {
        fetch('/api/errors/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_message: error.message,
            component_stack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            error_id: this.state.errorId,
          }),
        }).catch(() => {
          // Silently ignore logging failures - don't break the app
        })
      } catch {
        // Silently ignore logging failures
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
                Etwas ist schiefgelaufen
              </h2>
              <p className="text-warmgray-600 mb-6">
                Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-4 p-3 bg-warmgray-100 rounded-lg text-left">
                  <p className="text-xs font-mono text-red-600 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              {process.env.NODE_ENV === 'production' && this.state.errorId && (
                <p className="text-xs text-warmgray-400 mb-4">
                  Fehler-ID: {this.state.errorId}
                </p>
              )}

              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={this.handleReset} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Erneut versuchen
                </Button>
                <Button onClick={() => window.location.href = '/dashboard'}>
                  <Home className="w-4 h-4 mr-2" />
                  Zur Startseite
                </Button>
                {process.env.NODE_ENV === 'production' && this.state.errorId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = `mailto:support@lebensordner.de?subject=Fehlerbericht ${this.state.errorId}&body=Fehler-ID: ${this.state.errorId}%0A%0ABitte beschreiben Sie, was Sie getan haben, als der Fehler aufgetreten ist:`
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Problem melden
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
