import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Travel Daily Post',
  description: 'Learn about how Travel Daily Post protects your privacy.',
};

export default function PrivacyPolicy() {
  return (
    <main className="content-main">
      <div className="container">
        <article className="page-content">
          <div className="page-header">
            <h1>Privacy Policy</h1>
            <p className="lead">Last updated: March 2026</p>
          </div>

          <section className="content-section">
            <h2>Introduction</h2>
            <p>
              Travel Daily Post ("we", "our", or "us") operates the Travel Daily Post website. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our service and the choices you have associated with that data.
            </p>
          </section>

          <section className="content-section">
            <h2>Information Collection and Use</h2>
            <p>
              We collect several different types of information for various purposes to provide and improve our service to you.
            </p>
            <ul className="content-list">
              <li>Personal Data: While using our service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). This may include, but is not limited to: Email address, First name and last name, Phone number, Address, State, Province, ZIP/Postal code, City, Cookies and Usage Data</li>
              <li>Usage Data: We may also collect information on how the service is accessed and used ("Usage Data"). This may include information such as your computer's Internet Protocol address (e.g. IP address), browser type, browser version, the pages you visit, the time and date of your visit, the time spent on those pages, and other diagnostic data.</li>
            </ul>
          </section>

          <section className="content-section">
            <h2>Security of Data</h2>
            <p>
              The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="content-section">
            <h2>Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
              <br/><a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
