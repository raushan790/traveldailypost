'use client';
import { useState } from 'react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setStatus('success');
      setEmail('');
    } else {
      setStatus('error');
    }
  };

  return (
    <section className="newsletter-section" aria-labelledby="newsletter-heading">
      <div className="container">
        <div className="newsletter-inner">
          <div className="newsletter-icon" aria-hidden="true">✈️</div>
          <h2 className="newsletter-title" id="newsletter-heading">
            Stay Ahead of the World
          </h2>
          <p className="newsletter-subtitle">
            Get the latest travel news, destination guides, and industry insights delivered to your inbox — free, every morning.
          </p>

          {status === 'success' ? (
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '18px 24px', color: 'white', fontWeight: 600, fontSize: 16 }}>
              🎉 You&apos;re subscribed! Welcome to Travel Daily Post.
            </div>
          ) : (
            <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
              <input
                type="email"
                className="newsletter-input"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address for newsletter"
                aria-describedby={status === 'error' ? 'newsletter-error' : undefined}
              />
              <button type="submit" className="newsletter-btn">
                Subscribe
              </button>
            </form>
          )}

          {status === 'error' && (
            <p id="newsletter-error" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 }}>
              Please enter a valid email address.
            </p>
          )}

          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>
            No spam. Unsubscribe anytime. By subscribing you agree to our Privacy Policy.
          </p>
        </div>
      </div>
    </section>
  );
}
