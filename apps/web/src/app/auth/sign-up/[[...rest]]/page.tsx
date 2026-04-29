import { SignUp } from '@clerk/nextjs'

export default function SignUpPage({
  searchParams,
}: Readonly<{
  searchParams?: Readonly<{ redirect_url?: string }>
}>) {
  const redirectUrl = searchParams?.redirect_url || '/admin/dashboard'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <SignUp
        path="/auth/sign-up"
        routing="path"
        signInUrl="/auth/sign-in"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  )
}

