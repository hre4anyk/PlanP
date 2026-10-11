import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="Plan P home">
          <span className="font-heading text-xl font-bold tracking-tight">Plan</span>
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          <span className="font-heading text-xl font-bold tracking-tight text-primary">P</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-2">
          <Link
            href="/car"
            className="rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-3"
          >
            Park my car
          </Link>
          <Link
            href="/#how"
            className="hidden rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:block sm:px-3"
          >
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}
