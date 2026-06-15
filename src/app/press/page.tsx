import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Press Releases | Travel Daily Post',
  description: 'Latest press releases and announcements from Travel Daily Post.',
};

export default function PressReleases() {
  return (
    <main className="content-main">
      <div className="container">
        <article className="page-content">
            <div className="page-header">
              <h1>Press Releases</h1>
              <p className="lead">Latest announcements and news from Travel Daily Post</p>
            </div>

          <section className="content-section">
            <h2>Latest Press Releases</h2>
              <p>
                Stay updated with the latest news and announcements from Travel Daily Post. For media inquiries or to request an interview with our team, please contact our press office.
              </p>
          </section>

            <section className="content-section">
              <h2>About Press Coverage</h2>
              <p>
                Travel Daily Post is regularly featured in major media outlets for our coverage of travel news and industry trends. Our journalists and editors are available for interviews and commentary on travel industry topics.
              </p>
            </section>

          <section className="content-section">
            <h2>Media Inquiries</h2>
            <p>
              For press inquiries, interview requests, or media information, please contact:
              <br/><br/>
               <strong>Press Office</strong>
               <br/>
               <a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
               <br/><br/>
              We typically respond to press inquiries within 24 hours during business days.
            </p>
          </section>

          <section className="content-section">
            <h2>Company Information</h2>
            <ul className="content-list">
              <li>Founded: 2023</li>
              <li>Headquarters: Global (Remote)</li>
              <li>Reach: 2+ million readers monthly</li>
              <li>Coverage: Travel news, tourism, airlines, hotels, destinations, and more</li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
