import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HANDLED - Investor One-Pager',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnePagerPage() {
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');

        :root {
          --surface: #18181b;
          --surface-alt: #27272a;
          --sage: #45b37f;
          --sage-light: #5cc98f;
          --text-primary: #fafafa;
          --text-muted: #a1a1aa;
          --border: #3f3f46;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family:
            'Inter',
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
          background: var(--surface);
          color: var(--text-primary);
          line-height: 1.5;
          min-height: 100vh;
          overflow: auto;
        }

        .one-pager-page {
          min-height: 100vh;
          padding: 16px 24px;
          display: flex;
          flex-direction: column;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header */
        .one-pager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .one-pager-logo {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .one-pager-tagline {
          font-size: 12px;
          color: var(--sage);
          font-weight: 500;
        }

        /* Section Styles */
        .one-pager-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--sage);
          margin-bottom: 8px;
        }

        .one-pager-content h2 {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          line-height: 1.2;
        }

        .one-pager-content h3 {
          font-family: 'Playfair Display', serif;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .one-pager-content h4 {
          font-size: 11px;
          font-weight: 600;
          color: var(--sage);
          margin-bottom: 3px;
        }

        .one-pager-content p {
          color: var(--text-muted);
          font-size: 12px;
          margin-bottom: 8px;
        }

        /* Main Content Area */
        .one-pager-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 0;
        }

        /* Top Row */
        .one-pager-top-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        /* Problem Section */
        .one-pager-problem {
          background: var(--surface-alt);
          border-radius: 14px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.3),
            0 4px 6px -2px rgba(0, 0, 0, 0.2);
        }

        .one-pager-problem-list {
          list-style: none;
          margin-top: 8px;
        }

        .one-pager-problem-list li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 5px;
        }

        .one-pager-problem-list li::before {
          content: '×';
          color: #ef4444;
          font-weight: 600;
        }

        /* Screenshot */
        .one-pager-screenshot {
          background: linear-gradient(135deg, var(--surface-alt) 0%, #1f1f23 100%);
          border-radius: 14px;
          border: 1px solid var(--border);
          padding: 12px;
          box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.3),
            0 10px 10px -5px rgba(0, 0, 0, 0.2);
        }

        .one-pager-screenshot-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--sage);
          margin-bottom: 8px;
          text-align: center;
        }

        .one-pager-screenshot-content {
          background: var(--surface);
          border-radius: 12px;
          padding: 12px;
          border: 1px solid var(--border);
        }

        .one-pager-screenshot-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }

        .one-pager-screenshot-avatar {
          width: 26px;
          height: 26px;
          background: var(--sage);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          color: white;
        }

        .one-pager-screenshot-title {
          font-size: 11px;
          font-weight: 600;
        }

        .one-pager-screenshot-subtitle {
          font-size: 9px;
          color: var(--text-muted);
        }

        .one-pager-memory-tag {
          background: rgba(69, 179, 127, 0.15);
          border: 1px solid rgba(69, 179, 127, 0.3);
          border-radius: 8px;
          padding: 6px 10px;
          margin-bottom: 5px;
        }

        .one-pager-memory-tag-label {
          font-size: 9px;
          font-weight: 600;
          color: var(--sage);
          margin-bottom: 2px;
        }

        .one-pager-memory-tag-content {
          font-size: 10px;
          color: var(--text-primary);
          line-height: 1.3;
        }

        /* Solution Section */
        .one-pager-solution-row {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 10px;
          align-items: start;
        }

        .one-pager-solution-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .one-pager-feature-card {
          background: var(--surface-alt);
          border-radius: 16px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.2),
            0 2px 4px -1px rgba(0, 0, 0, 0.15);
        }

        .one-pager-feature-card p {
          font-size: 9px;
          margin-bottom: 0;
          line-height: 1.3;
        }

        /* Future Section */
        .one-pager-future-section {
          background: linear-gradient(
            135deg,
            rgba(69, 179, 127, 0.15) 0%,
            rgba(69, 179, 127, 0.05) 100%
          );
          border: 1px solid rgba(69, 179, 127, 0.3);
          border-radius: 14px;
          padding: 10px 14px;
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 12px;
          align-items: center;
          box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.2),
            0 4px 6px -2px rgba(0, 0, 0, 0.15);
        }

        .one-pager-future-section h2 {
          color: var(--sage);
          font-size: 16px;
          margin-bottom: 6px;
        }

        .one-pager-future-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }

        .one-pager-future-item {
          text-align: center;
        }

        .one-pager-future-item .icon {
          font-size: 18px;
          margin-bottom: 4px;
        }

        .one-pager-future-item h4 {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 3px;
        }

        .one-pager-future-item p {
          font-size: 9px;
          margin-bottom: 0;
        }

        /* Bottom Row */
        .one-pager-bottom-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }

        /* Pricing */
        .one-pager-pricing-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        .one-pager-pricing-table th {
          text-align: left;
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          padding: 6px 0;
          border-bottom: 1px solid var(--border);
        }

        .one-pager-pricing-table td {
          font-size: 11px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }

        .one-pager-pricing-table td:first-child {
          font-weight: 500;
        }

        .one-pager-pricing-table td:nth-child(2) {
          color: var(--sage);
          font-weight: 600;
        }

        .one-pager-pricing-table td:last-child {
          color: var(--text-muted);
          font-size: 10px;
        }

        .one-pager-popular-badge {
          background: var(--sage);
          color: white;
          font-size: 8px;
          font-weight: 600;
          padding: 2px 5px;
          border-radius: 3px;
          margin-left: 4px;
        }

        /* Why Now */
        .one-pager-why-now-list {
          list-style: none;
          margin-top: 8px;
        }

        .one-pager-why-now-list li {
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 6px;
          padding-left: 16px;
          position: relative;
        }

        .one-pager-why-now-list li::before {
          content: '→';
          color: var(--sage);
          position: absolute;
          left: 0;
          font-weight: 600;
        }

        .one-pager-why-now-list li strong {
          color: var(--text-primary);
        }

        /* Tech */
        .one-pager-tech-list {
          list-style: none;
          margin-top: 8px;
        }

        .one-pager-tech-list li {
          font-size: 10px;
          color: var(--text-muted);
          margin-bottom: 5px;
          padding-left: 14px;
          position: relative;
        }

        .one-pager-tech-list li::before {
          content: '•';
          color: var(--sage);
          position: absolute;
          left: 0;
        }

        /* Footer */
        .one-pager-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1px solid var(--border);
          margin-top: 8px;
          flex-shrink: 0;
        }

        .one-pager-founder-note {
          font-size: 11px;
          color: var(--text-muted);
          max-width: 500px;
        }

        .one-pager-founder-note strong {
          color: var(--text-primary);
        }

        .one-pager-contact-info {
          display: flex;
          gap: 24px;
          align-items: center;
        }

        .one-pager-contact-item {
          font-size: 11px;
        }

        .one-pager-contact-item span {
          color: var(--text-muted);
          margin-right: 6px;
        }

        .one-pager-contact-item a {
          color: var(--sage);
          text-decoration: none;
          font-weight: 500;
        }

        /* Print Styles */
        @media print {
          body {
            background: var(--surface);
            color: var(--text-primary);
            min-height: auto;
          }

          .one-pager-page {
            padding: 32px 40px;
            min-height: auto;
            height: auto;
            page-break-inside: avoid;
          }

          .one-pager-content {
            gap: 24px;
          }

          .one-pager-top-row,
          .one-pager-solution-row,
          .one-pager-future-section,
          .one-pager-bottom-row {
            page-break-inside: avoid;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }

        /* Responsive constraints */
        @media screen and (max-width: 1024px) {
          .one-pager-page {
            padding: 32px 40px;
          }

          .one-pager-top-row,
          .one-pager-solution-row,
          .one-pager-bottom-row {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .one-pager-future-section {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        @media screen and (orientation: portrait) and (max-width: 900px) {
          body::before {
            content: '⟲ For best viewing, please rotate to landscape';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--sage);
            color: white;
            padding: 12px;
            text-align: center;
            font-size: 14px;
            font-weight: 600;
            z-index: 9999;
          }

          .one-pager-page {
            margin-top: 48px;
          }
        }

        @page {
          size: letter landscape;
          margin: 0;
        }
      `}</style>

      <div className="one-pager-page">
        <header className="one-pager-header">
          <div className="one-pager-logo">Handled</div>
          <div className="one-pager-tagline">
            AI-Native Business Operations for Service Professionals
          </div>
        </header>

        <div className="one-pager-content">
          {/* Top Row: Problem + Session Space */}
          <div className="one-pager-top-row">
            <div className="one-pager-problem">
              <div className="one-pager-section-label">The Problem</div>
              <h2>64M service pros drowning in admin.</h2>
              <p>
                Anyone who sells their time and expertise — consultants, tutors, photographers,
                cleaners, coaches, planners — losing 20-30% of their time to busywork. They don't
                have time to learn AI.
              </p>
              <ul className="one-pager-problem-list">
                <li>Scattered messages across email, text, DMs</li>
                <li>Manual booking, invoicing, follow-up</li>
                <li>No memory of repeat client preferences</li>
                <li>DIY websites that don't convert</li>
              </ul>
            </div>

            <div className="one-pager-screenshot">
              <div className="one-pager-screenshot-label">Session Space — One Link. Forever.</div>
              <div className="one-pager-screenshot-content">
                <div className="one-pager-screenshot-header">
                  <div className="one-pager-screenshot-avatar">SJ</div>
                  <div>
                    <div className="one-pager-screenshot-title">Sarah's Session</div>
                    <div className="one-pager-screenshot-subtitle">Essential Package • Jan 9</div>
                  </div>
                  <div
                    style={{
                      marginLeft: 'auto',
                      background: 'var(--sage)',
                      color: 'white',
                      fontSize: '9px',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    Active
                  </div>
                </div>
                <div className="one-pager-memory-tag">
                  <div className="one-pager-memory-tag-label">✨ AI Summary</div>
                  <div className="one-pager-memory-tag-content">
                    Session confirmed for Thursday 2pm. Sarah prefers natural lighting. She asked
                    about bringing props — I let her know that's welcome.
                  </div>
                </div>
                <div className="one-pager-memory-tag">
                  <div className="one-pager-memory-tag-label">🧠 From Last Time</div>
                  <div className="one-pager-memory-tag-content">
                    Prefers candid shots • Loves golden hour • Usually runs 5min late • Likes
                    outdoor locations
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    <div style={{ marginBottom: '4px' }}>Things to do • 2/4</div>
                    <span style={{ color: 'var(--sage)' }}>✓ Paid</span>{' '}
                    <span style={{ color: 'var(--sage)' }}>✓ Calendar</span>
                    <br />
                    <span>○ Location</span> <span>○ Outfits</span>
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    <div style={{ marginBottom: '4px' }}>Activity</div>
                    <span style={{ color: 'var(--sage)' }}>3 messages</span> • <span>1 file</span>
                    <br />
                    <span style={{ color: 'var(--sage)' }}>↻ Synced</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Solution Row */}
          <div className="one-pager-solution-row">
            <div>
              <div className="one-pager-section-label">The Solution</div>
              <h2>AI that works invisibly, so they don't have to learn it.</h2>
            </div>
            <div className="one-pager-solution-grid">
              <div className="one-pager-feature-card">
                <h4>AI Website Builder</h4>
                <p>Say "change my headline" — done. No code.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>24/7 Booking Agent</h4>
                <p>Books clients, answers Qs, reduces no-shows.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Session Space</h4>
                <p>Living workspace per job. Chat, files, checklist.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Client Memory</h4>
                <p>AI remembers preferences across bookings.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Market Research</h4>
                <p>AI suggests pricing from local market data.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Noise Filter</h4>
                <p>AI handles questions, surfaces what matters.</p>
              </div>
            </div>
          </div>

          {/* Built for the Future Section */}
          <div className="one-pager-future-section">
            <div>
              <div className="one-pager-section-label">Built for 2026 and Beyond</div>
              <h2>AI-Native. Ready for Agent-to-Agent.</h2>
              <p style={{ marginBottom: 0, fontSize: '11px' }}>
                Every tech company is scrambling to retrofit AI.{' '}
                <strong style={{ color: 'var(--text-primary)' }}>We started here.</strong> When
                personal AI agents book services for users — we're the interface they'll talk to.
              </p>
            </div>
            <div className="one-pager-future-grid">
              <div className="one-pager-future-item">
                <div className="icon">🤖</div>
                <h4>Agent-Ready APIs</h4>
                <p>Built for AI-to-AI from day one</p>
              </div>
              <div className="one-pager-future-item">
                <div className="icon">🔗</div>
                <h4>Personal Agent Hooks</h4>
                <p>Siri, Alexa, Claude book directly</p>
              </div>
              <div className="one-pager-future-item">
                <div className="icon">🧠</div>
                <h4>Context Compounds</h4>
                <p>Every interaction = smarter</p>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="one-pager-bottom-row">
            {/* Pricing */}
            <div>
              <div className="one-pager-section-label">Business Model</div>
              <h3>Simple SaaS</h3>
              <table className="one-pager-pricing-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Price</th>
                    <th>Includes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Foundation</td>
                    <td>$49/mo</td>
                    <td>Website + booking</td>
                  </tr>
                  <tr>
                    <td>
                      System<span className="one-pager-popular-badge">★</span>
                    </td>
                    <td>$149/mo</td>
                    <td>+ AI chatbot</td>
                  </tr>
                  <tr>
                    <td>Partnership</td>
                    <td>Custom</td>
                    <td>Done-for-you</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '10px', marginTop: '6px' }}>
                85%+ margins • No contracts • 14-day trial
              </p>
            </div>

            {/* Why Now */}
            <div>
              <div className="one-pager-section-label">Why Now</div>
              <h3>The Industry is Scrambling</h3>
              <ul className="one-pager-why-now-list">
                <li>
                  <strong>Competitors are retrofitting</strong> — bolting AI onto legacy systems
                </li>
                <li>
                  <strong>We're AI-native</strong> — built from scratch around agents
                </li>
                <li>
                  <strong>2026 = agent year</strong> — personal AIs will book services
                </li>
                <li>
                  <strong>First-mover window</strong> — 12-18 months to own the category
                </li>
              </ul>
            </div>

            {/* Tech */}
            <div>
              <div className="one-pager-section-label">Technical Edge</div>
              <h3>Production-Ready</h3>
              <ul className="one-pager-tech-list">
                <li>Multi-tenant SaaS, enterprise isolation</li>
                <li>Claude-powered AI agents throughout</li>
                <li>Event-sourced state (XState v5)</li>
                <li>Real-time sync to storefront</li>
                <li>99.7% test coverage</li>
                <li>Public beta — open signup</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="one-pager-footer">
          <div className="one-pager-founder-note">
            <strong>Mike Young, Founder</strong> — 20 years running service businesses. Chef.
            Photographer. I built this because I needed it.
          </div>
          <div className="one-pager-contact-info">
            <div className="one-pager-contact-item">
              <span>Web</span>
              <a href="https://gethandled.ai">gethandled.ai</a>
            </div>
            <div className="one-pager-contact-item">
              <span>Email</span>
              <a href="mailto:mike@gethandled.ai">mike@gethandled.ai</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
