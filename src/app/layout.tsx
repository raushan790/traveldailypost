import type { Metadata } from 'next';
import '@/styles/globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Script from 'next/script';
import { Inter, Playfair_Display, Roboto_Condensed } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-heading' });
const robotoCondensed = Roboto_Condensed({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-condensed' });

export const metadata: Metadata = {
  metadataBase: new URL('https://traveldailypost.com'),
  title: {
    default: 'Travel Daily Post – Global Travel News & Tourism Updates',
    template: '%s | Travel Daily Post',
  },
  description: 'Breaking travel news, tourism updates, airline news, hotel news, cruise news, and destination guides. Your trusted global travel news source.',
  keywords: ['travel news', 'tourism news', 'airline news', 'hotel news', 'cruise news', 'destination news', 'travel deals', 'travel alerts'],
  authors: [{ name: 'Travel Daily Post Editorial Team' }],
  creator: 'Travel Daily Post',
  publisher: 'Travel Daily Post',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://traveldailypost.com',
    siteName: 'Travel Daily Post',
    title: 'Travel Daily Post – Global Travel News & Tourism Updates',
    description: 'Breaking travel news, tourism updates, airline news, hotel news, cruise news, and destination guides.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Travel Daily Post',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@rinovative007',
    creator: '@rinovative007',
  },
  verification: {
    google: 'your-google-verification-code',
  },
  alternates: {
    canonical: 'https://traveldailypost.com',
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/icon.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/0/font-awesome/6.5.1/css/all.min.css" />
        <meta name="theme-color" content="#CC0000" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1044498378918575"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {/* Google Analytics 4 */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-0B19BPL6B9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-0B19BPL6B9');
          `}
        </Script>
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${robotoCondensed.variable}`}>
        <a href="#main-content" className="sr-only" style={{ position: 'absolute', top: 8, left: 8, zIndex: 9999, padding: '8px 16px', background: 'var(--color-primary)', color: 'white', borderRadius: 4, fontWeight: 600 }}>

          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="page-main">
          {children}
        </main>
        <div id="sticky-social-icons-container" className="design-sharp alignment-right with-animation hide-in-mobile">
          <ul>
            <li className="fa-brands-fa-linkedin"><a href="https://www.linkedin.com/company/traveldailypost" target="_blank" className="fa-brands-fa-linkedin"><i className="fa-brands fa-linkedin"></i></a></li>
            <li className="fa-brands-fa-facebook-square"><a href="https://www.facebook.com/traveldailypost" target="_blank" className="fa-brands-fa-facebook-square"><i className="fa-brands fa-facebook-square"></i></a></li>
            <li className="fa-brands-fa-x-twitter"><a href="https://x.com/rinovative007" target="_blank" className="fa-brands-fa-x-twitter"><i className="fa-brands fa-x-twitter"></i></a></li>
            <li className="fa-brands-fa-instagram"><a href="https://www.instagram.com/raushantheroska/" target="_blank" className="fa-brands-fa-instagram"><i className="fa-brands fa-instagram"></i></a></li>
            <li className="fa-brands-fa-youtube"><a href="https://www.youtube.com/@traveldailypost" target="_blank" className="fa-brands-fa-youtube"><i className="fa-brands fa-youtube"></i></a></li>
            <li className="fa-solid-fa-envelope"><a href="mailto:your-email@example.com" target="_blank" className="fa-solid-fa-envelope"><i className="fa-solid fa-envelope"></i></a></li>
          </ul>
        </div>
        <Footer />
      </body>
    </html>
  );
}
