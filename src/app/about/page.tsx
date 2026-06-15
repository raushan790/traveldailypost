import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'About Us | Travel Daily Post',
  description: 'Learn about Travel Daily Post — your trusted global travel news source covering airlines, tourism, hotels, destinations, and more.',
};

const team = [
  {
    name: 'Raushan Kumar',
    role: 'Founder & Lead Developer',
    gradient: 'from-red-500 to-rose-700',
    ring: 'ring-red-200',
    badge: 'from-red-500 to-rose-700',
    image: '/images/raushan-kumar.webp',
    bio: 'Full-stack developer with 11+ years of experience and a passionate traveller. Raushan built Travel Daily Post from the ground up with a vision to create the best travel and news experience on the web.',
    social: {
      facebook: 'https://www.facebook.com/raushan790',
      linkedin: 'https://www.linkedin.com/in/raushan790/',
      instagram: 'https://www.instagram.com/raushantheroska/',
    },
  },
  {
    name: 'Kunal K Choudhary',
    role: 'Co-Founder & Contributor',
    gradient: 'from-violet-500 to-indigo-600',
    ring: 'ring-violet-200',
    badge: 'from-violet-500 to-indigo-600',
    image: '/images/kunal.webp',
    bio: 'A passionate traveller and tech enthusiast. Kunal contributes to the vision and growth of Travel Daily Post, bringing fresh perspectives and driving the community forward.',
    social: {
      facebook: 'https://www.facebook.com/kunal.3110',
      linkedin: 'https://www.linkedin.com/in/kunal-kishore-choudhary-096b73119/',
      instagram: 'https://www.instagram.com/kunal.3110/',
    },
  },
  {
    name: 'Preeti Gunjan',
    role: 'Contributor & Community Manager',
    gradient: 'from-teal-400 to-emerald-600',
    ring: 'ring-teal-200',
    badge: 'from-teal-400 to-emerald-600',
    image: '/images/preeti-gunjan.webp',
    bio: 'A passionate traveller and community builder. Preeti helps grow the Travel Daily Post community, fostering engagement and bringing the reader experience to life.',
    social: {
      facebook: 'https://www.facebook.com/preeti.gunjan.73932',
      instagram: 'https://www.instagram.com/preeti.gunjan.73932/',
    },
  },
  {
    name: 'Naina Thakur',
    role: 'Contributor & Creative Lead',
    gradient: 'from-rose-400 to-pink-600',
    ring: 'ring-rose-200',
    badge: 'from-rose-400 to-pink-600',
    image: '/images/naina.webp',
    bio: 'A creative and enthusiastic storyteller. Naina brings her unique perspective and creativity to Travel Daily Post, helping craft engaging travel stories for readers worldwide.',
    social: {
      facebook: 'https://www.facebook.com/naina.thakur.733',
      linkedin: 'https://www.linkedin.com/in/naina-thakur-4b165299/',
      instagram: 'https://www.instagram.com/nainathakurst/',
    },
  },
];

const stats = [
  { value: '2M+', label: 'Monthly Readers' },
  { value: '50+', label: 'Countries Covered' },
  { value: '10K+', label: 'Articles Published' },
  { value: '24/7', label: 'Breaking News' },
];

