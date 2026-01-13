'use client';

export default function OnePagerPage() {
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600&display=swap');

        :root {
          --surface: #f7f2e9;
          --surface-alt: #efe6d8;
          --surface-glow: #fff6e7;
          --sage: #1f8a70;
          --sage-light: #2ea989;
          --accent-warm: #d88a3f;
          --text-primary: #1f1b16;
          --text-muted: #5f5850;
          --border: #d7cbbd;
          --shadow: rgba(26, 21, 14, 0.12);
          --shadow-strong: rgba(26, 21, 14, 0.22);
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family:
            'Space Grotesk',
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
          background:
            radial-gradient(1200px 540px at 6% -10%, #fff1d9 0%, rgba(255, 241, 217, 0) 60%),
            radial-gradient(900px 620px at 110% 10%, #d7ece6 0%, rgba(215, 236, 230, 0) 55%),
            var(--surface);
          color: var(--text-primary);
          line-height: 1.55;
          min-height: 100vh;
          overflow: auto;
        }

        .one-pager-page {
          min-height: 100vh;
          padding: 20px 28px;
          display: flex;
          flex-direction: column;
          max-width: 1400px;
          margin: 18px auto;
          background: rgba(255, 251, 244, 0.9);
          border: 1px solid var(--border);
          border-radius: 28px;
          box-shadow:
            0 30px 80px -50px var(--shadow-strong),
            0 18px 45px -35px var(--shadow);
          backdrop-filter: blur(14px);
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Header */
        .one-pager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          animation: fadeUp 0.45s ease both;
        }

        .one-pager-brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .one-pager-logo {
          font-family: 'Fraunces', serif;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.4px;
        }

        .one-pager-tagline {
          font-size: 12px;
          color: var(--sage);
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        .one-pager-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          background: var(--sage);
          color: #fff;
          text-decoration: none;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
          box-shadow: 0 12px 20px -16px rgba(31, 138, 112, 0.6);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .one-pager-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 26px -16px rgba(31, 138, 112, 0.7);
        }

        /* Section Styles */
        .one-pager-section-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--sage);
          margin-bottom: 8px;
        }

        .one-pager-content h2 {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
          line-height: 1.25;
        }

        .one-pager-content h3 {
          font-family: 'Fraunces', serif;
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .one-pager-content h4 {
          font-size: 11px;
          font-weight: 600;
          color: var(--sage);
          margin-bottom: 4px;
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
          gap: 12px;
          min-height: 0;
        }

        .one-pager-content > * {
          animation: fadeUp 0.6s ease both;
        }

        .one-pager-content > *:nth-child(1) {
          animation-delay: 0.05s;
        }

        .one-pager-content > *:nth-child(2) {
          animation-delay: 0.12s;
        }

        .one-pager-content > *:nth-child(3) {
          animation-delay: 0.18s;
        }

        .one-pager-content > *:nth-child(4) {
          animation-delay: 0.24s;
        }

        /* Top Row */
        .one-pager-top-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* Problem Section */
        .one-pager-problem {
          background: var(--surface-alt);
          border-radius: 18px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          box-shadow:
            0 16px 30px -18px var(--shadow-strong),
            0 6px 12px -10px var(--shadow);
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
          color: #c65d3a;
          font-weight: 600;
        }

        /* Screenshot */
        .one-pager-screenshot {
          background: linear-gradient(135deg, #f6ecde 0%, #efe2d0 100%);
          border-radius: 18px;
          border: 1px solid var(--border);
          padding: 14px;
          box-shadow:
            0 22px 30px -22px var(--shadow-strong),
            0 10px 16px -14px var(--shadow);
        }

        .one-pager-screenshot-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: var(--sage);
          margin-bottom: 8px;
          text-align: center;
        }

        .one-pager-screenshot-content {
          background: var(--surface-glow);
          border-radius: 14px;
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
          color: #fff;
        }

        .one-pager-screenshot-title {
          font-size: 11px;
          font-weight: 600;
        }

        .one-pager-screenshot-subtitle {
          font-size: 9px;
          color: var(--text-muted);
        }

        .one-pager-status-pill {
          margin-left: auto;
          background: var(--sage);
          color: #fff;
          font-size: 9px;
          padding: 3px 6px;
          border-radius: 999px;
          font-weight: 600;
        }

        .one-pager-memory-tag {
          background: rgba(31, 138, 112, 0.12);
          border: 1px solid rgba(31, 138, 112, 0.25);
          border-radius: 10px;
          padding: 6px 10px;
          margin-bottom: 6px;
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
          line-height: 1.35;
        }

        .one-pager-screenshot-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }

        .one-pager-screenshot-meta-block {
          font-size: 9px;
          color: var(--text-muted);
        }

        .one-pager-screenshot-meta-block strong {
          color: var(--sage);
          font-weight: 600;
        }

        .one-pager-screenshot-meta-right {
          text-align: right;
        }

        /* Solution Section */
        .one-pager-solution-row {
          display: grid;
          grid-template-columns: 1.05fr 2fr;
          gap: 12px;
          align-items: start;
        }

        .one-pager-solution-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .one-pager-feature-card {
          background: #fffaf2;
          border-radius: 18px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          box-shadow:
            0 8px 14px -12px var(--shadow),
            0 2px 6px -6px var(--shadow);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .one-pager-feature-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 14px 24px -18px var(--shadow-strong),
            0 6px 10px -10px var(--shadow);
        }

        .one-pager-feature-card p {
          font-size: 9px;
          margin-bottom: 0;
          line-height: 1.35;
        }

        /* Future Section */
        .one-pager-future-section {
          background: linear-gradient(
            135deg,
            rgba(31, 138, 112, 0.14) 0%,
            rgba(31, 138, 112, 0.05) 100%
          );
          border: 1px solid rgba(31, 138, 112, 0.28);
          border-radius: 18px;
          padding: 12px 16px;
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 12px;
          align-items: center;
          box-shadow:
            0 14px 22px -18px var(--shadow),
            0 6px 10px -10px var(--shadow);
        }

        .one-pager-future-section h2 {
          color: var(--sage);
          font-size: 17px;
          margin-bottom: 6px;
        }

        .one-pager-future-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
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
          gap: 14px;
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
          background: var(--accent-warm);
          color: #fff;
          font-size: 8px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 999px;
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
        .one-pager-proof-list {
          list-style: none;
          margin-top: 8px;
        }

        .one-pager-proof-list li {
          font-size: 10px;
          color: var(--text-muted);
          margin-bottom: 5px;
          padding-left: 14px;
          position: relative;
        }

        .one-pager-proof-list li::before {
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
          padding-top: 12px;
          border-top: 1px solid var(--border);
          margin-top: 10px;
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
          font-weight: 600;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }

        /* Print Styles */
        @media print {
          body {
            background: #fff;
            color: var(--text-primary);
            min-height: auto;
            line-height: 1.45;
          }

          .one-pager-page {
            padding: 18px 22px;
            min-height: 0;
            width: 10.5in;
            height: 8in;
            margin: 0 auto;
            border-radius: 0;
            box-shadow: none;
            background: #fff;
            page-break-inside: avoid;
          }

          .one-pager-content {
            gap: 12px;
          }

          .one-pager-top-row,
          .one-pager-solution-row,
          .one-pager-future-section,
          .one-pager-bottom-row {
            gap: 10px;
            page-break-inside: avoid;
          }

          .one-pager-header {
            margin-bottom: 10px;
            padding-bottom: 8px;
          }

          .one-pager-logo {
            font-size: 24px;
          }

          .one-pager-tagline {
            font-size: 11px;
          }

          .one-pager-cta {
            font-size: 10px;
          }

          .one-pager-content h2 {
            font-size: 18px;
          }

          .one-pager-content h3 {
            font-size: 13px;
          }

          .one-pager-content h4 {
            font-size: 10px;
          }

          .one-pager-content p {
            font-size: 11px;
          }

          .one-pager-problem,
          .one-pager-screenshot {
            padding: 12px 14px;
          }

          .one-pager-problem-list li,
          .one-pager-why-now-list li {
            font-size: 10px;
          }

          .one-pager-solution-grid {
            gap: 8px;
          }

          .one-pager-feature-card {
            padding: 8px 10px;
          }

          .one-pager-feature-card p,
          .one-pager-future-item p,
          .one-pager-proof-list li {
            font-size: 8px;
          }

          .one-pager-future-section {
            padding: 10px 12px;
          }

          .one-pager-future-section h2 {
            font-size: 15px;
          }

          .one-pager-footer {
            margin-top: 6px;
            padding-top: 8px;
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
            margin: 0;
            border-radius: 0;
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
            color: #fff;
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
          margin: 0.25in;
        }
      `}</style>

      <div className="one-pager-page">
        <header className="one-pager-header">
          <div className="one-pager-brand">
            <div className="one-pager-logo">Handled</div>
            <div className="one-pager-tagline">The rest is Handled.</div>
          </div>
          <a className="one-pager-cta" href="mailto:mike@gethandled.ai">
            Start My Free Growth Audit
          </a>
        </header>

        <div className="one-pager-content">
          {/* Top Row: Problem + Session Space */}
          <div className="one-pager-top-row">
            <div className="one-pager-problem">
              <div className="one-pager-section-label">The Problem</div>
              <h2>Stop drowning in admin. Start growing your business.</h2>
              <p>
                You lose 20-30% of your week to scheduling, invoices, and follow-ups. The tools keep
                multiplying, and it starts to feel like a second job you never asked for.
              </p>
              <ul className="one-pager-problem-list">
                <li>Leads scattered across email, text, and DMs</li>
                <li>Manual booking, invoicing, and follow-up</li>
                <li>Client preferences lost between sessions</li>
                <li>Patchwork websites that do not convert</li>
              </ul>
            </div>

            <div className="one-pager-screenshot">
              <div className="one-pager-screenshot-label">Session Space - One Link Per Client</div>
              <div className="one-pager-screenshot-content">
                <div className="one-pager-screenshot-header">
                  <div className="one-pager-screenshot-avatar">SJ</div>
                  <div>
                    <div className="one-pager-screenshot-title">Sarah's Session</div>
                    <div className="one-pager-screenshot-subtitle">Essential Package • Jan 9</div>
                  </div>
                  <div className="one-pager-status-pill">Active</div>
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
                    Prefers candid shots • Loves golden hour • Usually runs 5 min late • Likes
                    outdoor locations
                  </div>
                </div>
                <div className="one-pager-screenshot-meta">
                  <div className="one-pager-screenshot-meta-block">
                    <div style={{ marginBottom: '4px' }}>Things to do • 2/4</div>
                    <strong>✓ Paid</strong> <strong>✓ Calendar</strong>
                    <br />
                    <span>○ Location</span> <span>○ Outfits</span>
                  </div>
                  <div className="one-pager-screenshot-meta-block one-pager-screenshot-meta-right">
                    <div style={{ marginBottom: '4px' }}>Activity</div>
                    <strong>3 messages</strong> • <span>1 file</span>
                    <br />
                    <strong>↻ Synced</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Solution Row */}
          <div className="one-pager-solution-row">
            <div>
              <div className="one-pager-section-label">The Solution</div>
              <h2>Done-for-you tech. Done-with-you education.</h2>
              <p>
                We handle your scheduling, payments, and marketing so you can focus on what you do
                best. Join 50+ business owners who've escaped the admin trap.
              </p>
            </div>
            <div className="one-pager-solution-grid">
              <div className="one-pager-feature-card">
                <h4>Website That Works</h4>
                <p>Launch fast and update copy without a template fight.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Bookings on Autopilot</h4>
                <p>Clients book themselves and reminders go out automatically.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Session Space</h4>
                <p>One link per job with chat, files, checklist.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Client Memory</h4>
                <p>Preferences carry forward so clients feel remembered.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Marketing That Works</h4>
                <p>Campaigns and follow-ups stay consistent without extra effort.</p>
              </div>
              <div className="one-pager-feature-card">
                <h4>Signal Inbox</h4>
                <p>Noise gets filtered; you see what matters.</p>
              </div>
            </div>
          </div>

          {/* Built for the Future Section */}
          <div className="one-pager-future-section">
            <div>
              <div className="one-pager-section-label">The Plan</div>
              <h2>The Growth Partnership Method.</h2>
              <p style={{ marginBottom: 0, fontSize: '11px' }}>
                Discovery call, custom blueprint, launch and partner. We build it, you focus on
                clients.
              </p>
            </div>
            <div className="one-pager-future-grid">
              <div className="one-pager-future-item">
                <div className="icon">01</div>
                <h4>Discovery Call</h4>
                <p>30 minutes to understand your business and spot revenue leaks.</p>
              </div>
              <div className="one-pager-future-item">
                <div className="icon">02</div>
                <h4>Custom Blueprint</h4>
                <p>Booking, payments, website, marketing designed around you.</p>
              </div>
              <div className="one-pager-future-item">
                <div className="icon">03</div>
                <h4>Launch & Partner</h4>
                <p>We implement everything; you focus on clients.</p>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="one-pager-bottom-row">
            {/* Pricing */}
            <div>
              <div className="one-pager-section-label">Membership</div>
              <h3>One Monthly Fee</h3>
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
                Keep 100% of your bookings • Cancel anytime • 14-day trial
              </p>
            </div>

            {/* Outcomes */}
            <div>
              <div className="one-pager-section-label">Outcomes</div>
              <h3>Results You Can Feel Fast</h3>
              <ul className="one-pager-why-now-list">
                <li>
                  <strong>Bookings on Autopilot</strong> - members save 15 hours per week on average
                </li>
                <li>
                  <strong>Marketing That Works</strong> - average member sees 30% revenue increase
                  in 90 days
                </li>
                <li>
                  <strong>Website That Works for You</strong> - from zero to live in 10 days
                </li>
              </ul>
            </div>

            {/* Proof */}
            <div>
              <div className="one-pager-section-label">Trust</div>
              <h3>Proof + Risk Reversal</h3>
              <ul className="one-pager-proof-list">
                <li>50+ businesses supported</li>
                <li>$2M+ revenue managed</li>
                <li>4.9 star rating</li>
                <li>No credit card required</li>
                <li>Live in under 2 weeks</li>
                <li>Your dedicated growth partner</li>
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
