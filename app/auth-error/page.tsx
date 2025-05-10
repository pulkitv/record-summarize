"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams?.get("error") || "unknown"

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case "Configuration":
        return "There is a problem with the server configuration."
      case "AccessDenied":
        return "You do not have permission to sign in."
      case "Verification":
        return "The verification link may have been used or has expired."
      case "OAuthSignin":
        return "Error starting the OAuth sign-in process."
      case "OAuthCallback":
        return "Error during the OAuth callback process."
      case "OAuthCreateAccount":
        return "Error creating an OAuth account."
      case "EmailCreateAccount":
        return "Error creating an email account."
      case "Callback":
        return "Error during the callback process."
      case "OAuthAccountNotLinked":
        return "This email is already associated with another account."
      case "EmailSignin":
        return "Error sending the sign-in email."
      case "CredentialsSignin":
        return "The sign-in credentials are invalid."
      case "SessionRequired":
        return "You must be signed in to access this page."
      default:
        return "An unexpected error occurred during authentication."
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle>Authentication Error</CardTitle>
          </div>
          <CardDescription>There was a problem with your authentication request</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-sm text-red-800">{getErrorMessage(error)}</p>
            <p className="text-xs text-red-600 mt-2">Error code: {error}</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/login">Back to Login</Link>
          </Button>
          <Button asChild>
            <Link href="/">Go to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