export default function About() {
  return (
    <main style={{ background: '#f8f9fa' }}>

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #CC0000 60%, #a00000 100%)',
        color: 'white',
        padding: '80px 0 60px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 50%)',
        }} />
        <div className="container" style={{ position: 'relative' }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
            padding: '5px 16px', borderRadius: 99, marginBottom: 20,
            backdropFilter: 'blur(8px)',
          }}>
            ✈️ About Travel Daily Post
          </span>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 900, lineHeight: 1.1, marginBottom: 20,
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          }}>
            Your Global Window<br />to Travel News
          </h1>
          <p style={{
            fontSize: 18, color: 'rgba(255,255,255,0.85)',
            maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.7,
          }}>
            Travel Daily Post delivers real-time travel news, destination guides, airline updates, and tourism insights to 2 million readers worldwide.
          </p>
          <Link href="/contact" style={{
            display: 'inline-block', background: 'white', color: 'var(--color-primary)',
            fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 13,
            letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none',
            padding: '13px 30px', borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
            Get In Touch →
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section style={{ background: 'white', borderBottom: '1px solid #eee' }}>
        <div className="container">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
          }}>
            {stats.map((stat, idx) => (
              <div key={stat.label} style={{
                textAlign: 'center', padding: '32px 20px',
                borderRight: idx < 3 ? '1px solid #eee' : 'none',
              }}>
                <div style={{
                  fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 900,
                  color: 'var(--color-primary)', lineHeight: 1, marginBottom: 6,
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: '#666', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section style={{ padding: '72px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
            <div>
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--color-primary)', marginBottom: 14,
              }}>
                Our Mission
              </span>
              <h2 style={{
                fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 900,
                lineHeight: 1.2, marginBottom: 20, color: '#1a1a2e',
              }}>
                Keeping Travelers<br />Informed, Always
              </h2>
              <p style={{ color: '#555', lineHeight: 1.8, marginBottom: 16 }}>
                Travel Daily Post was built with a single purpose: to be the most trusted and comprehensive travel news platform in the world. We believe that travel transforms lives, and informed travelers make better decisions.
              </p>
              <p style={{ color: '#555', lineHeight: 1.8 }}>
                From breaking airline disruptions to hidden gem destination spotlights, our team of experienced journalists covers every corner of the globe — so you never miss a story that matters.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { icon: '🛫', title: 'Airline News', desc: 'Route launches, disruptions, and industry updates' },
                { icon: '🏨', title: 'Hotel News', desc: 'Openings, reviews, and hospitality trends' },
                { icon: '🚢', title: 'Cruise News', desc: 'Itineraries, ports, and cruise industry news' },
                { icon: '🌍', title: 'Destinations', desc: 'Travel guides, visa info, and tourism trends' },
              ].map((item) => (
                <div key={item.title} style={{
                  background: 'white', borderRadius: 12, padding: '24px 20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  borderTop: '3px solid var(--color-primary)',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1a1a2e', marginBottom: 6 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section style={{ padding: '72px 0', background: 'white' }}>
        <div className="container">

          {/* Section Header */}
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 56px' }}>
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--color-primary)', marginBottom: 14,
            }}>
              The Team
            </span>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 900, lineHeight: 1.2, color: '#1a1a2e', marginBottom: 16,
            }}>
              Meet the Contributors
            </h2>
            <p style={{ color: '#888', fontSize: 16, lineHeight: 1.7 }}>
              The passionate journalists and editors behind every story, insight, and travel update on Travel Daily Post.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
              <div style={{ height: 4, width: 48, borderRadius: 99, background: 'var(--color-primary)' }} />
              <div style={{ height: 4, width: 16, borderRadius: 99, background: '#f0a0a0' }} />
              <div style={{ height: 4, width: 8, borderRadius: 99, background: '#f5c8c8' }} />
            </div>
          </div>

          {/* Team Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
          }}>
            {team.map((member) => (
              <div key={member.name} className="team-card" style={{
                background: 'white', borderRadius: 16,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}>
                {/* Color bar */}
                <div style={{
                  height: 6,
                  background: `linear-gradient(to right, var(--tw-gradient-from, #CC0000), var(--tw-gradient-to, #a00000))`,
                  backgroundImage: member.gradient.includes('blue')
                    ? 'linear-gradient(to right, #3b82f6, #4338ca)'
                    : member.gradient.includes('teal')
                    ? 'linear-gradient(to right, #14b8a6, #059669)'
                    : member.gradient.includes('amber')
                    ? 'linear-gradient(to right, #f59e0b, #c2410c)'
                    : member.gradient.includes('violet')
                    ? 'linear-gradient(to right, #8b5cf6, #7c3aed)'
                    : 'linear-gradient(to right, #CC0000, #a00000)',
                }} />

                <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    overflow: 'hidden', position: 'relative',
                    marginBottom: 16,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    flexShrink: 0,
                    border: '3px solid white',
                    outline: '3px solid rgba(204,0,0,0.2)',
                  }}>
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="80px"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>

                  <h3 style={{
                    fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 800,
                    color: '#1a1a2e', marginBottom: 8,
                  }}>
                    {member.name}
                  </h3>

                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700,
                    padding: '4px 14px', borderRadius: 99, color: 'white',
                    marginBottom: 16,
                    backgroundImage: member.gradient.includes('blue')
                      ? 'linear-gradient(to right, #3b82f6, #4338ca)'
                      : member.gradient.includes('teal')
                      ? 'linear-gradient(to right, #14b8a6, #059669)'
                      : member.gradient.includes('amber')
                      ? 'linear-gradient(to right, #f59e0b, #c2410c)'
                      : member.gradient.includes('violet')
                      ? 'linear-gradient(to right, #8b5cf6, #7c3aed)'
                      : 'linear-gradient(to right, #CC0000, #a00000)',
                  }}>
                    {member.role}
                  </span>

                  <p style={{ fontSize: 13, color: '#777', lineHeight: 1.65, flex: 1, marginBottom: 20 }}>
                    {member.bio}
                  </p>

                  <div style={{ width: 40, height: 1, background: '#e5e7eb', marginBottom: 16 }} />

                  {/* Social */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {member.social.facebook && (
                      <a href={member.social.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on Facebook`} style={{
                        width: 36, height: 36, borderRadius: '50%', border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#666', textDecoration: 'none',
                      }}>
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.522-4.477-10-10-10S2 6.478 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.988H7.9V12h2.538V9.797c0-2.506 1.493-3.89 3.774-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.563V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                      </a>
                    )}
                    {member.social.linkedin && (
                      <a href={member.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn`} style={{
                        width: 36, height: 36, borderRadius: '50%', border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#666', textDecoration: 'none',
                      }}>
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                    {member.social.instagram && (
                      <a href={member.social.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on Instagram`} style={{
                        width: 36, height: 36, borderRadius: '50%', border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#666', textDecoration: 'none',
                      }}>
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: 'linear-gradient(135deg, #1a1a2e, #CC0000)',
        color: 'white', padding: '60px 0', textAlign: 'center',
      }}>
        <div className="container">
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 900, marginBottom: 14 }}>
            Have a Story Tip or Feedback?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 28 }}>
            We'd love to hear from you. Get in touch with our editorial team.
          </p>
          <Link href="/contact" style={{
            display: 'inline-block', background: 'white', color: 'var(--color-primary)',
            fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 13,
            letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none',
            padding: '13px 32px', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
            Contact Us →
          </Link>
        </div>
      </section>

    </main>
  );
}
