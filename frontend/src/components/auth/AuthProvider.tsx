import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '../ui/alert'
import { ApiService } from '@/services/api'

/**
 * Auth flow:
 *
 *   loading         -> querying /auth/status
 *      |
 *      +-- firstRun -> "Set initial password" form  --> setup -> authenticated
 *      |
 *      +-- normal   -> "Enter password" form        --> login -> authenticated
 *      |
 *      +-- offline  -> banner + retry
 */
type Phase = 'loading' | 'firstRun' | 'login' | 'authenticated' | 'offline'

const STORAGE_KEY = 'managementApiSecret'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // form state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  /** Decide which screen to show based on the server status + cached secret. */
  const probe = React.useCallback(async () => {
    setPhase('loading')
    setError('')
    try {
      const status = await ApiService.auth.status()
      if (status.firstRun) {
        setPhase('firstRun')
        return
      }
      // Server has a password configured. If we have a cached secret, try
      // it once - hitting any auth-protected endpoint validates it.
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        try {
          await ApiService.config.get()
          setPhase('authenticated')
          return
        } catch {
          // fallthrough to login screen
          localStorage.removeItem(STORAGE_KEY)
        }
      }
      setPhase('login')
    } catch (err) {
      setPhase('offline')
      setError(err instanceof Error ? err.message : 'Cannot reach the management API.')
    }
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  // If something wipes the secret mid-session (e.g. a 401 from another tab),
  // bounce back to the login screen.
  useEffect(() => {
    const onUnauth = () => {
      setPhase('login')
      setError('Session expired, please sign in again.')
    }
    window.addEventListener('management-api-unauthorized', onUnauth)
    return () => window.removeEventListener('management-api-unauthorized', onUnauth)
  }, [])

  const handleFirstRun = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const { secret } = await ApiService.auth.setup(password)
      localStorage.setItem(STORAGE_KEY, secret)
      setPassword('')
      setConfirmPassword('')
      setPhase('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!password) {
      setError('Please enter your password.')
      return
    }
    setSubmitting(true)
    try {
      const { secret } = await ApiService.auth.login(password)
      localStorage.setItem(STORAGE_KEY, secret)
      setPassword('')
      setPhase('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'authenticated') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        {phase === 'loading' && (
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Connecting to Chat2API...</p>
          </CardContent>
        )}

        {phase === 'offline' && (
          <CardContent className="space-y-4 py-10">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'The management API is not reachable. Make sure the backend is running.'}
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={() => void probe()}>
              Retry
            </Button>
          </CardContent>
        )}

        {phase === 'firstRun' && (
          <form onSubmit={handleFirstRun}>
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <ShieldCheck size={28} />
                </div>
              </div>
              <CardTitle className="text-2xl text-center font-bold">Welcome to Chat2API</CardTitle>
              <CardDescription className="text-center">
                Create an administrator password to secure the web UI. You can change it later from Settings.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat the password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create password and continue'
                )}
              </Button>
            </CardFooter>
          </form>
        )}

        {phase === 'login' && (
          <form onSubmit={handleLogin}>
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <KeyRound size={28} />
                </div>
              </div>
              <CardTitle className="text-2xl text-center font-bold">Chat2API Manager</CardTitle>
              <CardDescription className="text-center">
                Enter your administrator password to continue.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  disabled={submitting}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
