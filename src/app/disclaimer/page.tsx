import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimer | Travel Daily Post',
  description: 'Important disclaimer regarding Travel Daily Post content.',
};

export default function Disclaimer() {
  return (
    <main className="content-main">
      <div className="container">
        <article className="page-content">
          <div className="page-header">
            <h1>Disclaimer</h1>
            <p className="lead">Important Information</p>
          </div>

          <section className="content-section">
            <h2>General Disclaimer</h2>
            <p>
              The information provided by Travel Daily Post ("we", "us", "our", or "Company") on our website (the "Service") is for general informational purposes only. All information on the Service is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Service.
            </p>
          </section>

          <section className="content-section">
            <h2>External Links Disclaimer</h2>
            <p>
              The Service may contain (or you may be sent through the Service) links to other websites ("External Links") as well as articles and other content belonging to or originating from other websites. We are not responsible for examining or evaluating, and we do not warrant the offerings of (including the information, the products or the services offered and available through) any of these websites, nor are we responsible for any of their content.
            </p>
          </section>

          <section className="content-section">
            <h2>Professional Disclaimer</h2>
            <p>
              If the Service contains information that pertains to health, legal or financial matters, the information is not professional advice. You should not rely on the information on the Service to make or forego decisions related to health, legal or financial matters. Rather, you should consult with appropriate professionals before making any such decisions.
            </p>
          </section>

          <section className="content-section">
            <h2>Liability Limitations</h2>
            <p>
              Under no circumstance shall Travel Daily Post have any liability to you in connection with any event or occurrence related to the use of the Service. These limitations shall apply notwithstanding any negligence or gross negligence, but shall not apply in case of willful misconduct.
            </p>
          </section>

          <section className="content-section">
            <h2>Contact Us</h2>
            <p>
              If you have any concerns about this disclaimer, please contact us at:
              <br/><a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
