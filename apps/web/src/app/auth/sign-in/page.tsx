import { SignIn } from '@clerk/nextjs'

export default function SignInPage({
  searchParams,
}: Readonly<{
  searchParams?: Readonly<{ redirect_url?: string }>
}>) {
  const redirectUrl = searchParams?.redirect_url || '/admin/dashboard'
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <SignIn
        redirectUrl={redirectUrl}
        afterSignInUrl={redirectUrl}
        afterSignUpUrl={redirectUrl}
      />
    </div>
  )
}
