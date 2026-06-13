import Link from 'next/link'
import { SignupForm } from '@/components/signup-form'
import { OpenCourtLogo } from '@/components/shared/oc-logo'

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="p-6 md:p-10">
        <Link href="/">
          <OpenCourtLogo className="h-6 w-auto text-foreground" />
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
