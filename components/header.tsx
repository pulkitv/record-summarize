"use client"

import { UserButton } from "./user-button"
import { MainNav } from "./main-nav"
import Link from "next/link"
import { Mic } from "lucide-react"
import { useSession } from "next-auth/react"

export function Header() {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"

  return (
    <header className="border-b bg-background">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 mr-6">
          <Mic className="h-6 w-6" />
          <span className="font-bold hidden md:inline-block">RecapAI - Meeting Recorder</span>
        </Link>
        {isAuthenticated && <MainNav />}
        <div className="ml-auto">{isAuthenticated && <UserButton />}</div>
      </div>
    </header>
  )
}
