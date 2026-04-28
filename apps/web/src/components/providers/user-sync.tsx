'use client'
import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { api } from '@/lib/api'

export function UserSync() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (!isLoaded || !user) return
    api.syncUser({
      clerkId:   user.id,
      email:     user.primaryEmailAddress?.emailAddress ?? '',
      firstName: user.firstName ?? '',
      lastName:  user.lastName ?? '',
      role:      (user.publicMetadata?.role as string) ?? 'SUPER_ADMIN',
    }).catch(() => {})
  }, [isLoaded, user?.id])

  return null
}
