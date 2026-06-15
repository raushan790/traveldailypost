'use client';

import { Metadata } from 'next';
import { useState } from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would send this data to a backend service
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <main className="content-main">
      <div className="container">
        <article className="page-content">
          <div className="page-header">
            <h1>Contact Us</h1>
            <p className="lead">Get in touch with the Travel Daily Post team.</p>
          </div>

          <div className="contact-container">
            <section className="contact-info">
              <h2>Get In Touch</h2>
              <p>
                Have a story tip, feedback, or partnership inquiry? We'd love to hear from you. 
                Fill out the form below and we'll get back to you as soon as possible.
              </p>

              <div className="contact-details">
                <div className="contact-item">
                  <h3>Email</h3>
                  <p>
                    <a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
                  </p>
                </div>

                <div className="contact-item">
                  <h3>For Story Tips</h3>
                  <p>
                    <a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
                  </p>
                </div>

                <div className="contact-item">
                  <h3>For Advertising</h3>
                  <p>
                    <a href="mailto:contact@traveldailypost.com">contact@traveldailypost.com</a>
                  </p>
                </div>

                <div className="contact-item">
                  <h3>Follow Us</h3>
                  <div className="social-links">
                    <a href="https://x.com/rinovative007" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
                    <a href="https://www.facebook.com/traveldailypost" target="_blank" rel="noopener noreferrer">Facebook</a>
                    <a href="https://www.instagram.com/raushantheroska/" target="_blank" rel="noopener noreferrer">Instagram</a>
                    <a href="https://www.youtube.com/@traveldailypost" target="_blank" rel="noopener noreferrer">YouTube</a>
                  </div>
                </div>
              </div>
            </section>

            <section className="contact-form-section">
              <h2>Send us a Message</h2>
              {submitted && (
                <div className="form-success-message">
                  <p>✓ Thank you for your message! We'll get back to you soon.</p>
                </div>
              )}
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Your name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="your.email@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder="What is this about?"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={7}
                    placeholder="Your message here..."
                  />
                </div>

                <button type="submit" className="submit-button">
                  Send Message
                </button>
              </form>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
