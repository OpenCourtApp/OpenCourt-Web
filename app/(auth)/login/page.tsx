import Link from 'next/link'
import { LoginForm } from '@/components/login-form'
import { OpenCourtLogo, OpenCourtMark } from '@/components/shared/oc-logo'
import { OAUTH_CALLBACK_ERROR } from '@/lib/auth/errors'
import { t } from '@/lib/strings'

function CourtLines({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 640"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="24" y="24" width="352" height="592" rx="20" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="320" x2="376" y2="320" stroke="currentColor" strokeWidth="2" />
      <circle cx="200" cy="320" r="64" stroke="currentColor" strokeWidth="2" />
      <rect x="120" y="24" width="160" height="96" stroke="currentColor" strokeWidth="2" />
      <rect x="120" y="520" width="160" height="96" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const initialError = error === 'oauth_failed' ? OAUTH_CALLBACK_ERROR : undefined

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex justify-start gap-2">
          <Link href="/">
            <OpenCourtLogo className="h-6 w-auto text-foreground" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm initialError={initialError} />
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-chart-3 via-primary to-chart-5 lg:block">
        <CourtLines className="absolute -right-16 -top-24 h-[130%] rotate-12 text-primary-foreground/10" />
        {/* Aerial court photo; if the file is missing the gradient + court
            lines behind it remain visible instead of a broken image icon */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/login-hero.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-10">
          <OpenCourtMark className="size-6 shrink-0 text-white" />
          <p className="text-sm text-white/80">{t.auth.login.hero}</p>
        </div>
      </div>
    </div>
  )
}
