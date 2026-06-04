import { Metadata } from 'next';
import {
  getArticlesByCategory,
  getFeaturedArticle,
  getLatestArticles,
  getArticlesByRegion,
} from '@/lib/news-data';
import HeroSection from '@/components/HeroSection';
import LatestNewsTicker from '@/components/LatestNewsTicker';
import CategorySection from '@/components/CategorySection';
import RegionalNews from '@/components/RegionalNews';
import Sidebar from '@/components/Sidebar';
import NewsCard from '@/components/NewsCard';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Travel Daily Post – Global Travel News & Tourism Updates',
  description: 'Breaking travel news, tourism updates, airline news, hotel news, cruise news, and destination guides. Your trusted global travel news source.',
  alternates: { canonical: 'https://traveldailypost.com' },
  openGraph: {
    title: 'Travel Daily Post – Global Travel News & Tourism Updates',
    description: 'Breaking travel news, tourism updates, airline news, hotel news, cruise news, and destination guides.',
    url: 'https://traveldailypost.com',
    type: 'website',
  },
};

const regionalMap: Record<string, string[]> = {
  Europe: ['europe', 'spain', 'france', 'italy', 'uk', 'portugal', 'croatia', 'norway', 'greece'],
  Americas: ['usa', 'america', 'mexico', 'brazil', 'canada', 'florida', 'new york', 'alabama', 'dallas'],
  'Middle East': ['middle east', 'uae', 'dubai', 'saudi', 'qatar', 'bahrain', 'oman', 'kuwait', 'abu dhabi'],
  Asia: ['asia', 'india', 'thailand', 'japan', 'china', 'maldives', 'malaysia', 'singapore', 'indonesia', 'goa', 'penang'],
  Africa: ['africa', 'egypt', 'morocco', 'kenya', 'south africa', 'cape town', 'gambia'],
};


export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://traveldailypost.com/#organization',
        'name': 'Travel Daily Post',
        'url': 'https://traveldailypost.com',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://traveldailypost.com/logo.png',
          'width': 600,
          'height': 60,
        },
        'sameAs': [
          'https://www.facebook.com/traveldailypost',
          'https://x.com/traveldailypost',
          'https://www.instagram.com/traveldailypost',
          'https://www.linkedin.com/company/traveldailypost',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://traveldailypost.com/#website',
        'url': 'https://traveldailypost.com',
        'name': 'Travel Daily Post',
        'publisher': { '@id': 'https://traveldailypost.com/#organization' },
        'potentialAction': {
          '@type': 'SearchAction',
          'target': 'https://traveldailypost.com/search?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  const featured = getFeaturedArticle();
  const secondary = featured ? getLatestArticles(3).filter((a) => a.id !== featured.id).slice(0, 2) : getLatestArticles(2);
  const travelNews = getArticlesByCategory('travel-news').slice(0, 5);
  const tourismNews = getArticlesByCategory('tourism-news');
  const airlineNews = getArticlesByCategory('airline-news');
  const hotelNews = getArticlesByCategory('hotel-news');
  const cruiseNews = getArticlesByCategory('cruise-news');
  const destinationNews = getArticlesByCategory('destination-news');
  const travelDeals = [...getArticlesByCategory('travel-deals'), ...getArticlesByCategory('travel-alerts')];
  const travelTrends = [...getArticlesByCategory('travel-trends'), ...getArticlesByCategory('technology-news')];
  const latest = getLatestArticles(8);
  const trending = getLatestArticles(10).filter((a) => featured ? a.id !== featured.id : true).slice(0, 5);
  const articlesByRegion = {
    Europe: getArticlesByRegion('Europe', regionalMap),
    Americas: getArticlesByRegion('Americas', regionalMap),
    'Middle East': getArticlesByRegion('Middle East', regionalMap),
    Asia: getArticlesByRegion('Asia', regionalMap),
    Africa: getArticlesByRegion('Africa', regionalMap),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <HeroSection featured={featured} secondary={secondary} />

      {/* Latest Headlines Ticker */}
      <LatestNewsTicker articles={latest} />

      {/* Travel News + Sidebar */}
      <section className="home-section" aria-labelledby="section-travel-news">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>
            <div>
              <div className="section-header">
                <h2 className="section-title" id="section-travel-news">Travel News</h2>
                <Link href="/category/travel-news" className="section-view-all">
                  View All
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Full-width featured card */}
                {travelNews[0] && <NewsCard key={travelNews[0].id} article={travelNews[0]} variant="large" priority />}
                {/* 3-column grid below */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {travelNews.slice(1, 4).map((article) => (
                    <NewsCard key={article.id} article={article} variant="default" />
                  ))}
                </div>
              </div>
            </div>
            <Sidebar trendingArticles={trending} />
          </div>
        </div>
      </section>

      {/* Tourism News */}
      <CategorySection title="Tourism News" slug="tourism-news" articles={tourismNews} layout="grid-3" background="gray" />

      {/* Airline News */}
      <CategorySection title="Airline News" slug="airline-news" articles={airlineNews} layout="grid-3" />

      {/* Hotel + Cruise side by side */}
      <section className="home-section home-section--alt" aria-label="Hotel and Cruise news">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div className="section-header">
                <h2 className="section-title">Hotel News</h2>
                <Link href="/category/hotel-news" className="section-view-all">View All →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {hotelNews.slice(0, 2).map((article) => (
                  <NewsCard key={article.id} article={article} variant="horizontal" />
                ))}
              </div>
            </div>
            <div>
              <div className="section-header">
                <h2 className="section-title">Cruise News</h2>
                <Link href="/category/cruise-news" className="section-view-all">View All →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cruiseNews.slice(0, 2).map((article) => (
                  <NewsCard key={article.id} article={article} variant="horizontal" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Destination News */}
      <CategorySection title="Destination News" slug="destination-news" articles={destinationNews} layout="grid-3" background="gray" />

      {/* Travel Deals */}
      <CategorySection title="Travel Deals & Alerts" slug="travel-deals" articles={travelDeals} layout="grid-3" />

      {/* Travel Trends */}
      <CategorySection title="Travel Trends & Technology" slug="travel-trends" articles={travelTrends} layout="grid-2" background="gray" />

      {/* Regional News */}
      <RegionalNews articlesByRegion={articlesByRegion} />
    </>
  );
}
