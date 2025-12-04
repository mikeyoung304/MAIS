import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Zap, TrendingUp } from 'lucide-react';

export function TargetAudienceSection() {
  return (
    <section
      id="target-audience"
      aria-labelledby="target-audience-heading"
      className="py-16 md:py-24 bg-white"
    >
      <Container>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2
              id="target-audience-heading"
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-macon-navy via-macon-orange to-macon-teal"
            >
              Is This You?
            </h2>
            <p className="text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-3xl mx-auto">
              We've helped business owners just like you escape the grind.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            <Card className="group bg-neutral-50 border-l-4 border-l-macon-orange border-t border-r border-b border-neutral-200/30 hover:shadow-elevation-2 transition-all">
              <CardContent className="p-8">
                <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-macon-orange/10 group-hover:bg-macon-orange transition-colors">
                  <TrendingUp className="w-6 h-6 text-macon-orange group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-heading text-3xl md:text-4xl font-semibold mb-3 text-neutral-900">
                  The Solopreneur
                </h3>
                <p className="text-xl text-neutral-700 leading-relaxed mb-4">
                  You're working 70-hour weeks and still dropping balls. Your inbox is chaos, your
                  calendar is a mess, and you can't remember the last time you took a day off.
                </p>
                <p className="text-base text-neutral-600">
                  <strong>We handle:</strong> All the stuff you hate—scheduling, follow-ups,
                  invoicing, that outdated website.
                  <br />
                  <strong>You focus on:</strong> Your craft. Your family.
                </p>
              </CardContent>
            </Card>

            <Card className="group bg-neutral-50 border-l-4 border-l-macon-teal border-t border-r border-b border-neutral-200/30 hover:shadow-elevation-2 transition-all">
              <CardContent className="p-8">
                <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-macon-teal/10 group-hover:bg-macon-teal transition-colors">
                  <Building2 className="w-6 h-6 text-macon-teal group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-heading text-3xl md:text-4xl font-semibold mb-3 text-neutral-900">
                  The Scaling Startup
                </h3>
                <p className="text-xl text-neutral-700 leading-relaxed mb-4">
                  You're growing fast—but your systems aren't keeping up. Every new client means
                  more chaos, and you're scared to hire because nothing is documented.
                </p>
                <p className="text-base text-neutral-600">
                  <strong>We handle:</strong> Automated onboarding, lead tracking, client
                  management.
                  <br />
                  <strong>You focus on:</strong> Strategy, partnerships, the big picture.
                </p>
              </CardContent>
            </Card>

            <Card className="group bg-neutral-50 border-l-4 border-l-macon-navy border-t border-r border-b border-neutral-200/30 hover:shadow-elevation-2 transition-all">
              <CardContent className="p-8">
                <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-macon-navy/10 group-hover:bg-macon-navy transition-colors">
                  <Zap className="w-6 h-6 text-macon-navy group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-heading text-3xl md:text-4xl font-semibold mb-3 text-neutral-900">
                  The Pivot Artist
                </h3>
                <p className="text-xl text-neutral-700 leading-relaxed mb-4">
                  You're reinventing your business—again—and need to move fast. Last thing you want
                  is to spend 6 months building infrastructure.
                </p>
                <p className="text-base text-neutral-600">
                  <strong>We handle:</strong> Rapid deployment in weeks, not months—website,
                  booking, marketing.
                  <br />
                  <strong>You focus on:</strong> Testing, iterating, finding what works.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-xl text-neutral-700 mb-4">Not sure if you fit?</p>
            <Button
              variant="outline"
              size="lg"
              className="text-lg"
              onClick={() =>
                (window.location.href =
                  'mailto:support@maconai.com?subject=Inquiry about Macon AI Club')
              }
            >
              Chat with us →
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
