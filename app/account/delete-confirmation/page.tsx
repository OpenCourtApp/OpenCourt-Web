import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccountDeletionStatus } from '@/lib/auth/actions'
import { OpenCourtLogo } from '@/components/shared/oc-logo'
import { DeleteAccountConfirmation } from '@/components/account/delete-account-confirmation'

export default async function DeleteAccountConfirmationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const status = await getAccountDeletionStatus()
  if (!status) redirect('/login')

  return (
    <div className="flex min-h-svh flex-col">
      <div className="p-6 md:p-10">
        <Link href="/">
          <OpenCourtLogo className="h-6 w-auto text-foreground" />
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <DeleteAccountConfirmation status={status} />
        </div>
      </div>
    </div>
  )
}
