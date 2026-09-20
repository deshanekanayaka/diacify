import {
  IconChecklist,
  IconDatabase,
  IconLedger,
  IconShieldCheck,
} from '../icons';
import { motion, type Variants } from 'motion/react';
import Container from './container';
import Heading from './heading';
import { PremiumComponent, ThemingComponent, OpenSourceComponent, ProductionReadyComponent } from './feature-visuals';
import { cn } from "@/lib/utils";

function FeatureCard({
  title,
  description,
  descriptionClassName,
  icon: Icon,
  variants,
  className,
  children,
}: {
  title: string;
  description: React.ReactNode;
  descriptionClassName?: string;
  icon: React.ElementType;
  variants: Variants;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div variants={variants} className={cn("h-full w-full", className)}>
      <div className="group relative h-full w-full border border-white/10 bg-black/40 backdrop-blur-md transition-colors duration-300 hover:bg-white/2">
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 h-2 w-2 border-t border-l border-white/40"></div>
        <div className="absolute top-0 right-0 h-2 w-2 border-t border-r border-white/40"></div>
        <div className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-white/40"></div>
        <div className="absolute right-0 bottom-0 h-2 w-2 border-r border-b border-white/40"></div>

        <div className="relative z-10 flex h-full w-full flex-col items-start justify-center overflow-hidden p-8">
          <div className="mb-6 opacity-80 transition-transform duration-300 group-hover:scale-110">
            <Icon className="text-primary h-8 w-8" />
          </div>
          <h3 className="text-foreground mb-3 text-xl font-bold tracking-widest uppercase">
            {title}
          </h3>
          <p className={cn("text-sm leading-relaxed tracking-widest text-white/50 uppercase", descriptionClassName)}>
            {description}
          </p>
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export default function Features() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.2, 0, 0, 1] },
    },
  };

  return (
    <section className="bg-[#101010] relative overflow-hidden py-24 font-mono md:py-32">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px]"></div>

      <Container className="relative z-10 mx-auto">
        <motion.div
          className="mb-16 flex flex-col items-start text-left md:items-center md:text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          <motion.div
            variants={itemVariants}
            className="text-primary mb-8 inline-flex items-center text-xs font-bold tracking-widest uppercase"
          >
            <span className="mr-3 opacity-70">{'//'}</span>
            WHY YOU CAN TRUST IT
          </motion.div>
          <motion.div variants={itemVariants}>
            <Heading
              as="h2"
              variant="big"
              className="text-foreground font-sans text-balance"
            >
              Why you can trust <span className="text-primary">the number</span>
            </Heading>
          </motion.div>
        </motion.div>

        <motion.div
          className="grid auto-rows-[320px] grid-cols-1 gap-6 lg:grid-cols-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {/* Top left: what the model was fitted to */}
          <FeatureCard
            variants={itemVariants}
            className="lg:col-span-2"
            icon={IconDatabase}
            title="Real patient records"
            description="A random forest fitted to a real clinical dataset, not a rule of thumb or a lookup table."
            descriptionClassName="max-w-sm text-pretty"
          >
            <OpenSourceComponent />
          </FeatureCard>

          {/* Top right: what the clinician actually does */}
          <FeatureCard
            variants={itemVariants}
            className="lg:col-span-3"
            icon={IconChecklist}
            title="Five values in, one verdict out"
            description="The five measurements a consult already produces. Nothing extra to collect, and the model is scored on the server, never in the browser."
            descriptionClassName="max-w-md text-pretty"
          >
            <PremiumComponent />
          </FeatureCard>

          {/* Bottom left: who can read the data */}
          <FeatureCard
            variants={itemVariants}
            className="lg:col-span-3"
            icon={IconShieldCheck}
            title="Your patients stay yours"
            description={
              <>
                Isolation is enforced by the database itself <br className='hidden md:block lg:hidden' /> through row-level security, not by application code that a future change could forget.
              </>
            }
            descriptionClassName="max-w-lg text-balance"
          >
            <ThemingComponent />
          </FeatureCard>

          {/* Bottom right: what happens to old verdicts */}
          <FeatureCard
            variants={itemVariants}
            className="lg:col-span-2"
            icon={IconLedger}
            title="Assessments are append-only"
            description="A retrained model adds a new verdict. It never silently overwrites a judgement you have already seen."
            descriptionClassName="max-w-xs text-pretty"
          >
            <ProductionReadyComponent />
          </FeatureCard>
        </motion.div>
      </Container>
    </section>
  );
}
