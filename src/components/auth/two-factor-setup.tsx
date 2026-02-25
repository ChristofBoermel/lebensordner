'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, Shield, Smartphone, Copy, Check } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect } from 'react'

interface TwoFactorSetupProps {
  isOpen: boolean
  onClose: () => void
  isEnabled: boolean
  onStatusChange: (enabled: boolean) => void
}

export function TwoFactorSetup({ isOpen, onClose, isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'intro' | 'setup' | 'verify' | 'success' | 'disable'>('intro')
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Only reset step when dialog OPENS, not when isEnabled changes
  useEffect(() => {
    if (isOpen) {
      // Don't change step if we're in the middle of a flow (success step)
      if (step !== 'success') {
        setStep(isEnabled ? 'disable' : 'intro')
      }
      setVerifyCode('')
      setError(null)
    }
  }, [isOpen]) // Removed isEnabled from dependencies

  const generateSecret = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Generieren')
      }

      setSecret(data.secret)
      
      // Generate QR code
      const qrUrl = await QRCode.toDataURL(data.otpauthUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff',
        },
      })
      setQrCodeUrl(qrUrl)
      setStep('setup')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const verifyAndEnable = async () => {
    if (verifyCode.length !== 6) {
      setError('Bitte geben Sie einen 6-stelligen Code ein')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: verifyCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ungültiger Code')
      }

      setStep('success')
      onStatusChange(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const disable2FA = async () => {
    if (verifyCode.length !== 6) {
      setError('Bitte geben Sie einen 6-stelligen Code ein')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', token: verifyCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ungültiger Code')
      }

      onStatusChange(false)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setStep('intro')
    setSecret('')
    setQrCodeUrl('')
    setVerifyCode('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* Intro Step */}
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-sage-600" />
                Zwei-Faktor-Authentifizierung
              </DialogTitle>
              <DialogDescription>
                Schützen Sie Ihr Konto mit einer zusätzlichen Sicherheitsebene
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-sage-50 border border-sage-200">
                <Smartphone className="w-5 h-5 text-sage-600 mt-0.5" />
                <div>
                  <p className="font-medium text-warmgray-900">So funktioniert's</p>
                  <p className="text-sm text-warmgray-600 mt-1">
                    Sie benötigen eine Authenticator-App wie Google Authenticator, 
                    Microsoft Authenticator oder Authy auf Ihrem Smartphone.
                  </p>
                </div>
              </div>

              <ul className="text-sm text-warmgray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center text-xs font-medium text-sage-700">1</div>
                  QR-Code mit Ihrer App scannen
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center text-xs font-medium text-sage-700">2</div>
                  6-stelligen Code eingeben
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center text-xs font-medium text-sage-700">3</div>
                  Bei jedem Login Code eingeben
                </li>
              </ul>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button onClick={generateSecret} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Einrichtung starten
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Setup Step - Show QR Code */}
        {step === 'setup' && (
          <>
            <DialogHeader>
              <DialogTitle>QR-Code scannen</DialogTitle>
              <DialogDescription>
                Scannen Sie diesen Code mit Ihrer Authenticator-App
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg border border-warmgray-200">
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}

              <div className="text-center">
                <p className="text-sm text-warmgray-500 mb-2">
                  Oder geben Sie diesen Code manuell ein:
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="px-3 py-2 bg-warmgray-100 rounded font-mono text-sm">
                    {secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copySecret}>
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('intro')}>
                Zurück
              </Button>
              <Button onClick={() => setStep('verify')}>
                Weiter
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Verify Step */}
        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>Code bestätigen</DialogTitle>
              <DialogDescription>
                Geben Sie den 6-stelligen Code aus Ihrer App ein
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="verify_code">Bestätigungscode</Label>
                <Input
                  id="verify_code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('setup')}>
                Zurück
              </Button>
              <Button onClick={verifyAndEnable} disabled={isLoading || verifyCode.length !== 6}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Aktivieren
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                2FA aktiviert!
              </DialogTitle>
              <DialogDescription className="sr-only">
                Zwei-Faktor-Authentifizierung wurde erfolgreich aktiviert.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-warmgray-600">
                Ihr Konto ist jetzt durch Zwei-Faktor-Authentifizierung geschützt.
                Bei jeder Anmeldung benötigen Sie den Code aus Ihrer App.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fertig
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Disable Step */}
        {step === 'disable' && (
          <>
            <DialogHeader>
              <DialogTitle>2FA deaktivieren</DialogTitle>
              <DialogDescription>
                Geben Sie zur Bestätigung den Code aus Ihrer App ein
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Achtung:</strong> Das Deaktivieren der Zwei-Faktor-Authentifizierung 
                  macht Ihr Konto weniger sicher.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="disable_code">Bestätigungscode</Label>
                <Input
                  id="disable_code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button 
                variant="destructive" 
                onClick={disable2FA} 
                disabled={isLoading || verifyCode.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Deaktivieren
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
