import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use | Travel Daily Post',
  description: 'Review the terms and conditions for using Travel Daily Post.',
};

export default function TermsOfUse() {
  return (
    <main className="content-main">
      <div className="container">
        <article className="page-content">
          <div className="page-header">
            <h1>Terms of Use</h1>
            <p className="lead">Last updated: March 2026</p>
          </div>

          <section className="content-section">
            <h2>Agreement to Terms</h2>
            <p>
              By accessing and using Travel Daily Post (the "Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="content-section">
            <h2>Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on Travel Daily Post for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="content-list">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to decompile or reverse engineer any software contained on the Service</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or "mirror" the materials on any other server</li>
            </ul>
          </section>

          <section className="content-section">
            <h2>Disclaimer</h2>
            <p>
              The materials on Travel Daily Post are provided on an 'as is' basis. Travel Daily Post makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section className="content-section">
            <h2>Limitations</h2>
            <p>
              In no event shall Travel Daily Post or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Travel Daily Post, even if we or our authorized representative has been notified orally or in writing of the possibility of such damage.
            </p>
          </section>

          <section className="content-section">
            <h2>Contact Us</h2>
            <p>
              If you have any questions about these Terms of Use, please contact us at:
              <br/><a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
