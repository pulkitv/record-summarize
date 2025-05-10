import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function Home() {
  try {
    const session = await auth()

    // If user is authenticated, redirect to dashboard
    // If not, redirect to login
    if (session) {
      redirect("/dashboard")
    } else {
      redirect("/login")
    }
  } catch (error) {
    console.error("Error in root page:", error)
    // If there's an error, redirect to the login page
    redirect("/login")
  }
}
