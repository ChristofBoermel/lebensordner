'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  User,
  HelpCircle,
  Bug,
  Lightbulb
} from 'lucide-react'

type FeedbackType = 'frage' | 'fehler' | 'idee' | 'sonstiges'

const feedbackTypes: { value: FeedbackType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'frage', label: 'Frage', icon: HelpCircle, description: 'Ich habe eine Frage zur Nutzung' },
  { value: 'fehler', label: 'Fehler melden', icon: Bug, description: 'Ich habe einen Fehler gefunden' },
  { value: 'idee', label: 'Verbesserungsvorschlag', icon: Lightbulb, description: 'Ich habe eine Idee' },
  { value: 'sonstiges', label: 'Sonstiges', icon: MessageSquare, description: 'Allgemeines Feedback' }
]

export default function FeedbackPage() {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('frage')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setEmail(user.email || '')

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single()

        if (profile) {
          setName(profile.full_name || '')
          if (profile.email) setEmail(profile.email)
        }
      }
    }
    loadUserData()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          subject: `[${feedbackTypes.find(t => t.value === feedbackType)?.label}] ${subject}`,
          message,
          userId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Senden')
      }

      setSuccess(true)
      setSubject('')
      setMessage('')
    } catch (err: any) {
      setError(err.message || 'Fehler beim Senden des Feedbacks')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="page-header">
          <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
            Feedback
          </h1>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
                Vielen Dank für Ihr Feedback!
              </h2>
              <p className="text-warmgray-600 mb-6">
                Wir haben Ihre Nachricht erhalten und werden uns so schnell wie möglich bei Ihnen melden.
              </p>
              <Button onClick={() => setSuccess(false)}>
                Weiteres Feedback senden
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Feedback & Support
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Haben Sie Fragen, Probleme oder Verbesserungsvorschläge? Wir freuen uns auf Ihre Nachricht.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sage-600" />
            Kontaktformular
          </CardTitle>
          <CardDescription>
            Wählen Sie eine Kategorie und beschreiben Sie Ihr Anliegen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Feedback Type Selection */}
            <div className="space-y-3">
              <Label>Art des Feedbacks</Label>
              <div className="grid grid-cols-2 gap-3">
                {feedbackTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFeedbackType(type.value)}
                      className={`p-4 text-left rounded-lg border-2 transition-colors ${
                        feedbackType === type.value
                          ? 'border-sage-500 bg-sage-50'
                          : 'border-warmgray-200 hover:border-warmgray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${
                          feedbackType === type.value ? 'text-sage-600' : 'text-warmgray-400'
                        }`} />
                        <div>
                          <p className="font-medium text-warmgray-900">{type.label}</p>
                          <p className="text-xs text-warmgray-500">{type.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ihr Name"
                  className="pl-12"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse *</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  className="pl-12"
                />
              </div>
              <p className="text-xs text-warmgray-500">
                Für Rückfragen und unsere Antwort
              </p>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Betreff *</Label>
              <Input
                id="subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Worum geht es?"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Ihre Nachricht *</Label>
              <textarea
                id="message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich..."
                rows={6}
                className="w-full rounded-md border-2 border-warmgray-400 bg-white px-4 py-3 text-base text-gray-900 transition-colors placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-400 focus-visible:ring-2 focus-visible:ring-sage-100"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || !email || !subject || !message}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Senden...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Feedback absenden
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Additional Help */}
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-warmgray-600">
            <p className="mb-2">
              Sie können uns auch direkt per E-Mail erreichen:
            </p>
            <a
              href="mailto:support@lebensordner.org"
              className="text-sage-600 hover:text-sage-700 font-medium"
            >
              support@lebensordner.org
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
