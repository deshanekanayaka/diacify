import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PaintedField } from "./PaintedField";

/**
 * The shell both auth screens sit in: a painted panel on the left carrying
 * the mark and a line of copy, the form on its own on the right.
 *
 * The panel is the same picture as the landing page's hero, so signing in
 * reads as the next step of the page the clinician just left rather than a
 * different product. Below the large breakpoint the panel would eat the fold
 * on a phone, so it collapses to a slim band above the form.
 *
 * There is no social sign-in. Diacify authenticates with an email and a
 * password through Supabase and has no OAuth provider configured, and a
 * button that cannot do anything is worse than no button.
 */
export function AuthLayout({
  title,
  subtitle,
  panelLine,
  children,
}: {
  title: string;
  subtitle: string;
  /** The one sentence over the painted panel. */
  panelLine: string;
  children: ReactNode;
}) {
  return (
    <div className="public-shell grid min-h-screen bg-background font-sans text-foreground antialiased lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative m-3 hidden overflow-hidden rounded-[1.75rem] ring-1 ring-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <PaintedField />

        <div className="relative z-10 flex items-center justify-between">
          <span className="font-serif text-2xl tracking-tight text-foreground">
            Diacify
          </span>
          <Link
            to="/"
            className="rounded-full bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground ring-1 ring-border backdrop-blur-sm transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </div>

        <p className="relative z-10 max-w-md font-serif text-4xl leading-[1.1] tracking-tight text-balance text-foreground">
          {panelLine}
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-16 md:px-12">
        {/* The phone's version of the panel: enough of the picture to carry
            the mark, none of the height. */}
        <div className="relative mb-10 flex h-28 items-end overflow-hidden rounded-2xl px-6 pb-5 lg:hidden">
          <PaintedField />
          <span className="relative z-10 font-serif text-2xl tracking-tight text-foreground">
            Diacify
          </span>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-balance text-foreground">
            {title}
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>

          <div className="mt-10">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** A labelled input, styled for the auth screens.
 *
 *  It deliberately does not reuse the app's `Field`: that component carries
 *  the signed-in app's plain-CSS look, and these two screens follow the
 *  public pages instead. */
export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="mt-2 [&>input]:w-full [&>input]:appearance-none [&>input]:rounded-xl [&>input]:border-none [&>input]:bg-card [&>input]:px-4 [&>input]:py-3 [&>input]:font-sans [&>input]:text-base [&>input]:text-foreground [&>input]:shadow-none [&>input]:ring-1 [&>input]:ring-border [&>input]:transition-shadow [&>input:focus]:ring-2 [&>input:focus]:ring-primary [&>input:focus]:outline-none">
        {children}
      </div>
      {hint ? (
        <span className="mt-2 block text-sm text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

/** The full-width submit button both forms end on. */
export function AuthSubmit({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full cursor-pointer appearance-none rounded-full border-none bg-primary px-6 py-3.5 font-sans text-[0.95rem] font-medium text-primary-foreground transition-all hover:bg-[#0e2a1f] active:scale-[0.98] disabled:cursor-default disabled:opacity-45"
    >
      {children}
    </button>
  );
}
