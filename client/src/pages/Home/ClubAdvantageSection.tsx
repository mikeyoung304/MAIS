import { Container } from '@/ui/Container';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedSection } from '@/components/AnimatedSection';
import { Building2, Zap, TrendingUp, Check } from 'lucide-react';

export function ClubAdvantageSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="py-16 md:py-24 bg-background"
    >
      <Container>
        <AnimatedSection>
          <div className="text-center mb-12 md:mb-16">
            <h2
              id="features-heading"
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-macon-navy via-macon-orange to-macon-teal"
            >
              Your Growth Partner, Not Another Tool
            </h2>
            <p className="text-xl md:text-2xl text-neutral-700 max-w-2xl mx-auto">
              We don't hand you software and disappear. We partner in your success.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16">
          <Card className="group bg-white border-2 border-neutral-200 hover:border-macon-orange/50 shadow-elevation-1 hover:shadow-elevation-3 hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-8">
              <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-macon-orange/20 to-macon-orange/10 group-hover:from-macon-orange group-hover:to-macon-orange-700 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm">
                <TrendingUp className="w-8 h-8 text-macon-orange group-hover:text-white transition-all duration-300" />
              </div>
              <h3 className="font-heading text-2xl md:text-3xl font-semibold mb-3 text-neutral-900 group-hover:text-macon-navy transition-colors">
                Marketing That Actually Works
              </h3>
              <p className="text-lg text-neutral-600 leading-relaxed mb-4">
                We don't hand you a template and disappear. Your dedicated strategist writes your
                campaigns, manages your funnel, and helps you close more deals.
              </p>
              <p className="text-base text-macon-orange font-semibold">
                Average member sees 30% revenue increase in 90 days
              </p>
            </CardContent>
          </Card>

          <Card className="group bg-gradient-to-br from-macon-navy to-macon-navy-dark border-2 border-macon-orange shadow-[0_20px_50px_rgba(255,107,53,0.3)] hover:shadow-[0_25px_60px_rgba(255,107,53,0.4)] hover:-translate-y-3 transition-all duration-300 md:scale-105 relative overflow-hidden">
            {/* Accent glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-macon-orange/10 via-transparent to-macon-teal/10 opacity-60"></div>
            <CardContent className="p-10 relative z-10">
              <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-macon-orange to-macon-orange-dark shadow-[0_0_30px_rgba(255,107,53,0.5)]">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-heading text-2xl md:text-3xl font-bold mb-3 text-white">
                Bookings on Autopilot
              </h3>
              <p className="text-lg text-white/90 leading-relaxed mb-4">
                Your clients book online, pay upfront, and get automatic reminders. You wake up to a
                full calendar—without sending a single text.
              </p>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-macon-orange mt-0.5 flex-shrink-0" />
                <p className="text-base text-macon-orange-light font-bold">
                  Members save 15 hours/week on average
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="group bg-white border-2 border-neutral-200 hover:border-macon-orange/50 shadow-elevation-1 hover:shadow-elevation-3 hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-8">
              <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-macon-orange/20 to-macon-orange/10 group-hover:from-macon-orange group-hover:to-macon-orange-700 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm">
                <Building2 className="w-8 h-8 text-macon-orange group-hover:text-white transition-all duration-300" />
              </div>
              <h3 className="font-heading text-2xl md:text-3xl font-semibold mb-3 text-neutral-900 group-hover:text-macon-navy transition-colors">
                A Website That Works for You
              </h3>
              <p className="text-lg text-neutral-600 leading-relaxed mb-4">
                Look professional without learning to code. We design, build, and maintain your
                website—so you can focus on serving clients.
              </p>
              <p className="text-base text-macon-orange font-semibold">
                From zero to live website in 10 days
              </p>
            </CardContent>
          </Card>
        </div>
      </Container>
    </section>
  );
}
