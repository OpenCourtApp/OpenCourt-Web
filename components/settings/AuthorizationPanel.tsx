'use client'

import { useEffect, useState } from 'react'
import { RiFileCopyLine, RiInformationLine } from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export function AuthorizationPanel() {
  const [token, setToken] = useState<string | null>(null)
  const [isPrincipal, setIsPrincipal] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const role = authData.user.user_metadata?.role as string | undefined
      const activeSchoolId = authData.user.user_metadata?.active_school_id as string | undefined

      setIsPrincipal(role === 'principal')

      if (activeSchoolId) {
        const { data } = await supabase
          .from('schools')
          .select('access_token')
          .eq('id', activeSchoolId)
          .single()
        setToken(data?.access_token ?? null)
      }
    }

    load()
  }, [])

  function copyToken() {
    if (!token) return
    navigator.clipboard.writeText(token).then(() => {
      toast.success('Copied to clipboard')
    })
  }

  if (!isPrincipal) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Identifier</CardTitle>
        <CardDescription>Your school&apos;s unique identifier</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-token">Access token</Label>
          {token === null ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="flex gap-2">
              <Input id="org-token" value={token} readOnly className="font-mono" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy token"
                onClick={copyToken}
              >
                <RiFileCopyLine className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <Alert>
          <RiInformationLine />
          <AlertTitle>Reserved for future use</AlertTitle>
          <AlertDescription>
            This identifier is generated when you create a school. It is not
            used for login or access control.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
