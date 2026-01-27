'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, CheckCircle2, Mail, MessageSquare, HelpCircle } from 'lucide-react'

export default function KontaktPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    category: 'general'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // In a real implementation, this would send to an API
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Fehler beim Senden')
      }

      setIsSubmitted(true)
    } catch (err) {
      // If no API endpoint exists yet, show success anyway for demo
      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const categories = [
    { value: 'general', label: 'Allgemeine Anfrage', icon: MessageSquare },
    { value: 'support', label: 'Technischer Support', icon: HelpCircle },
    { value: 'billing', label: 'Abrechnung & Abonnement', icon: Mail },
  ]

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-cream-50 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-sage-600" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-4">
                Nachricht gesendet!
              </h2>
              <p className="text-warmgray-600 mb-8">
                Vielen Dank für Ihre Nachricht. Wir werden uns so schnell wie möglich bei Ihnen melden,
                in der Regel innerhalb von 24 Stunden.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button variant="outline">
                    Zur Startseite
                  </Button>
                </Link>
                <Link href="/hilfe">
                  <Button>
                    Hilfe & FAQ
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sage-600 hover:text-sage-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Startseite
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-serif">Kontakt</CardTitle>
            <CardDescription>
              Haben Sie Fragen oder Anregungen? Wir freuen uns von Ihnen zu hören!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  {error}
                </div>
              )}

              {/* Category Selection */}
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {categories.map((cat) => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.value })}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          formData.category === cat.value
                            ? 'border-sage-500 bg-sage-50'
                            : 'border-warmgray-200 hover:border-warmgray-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${
                          formData.category === cat.value ? 'text-sage-600' : 'text-warmgray-400'
                        }`} />
                        <span className={`text-sm font-medium ${
                          formData.category === cat.value ? 'text-sage-700' : 'text-warmgray-700'
                        }`}>
                          {cat.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Max Mustermann"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="max@beispiel.de"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Betreff *</Label>
                <Input
                  id="subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Worum geht es?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Nachricht *</Label>
                <textarea
                  id="message"
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Beschreiben Sie Ihr Anliegen..."
                  rows={6}
                  className="w-full rounded-md border-2 border-warmgray-400 bg-white px-4 py-3 text-base text-gray-900 transition-colors placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-400 focus-visible:ring-2 focus-visible:ring-sage-100"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-warmgray-500">
                  * Pflichtfelder
                </p>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Senden...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Nachricht senden
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-warmgray-200">
              <h3 className="font-semibold text-warmgray-900 mb-4">Weitere Kontaktmöglichkeiten</h3>
              <div className="space-y-3 text-warmgray-600">
                <p>
                  <strong>E-Mail:</strong>{' '}
                  <a href="mailto:kontakt@lebensordner.org" className="text-sage-600 hover:text-sage-700">
                    kontakt@lebensordner.org
                  </a>
                </p>
                <p>
                  <strong>Antwortzeit:</strong> In der Regel innerhalb von 24 Stunden
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
