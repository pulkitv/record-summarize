"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Mic, LayoutDashboard } from "lucide-react"
import { useAuth } from "@/lib/auth"

export function MainNav() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return null
  }

  const routes = [
    {
      href: "/dashboard",
      label: "Dashboard",
      active: pathname === "/dashboard",
      icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
    },
    {
      href: "/record",
      label: "Record",
      active: pathname === "/record",
      icon: <Mic className="mr-2 h-4 w-4" />,
    },
  ]

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "flex items-center text-sm font-medium transition-colors hover:text-primary",
            route.active ? "text-primary" : "text-muted-foreground",
          )}
        >
          {route.icon}
          {route.label}
        </Link>
      ))}
    </nav>
  )
}
