"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"

export function useAuth() {
  const { data: session, status, update } = useSession()
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Handle session errors
    const handleSessionError = async () => {
      try {
        if (status === "unauthenticated") {
          // Session might have expired, try to refresh
          await update()
        }
      } catch (err) {
        console.error("Session error:", err)
        setError(err instanceof Error ? err : new Error("Session error"))
      }
    }

    handleSessionError()
  }, [status, update])

  return {
    session,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    user: session?.user,
    error,
  }
}
