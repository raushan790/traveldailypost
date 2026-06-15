import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advertise With Us | Travel Daily Post',
  description: 'Reach millions of travel enthusiasts. Learn about advertising opportunities with Travel Daily Post.',
};

export default function Advertise() {
  return (
    <main className="content-main">
      <div className="container">
        <article className="page-content">
          <div className="page-header">
            <h1>Advertise With Us</h1>
            <p className="lead">Reach millions of travel enthusiasts worldwide</p>
          </div>

            <section className="content-section">
              <h2>Why Advertise with Travel Daily Post?</h2>
              <p>
                Travel Daily Post reaches over 2 million readers monthly who are passionate about travel. Our audience includes frequent travelers, travel professionals, and decision-makers in the travel industry. Partnering with us gives your brand access to a highly engaged and relevant audience.
              </p>
            </section>

          <section className="content-section">
            <h2>Advertising Opportunities</h2>
            <ul className="content-list">
              <li><strong>Display Advertising:</strong> Banner ads across our website and content pages</li>
              <li><strong>Native Advertising:</strong> Sponsored content that fits naturally within our editorial</li>
              <li><strong>Newsletter Sponsorships:</strong> Reach our engaged email subscriber base</li>
              <li><strong>Video Advertising:</strong> Premium video placement on our content</li>
              <li><strong>Affiliate Opportunities:</strong> Commission-based partnerships for travel products and services</li>
              <li><strong>Custom Campaigns:</strong> Tailored promotional solutions for your brand</li>
            </ul>
          </section>

          <section className="content-section">
            <h2>Our Reach</h2>
            <ul className="content-list">
              <li>2+ million monthly readers</li>
              <li>Global audience across 150+ countries</li>
              <li>Highly engaged travel enthusiasts and professionals</li>
              <li>Strong presence in social media with 500K+ followers</li>
            </ul>
          </section>

            <section className="content-section">
              <h2>Get Started</h2>
              <p>
                Ready to advertise with Travel Daily Post? Contact our advertising team to discuss your campaign goals and find the perfect solution for your brand.
                <br/><br/>
                <a href="mailto:contact@traveldailypost.com" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>contact@traveldailypost.com</a>
              </p>
            </section>
        </article>
      </div>
    </main>
  );
}
