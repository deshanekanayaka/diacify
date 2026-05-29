import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function TestComponents() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">UI Test — Button, Card, Badge</h1>
        <p className="text-muted-foreground">Verifying Tailwind and Radix UI wiring</p>
      </header>

      <section className="flex items-center gap-3">
        <Button>Default Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
      </section>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Sample Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you can see styled Button, Card, and Badge without errors, Tailwind + Radix are configured.
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm">Action</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
