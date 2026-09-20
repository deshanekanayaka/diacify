import { IconArrowUpRight } from '../icons';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

function Crosshair({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  return (
    <div className={cn(
      "pointer-events-none absolute h-8 w-8",
      isTop ? "top-0" : "bottom-0",
      isLeft ? "left-0" : "right-0"
    )}>
      <div className={cn("absolute h-full w-px bg-white/10", isTop ? "top-0" : "bottom-0", isLeft ? "left-4" : "right-4")} />
      <div className={cn("absolute h-px w-full bg-white/10", isTop ? "top-4" : "bottom-4", isLeft ? "left-0" : "right-0")} />
    </div>
  );
}

function FooterLinkColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-primary mb-2 flex gap-2 font-mono text-xs tracking-widest">
        <span className="opacity-70">{'//'}</span> {title}
      </div>
      {children}
    </div>
  );
}

const LINK_CLASS = "text-sm text-white/50 transition-colors hover:text-white";

/** The landing page footer. Every link here points at a route or a page that
 *  exists: the template shipped columns for a blog, a Discord, and legal pages
 *  Diacify does not have, and a dead link reads worse than a short footer. */
export default function Footer() {
  return (
    <footer className="bg-background text-foreground relative mt-24 overflow-hidden border-t border-white/5 font-mono">
      <Crosshair position="top-left" />
      <Crosshair position="top-right" />

      <div className="relative z-10 container mx-auto px-4 pt-20 pb-12 md:px-8 lg:px-12 xl:px-16">
        <div className="relative grid grid-cols-1 gap-12 border-b border-white/5 pb-16 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col items-start pr-0 lg:col-span-5 lg:pr-8">
            <div className="text-primary mb-6 flex items-center gap-2 font-mono text-xs tracking-widest">
              <span className="opacity-70">{'//'}</span> DIACIFY
            </div>
            <h3 className="mb-6 font-sans text-3xl tracking-tight text-balance md:text-5xl">
              A verdict before <br className="hidden lg:block" /> the patient leaves
            </h3>
            <p className="mb-8 max-w-md text-sm leading-relaxed text-pretty text-white/50">
              Diabetes risk classification from the five values a consult already
              measures, scored on the server and kept visit by visit.
            </p>

            <Link
              to="/signup"
              className="text-background bg-primary hover:bg-primary/90 inline-flex w-fit items-center justify-center px-8 py-4 text-xs font-bold tracking-widest uppercase transition-colors active:scale-[0.96]"
            >
              Create account <IconArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 lg:col-span-7 lg:pl-8">
            <FooterLinkColumn title="PRODUCT">
              <Link to="/signup" className={LINK_CLASS}>Create account</Link>
              <Link to="/signin" className={LINK_CLASS}>Sign in</Link>
            </FooterLinkColumn>

            <FooterLinkColumn title="ENGINEERING">
              <a href="/docs" className={LINK_CLASS}>Architecture guide</a>
              <a
                href="https://github.com/deshanekanayaka/diacify"
                target="_blank"
                rel="noreferrer"
                className={LINK_CLASS}
              >
                Source
              </a>
            </FooterLinkColumn>
          </div>

          <div className="absolute top-0 bottom-0 left-[41.666%] hidden w-px bg-white/5 lg:block" />
        </div>

        <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden border-b border-white/5 py-6 md:flex-row">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[16px_16px]" />
          <div className="relative z-10 flex w-full flex-col items-center justify-between gap-6 px-2 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="bg-primary h-2 w-2 animate-pulse rounded-full shadow-[0_0_8px_rgba(183,220,197,0.6)]" />
              <span className="text-primary font-mono text-xs tracking-widest uppercase">
                Built for clinicians
              </span>
            </div>

            <div className="hidden items-center gap-[2px] opacity-80 lg:flex">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-4 w-1.5 transition-colors',
                    i < 12 ? 'bg-primary' : 'bg-white/10',
                  )}
                />
              ))}
            </div>

            <div className="text-primary font-mono text-xs tracking-widest">
              {'[ DIACIFY ]'}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-8 pt-12 xl:flex-row xl:items-center">
          <div className="flex w-full flex-col gap-8 md:flex-row md:items-center md:gap-12 xl:w-auto">
            <span className="font-sans text-lg font-bold tracking-tight text-white/90">
              Diacify
            </span>

            <div className="hidden flex-col border-l border-white/10 pl-8 md:flex">
              <span className="text-xs tracking-widest text-white/40">
                Five values in, one verdict out.
              </span>
              <span className="text-xs tracking-widest text-white/40">
                Every visit kept.
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-4 text-xs tracking-widest text-white/40 uppercase xl:w-auto xl:items-end">
            <span>&copy; 2026 Diacify</span>
          </div>
        </div>
      </div>

      <Crosshair position="bottom-left" />
      <Crosshair position="bottom-right" />
    </footer>
  );
}
