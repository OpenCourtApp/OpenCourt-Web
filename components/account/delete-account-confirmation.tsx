'use client'

import Link from 'next/link'
import type { AccountDeletionStatus } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog'
import { t } from '@/lib/strings'

export function DeleteAccountConfirmation({
  status,
}: {
  status: AccountDeletionStatus
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.account.confirmation.title}</CardTitle>
        <CardDescription>
          {t.settings.account.confirmation.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isPrincipal ? (
          <>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t.settings.account.principalBlocked}</p>
              {status.principalSchools.length > 0 && (
                <p>
                  {t.settings.account.principalSchools(
                    status.principalSchools.join(', ')
                  )}
                </p>
              )}
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings">
                {t.settings.account.confirmation.goToSettings}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t.settings.account.confirmation.body(status.email)}
            </p>
            <DeleteAccountDialog
              email={status.email}
              triggerLabel={t.settings.account.confirmation.delete}
              triggerClassName="w-full"
            />
            <Button asChild variant="ghost" className="w-full">
              <Link href="/onboarding">
                {t.settings.account.confirmation.keep}
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
