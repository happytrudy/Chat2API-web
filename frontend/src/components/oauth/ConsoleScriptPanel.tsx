/**
 * Console Script Panel
 *
 * Replaces the old BookmarkletPanel. Instead of dragging a bookmark,
 * the user simply:
 *   1. Clicks "Generate Script" (issues a ticket on the backend)
 *   2. Copies the one-line JS script to clipboard
 *   3. Opens the provider's page, presses F12 → Console → Paste → Enter
 *   4. Script reads the token and POSTs it to the backend ingest endpoint
 *   5. This component polls and auto-completes
 *
 * Much simpler UX than the bookmarklet drag-drop approach.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  Timer,
  Terminal,
} from 'lucide-react'
import { ApiService } from '@/services/api'

interface ConsoleScriptPanelProps {
  providerId: string
  providerType: string
  providerName?: string
  loginUrl: string
  onSuccess: (
    credentials: Record<string, string>,
    accountInfo?: { name?: string; email?: string },
  ) => void
}

type Phase = 'idle' | 'issuing' | 'waiting' | 'success' | 'error'

const POLL_INTERVAL_MS = 2000

export function ConsoleScriptPanel({
  providerId,
  providerType,
  providerName,
  loginUrl,
  onSuccess,
}: ConsoleScriptPanelProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('idle')
  const [scriptSource, setScriptSource] = useState('')
  const [error, setError] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ticketRef = useRef('')

  const displayName = providerName || providerType

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
      if (ticketRef.current) {
        ApiService.oauth.bookmarklet.cancel(ticketRef.current).catch(() => {})
      }
    }
  }, [])

  // Countdown timer
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (phase !== 'waiting') return
    const timer = setInterval(() => forceUpdate((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const issueTicket = async () => {
    setPhase('issuing')
    setError('')
    setCopied(false)
    try {
      const data = await ApiService.oauth.bookmarklet.issue(providerId, providerType)
      // Use the bookmarklet source but strip the IIFE wrapper for readability
      setScriptSource(data.bookmarklet.source)
      setExpiresAt(data.expiresAt)
      ticketRef.current = data.ticket
      setPhase('waiting')
      startPolling(data.ticket, data.expiresAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('oauth.console.networkError'))
      setPhase('error')
    }
  }

  const startPolling = (ticketValue: string, expires: number) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      if (Date.now() > expires) {
        stopPolling()
        setError(t('oauth.console.expired'))
        setPhase('error')
        return
      }

      try {
        const res = await ApiService.oauth.bookmarklet.poll(ticketValue)
        if (res.state === 'completed') {
          stopPolling()
          ticketRef.current = ''
          const result = res.result
          if (result.success && result.credentials) {
            setPhase('success')
            onSuccess(result.credentials, result.accountInfo)
          } else {
            setError(result.error || t('oauth.console.tokenInvalid'))
            setPhase('error')
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('Ticket')) {
          stopPolling()
          setError(t('oauth.console.ticketUsed'))
          setPhase('error')
        }
      }
    }, POLL_INTERVAL_MS)
  }

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptSource)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback: select text in a temporary textarea
      const ta = document.createElement('textarea')
      ta.value = scriptSource
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const timeLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))

  if (phase === 'idle' || phase === 'issuing') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('oauth.console.description', { provider: displayName })}
        </p>
        <Button
          type="button"
          onClick={issueTicket}
          disabled={phase === 'issuing'}
          className="w-full"
          variant="default"
        >
          {phase === 'issuing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('oauth.console.generating')}
            </>
          ) : (
            <>
              <Terminal className="mr-2 h-4 w-4" />
              {t('oauth.console.generate')}
            </>
          )}
        </Button>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className="space-y-4">
        {/* Step-by-step instructions */}
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-medium mb-2">{t('oauth.console.stepsTitle')}</p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
            <li>{t('oauth.console.step1', { provider: displayName })}</li>
            <li>{t('oauth.console.step2')}</li>
            <li>{t('oauth.console.step3')}</li>
            <li>{t('oauth.console.step4')}</li>
          </ol>
        </div>

        {/* Copy script button */}
        <Button
          type="button"
          onClick={copyScript}
          className="w-full"
          variant={copied ? 'default' : 'outline'}
        >
          {copied ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t('oauth.console.copied')}
            </>
          ) : (
            <>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              {t('oauth.console.copyScript')}
            </>
          )}
        </Button>

        {/* Open login page */}
        <Button
          type="button"
          onClick={() => window.open(loginUrl, '_blank', 'noopener,noreferrer')}
          className="w-full"
          variant="outline"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t('oauth.console.openLogin', { host: new URL(loginUrl).hostname })}
        </Button>

        {/* Polling indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('oauth.console.waiting')}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} {t('oauth.console.timeLeft')}
          </span>
        </div>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          {t('oauth.console.success')}
        </AlertDescription>
      </Alert>
    )
  }

  // phase === 'error'
  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      <Button type="button" onClick={issueTicket} className="w-full" variant="outline">
        <Terminal className="mr-2 h-4 w-4" />
        {t('oauth.console.tryAgain')}
      </Button>
    </div>
  )
}

export default ConsoleScriptPanel
