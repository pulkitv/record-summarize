"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, AlertTriangle } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const error = searchParams?.get("error")
  const [isLoading, setIsLoading] = useState(false)

  const getErrorMessage = (errorCode: string | null) => {
    if (!errorCode) return null

    switch (errorCode) {
      case "OAuthSignin":
        return "Error starting the sign in process. Please try again."
      case "OAuthCallback":
        return "Error during the sign in process. Please try again."
      case "OAuthCreateAccount":
        return "Error creating your account. Please try again."
      case "EmailCreateAccount":
        return "Error creating your account. Please try again."
      case "Callback":
        return "Error during the sign in callback. Please try again."
      case "OAuthAccountNotLinked":
        return "This email is already associated with another account."
      case "EmailSignin":
        return "Error sending the sign in email. Please try again."
      case "CredentialsSignin":
        return "Invalid credentials. Please try again."
      case "SessionRequired":
        return "Please sign in to access this page."
      case "Redirect":
        return "There was a problem with the redirect. Please try again."
      default:
        return "An error occurred. Please try again."
    }
  }

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch (error) {
      console.error("Sign in error:", error)
      setIsLoading(false)
    }
  }

  const errorMessage = getErrorMessage(error)

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Mic className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Meeting Recorder</CardTitle>
          <CardDescription className="text-center">Record, transcribe, and summarize your meetings</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleSignIn} className="w-full py-6 text-base" size="lg" disabled={isLoading}>
            <span className="mr-2">G</span>
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </Button>

          <div className="text-center text-sm text-muted-foreground mt-4">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
