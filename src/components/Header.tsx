"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { categories, breakingNews } from '@/lib/constants';
import BreakingNewsTicker from './BreakingNewsTicker';
import SearchModal from './SearchModal';

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = mounted ? new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';

  return (
    <header className="site-header">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="container">
          <span className="top-bar-date">{today}</span>
          <div className="top-bar-socials">
            <a href="https://x.com/rinovative007" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="X (Twitter)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://www.facebook.com/traveldailypost" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Facebook">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com/raushantheroska/" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            </a>
            <a href="https://www.youtube.com/@traveldailypost" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="YouTube">
              <svg width="17" height="12" viewBox="0 0 24 17" fill="currentColor">
                <path d="M23.495 2.205a3.02 3.02 0 0 0-2.123-2.137C19.505 0 12 0 12 0S4.503 0 2.627.073a3.02 3.02 0 0 0-2.122 2.136C0 4.073 0 8.5 0 8.5s0 4.427.505 6.296a3.02 3.02 0 0 0 2.122 2.137C4.503 17 12 17 12 17s7.495 0 9.372-.072a3.02 3.02 0 0 0 2.123-2.137C24 12.927 24 8.5 24 8.5s0-4.427-.505-6.295zM9.545 12.068V4.932L15.818 8.5l-6.273 3.568z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="header-main">
        <div className="container">
          <Link href="/" className="site-logo" aria-label="Travel Daily Post - Home">
            <span className="logo-name">Travel<span> Daily Post</span></span>
            <span className="logo-tagline">Your Global Travel News Source</span>
          </Link>

          <div className="header-actions">
            <button
              className="search-trigger"
              aria-label="Search"
              onClick={() => setIsSearchOpen(true)}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
            <button 
              className="hamburger-btn" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isMobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </>
                ) : (
                  <>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <div className="container">
          <ul className="nav-list" role="list">
            {categories.map((cat) => (
              <li key={cat.slug} className="nav-item">
                <Link href={`/category/${cat.slug}`} onClick={() => setIsMobileMenuOpen(false)}>
                  {cat.name}
                </Link>
              </li>
            ))}
            <li className="nav-item">
              <Link href="/about" onClick={() => setIsMobileMenuOpen(false)}>
                About Us
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                Contact Us
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Breaking News */}
      <BreakingNewsTicker items={breakingNews} />

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
