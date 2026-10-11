import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="ACDC AI home">
          <span className="font-heading text-xl font-bold tracking-tight">ACDC</span>
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          <span className="text-sm text-muted-foreground">AI</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Show when="signed-in">
            <NavLinks />
            <div className="ml-2 flex items-center">
              <UserButton />
            </div>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Build my profile</Button>
            </SignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
