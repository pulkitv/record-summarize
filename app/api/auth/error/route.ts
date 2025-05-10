import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const error = searchParams.get("error") || "unknown"

  // Log the error
  console.error(`NextAuth error: ${error}`)

  // Redirect to our custom error page
  return NextResponse.redirect(new URL(`/auth-error?error=${error}`, request.url))
}
