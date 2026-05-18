import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { ApiService } from '@/services/api'

const STORAGE_KEY = 'managementApiSecret'

/**
 * Lets the operator change the administrator password used by the web UI.
 *
 * Implementation note: change_password may also rotate the underlying
 * Management API secret. When that happens we must update the secret we
 * keep in localStorage immediately, otherwise the next request will be
 * rejected and the user gets bounced back to the login screen.
 */
export function PasswordSettings() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rotateSecret, setRotateSecret] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const reset = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!oldPassword) {
      setError('Please enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setError('The new password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (newPassword === oldPassword) {
      setError('The new password must differ from the current one.')
      return
    }

    setSubmitting(true)
    try {
      const result = await ApiService.auth.changePassword({
        oldPassword,
        newPassword,
        rotateSecret,
      })
      // The server returns the (possibly rotated) secret. Persist it so
      // subsequent calls keep working seamlessly.
      if (result?.secret) {
        localStorage.setItem(STORAGE_KEY, result.secret)
      }
      setSuccess(
        result?.rotated
          ? 'Password changed and Management API secret rotated.'
          : 'Password changed successfully.',
      )
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Administrator Password
        </CardTitle>
        <CardDescription>
          Change the password used to log into the Chat2API web UI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={rotateSecret}
              onChange={(e) => setRotateSecret(e.target.checked)}
              disabled={submitting}
            />
            <span>
              Also rotate the Management API secret. Recommended after a
              suspected leak; any clients using the old secret will need
              to be updated.
            </span>
          </label>

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
