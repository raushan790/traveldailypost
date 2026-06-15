import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArticleBySlug, getRelatedArticles, articles } from '@/lib/news-data';
import NewsCard from '@/components/NewsCard';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Image from 'next/image';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: 'Article Not Found' };

  const publishDate = new Date(article.date).toISOString();

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.tags,
    authors: [{ name: article.author }],
    alternates: { canonical: `https://traveldailypost.com/${slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://traveldailypost.com/${article.slug}`,
      type: 'article',
      publishedTime: publishDate,
      authors: [article.author],
      section: article.categoryName,
      tags: article.tags,
      images: [{ url: article.image, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [article.image],
    },
    other: {
      'news_keywords': article.tags.join(', '),
    },
  };
}

const getAuthorImage = (authorName: string) => {
  if (authorName.includes('Raushan')) return '/images/raushan-kumar.webp';
  if (authorName.includes('Kunal')) return '/images/kunal.webp';
  if (authorName.includes('Preeti')) return '/images/preeti-gunjan.webp';
  if (authorName.includes('Naina')) return '/images/naina.webp';
  return '/images/raushan-kumar.webp';
};

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(article, 3);
  const formattedDate = new Date(article.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: [article.image],
    datePublished: new Date(article.date).toISOString(),
    dateModified: new Date(article.date).toISOString(),
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Travel Daily Post',
      logo: {
        '@type': 'ImageObject',
        url: 'https://traveldailypost.com/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://traveldailypost.com/${article.slug}`,
    },
    articleSection: article.categoryName,
    keywords: article.tags.join(', '),
    url: `https://traveldailypost.com/${article.slug}`,
  };

  const shareUrl = encodeURIComponent(`https://traveldailypost.com/${article.slug}`);
  const shareTitle = encodeURIComponent(article.title);

  return (
    <>
      {/* JSON-LD NewsArticle Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="article-page">
        <div className="container">
          <div className="article-layout">
            {/* Main Content */}
            <article>
              {/* Breadcrumb */}
              <nav className="article-breadcrumb" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span className="breadcrumb-sep" aria-hidden="true">›</span>
                <Link href={`/category/${article.category}`}>{article.categoryName}</Link>
                <span className="breadcrumb-sep" aria-hidden="true">›</span>
                <span aria-current="page" style={{ color: 'var(--color-gray-700)' }}>
                  {article.title}
                </span>
              </nav>

              {/* Article Header */}
              <div className="article-header">
                <Link href={`/category/${article.category}`} className="article-category-badge">
                  {article.categoryName}
                </Link>
                <h1 className="article-title">{article.title}</h1>
                <p className="article-excerpt">{article.excerpt}</p>
                <div className="article-meta">
                  <div className="article-meta-item">
                    <Image
                      src={getAuthorImage(article.author)}
                      alt={article.author}
                      width={24}
                      height={24}
                      className="rounded-full object-cover"
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-gray-200)', marginRight: '4px' }}
                    />
                    <strong>By {article.author}</strong>
                  </div>
                  <div className="article-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {formattedDate}
                  </div>
                  <div className="article-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {article.readTime}
                  </div>
                </div>
              </div>

              {/* Featured Image */}
              <div className="article-featured-image">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 800px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              {article.coverImageCaption ? (
                <p className="image-caption">{article.coverImageCaption}</p>
              ) : (
                <p className="image-caption">Image: {article.categoryName} — Travel Daily Post</p>
              )}

              {/* Article Body */}
              <div className="article-body">
                <MarkdownRenderer content={article.content} />
              </div>

              {/* Share Buttons */}
              <div className="article-share" aria-label="Share this article">
                <span className="share-label">Share:</span>
                <a
                  href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-btn share-btn--twitter"
                  aria-label="Share on Twitter"
                >
                  𝕏 Twitter
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-btn share-btn--facebook"
                  aria-label="Share on Facebook"
                >
                  Facebook
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-btn share-btn--linkedin"
                  aria-label="Share on LinkedIn"
                >
                  LinkedIn
                </a>
                <a
                  href={`https://wa.me/?text=${shareTitle}%20${shareUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="share-btn share-btn--whatsapp"
                  aria-label="Share on WhatsApp"
                >
                  WhatsApp
                </a>
              </div>

              {/* Tags */}
              <div className="article-tags" aria-label="Article tags">
                {article.tags.map((tag) => (
                  <span key={tag} className="article-tag">#{tag}</span>
                ))}
              </div>
            </article>

            {/* Article Sidebar */}
            <aside aria-label="Related content">
              <div className="sidebar">
                <div className="sidebar-widget">
                  <div className="sidebar-widget-header">More in {article.categoryName}</div>
                  <div className="sidebar-widget-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {related.map((rel, idx) => (
                      <Link key={rel.id} href={`/${rel.slug}`} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: idx < related.length - 1 ? '1px solid var(--color-gray-100)' : 'none', alignItems: 'flex-start' }}>
                          <Image src={rel.image} alt={rel.title} width={72} height={54} style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-gray-800)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rel.title}</p>
                            <p style={{ fontSize: '11px', color: 'var(--color-gray-500)', marginTop: 4, fontFamily: 'var(--font-condensed)' }}>
                              {new Date(rel.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

              </div>
            </aside>
          </div>

          {/* Related Articles */}
          {related.length > 0 && (
            <section style={{ marginTop: 48, paddingTop: 32, borderTop: '2px solid var(--color-gray-200)' }} aria-labelledby="related-heading">
              <div className="section-header">
                <h2 className="section-title" id="related-heading">Related Articles</h2>
              </div>
              <div className="news-grid-main news-grid-3">
                {related.map((rel) => (
                  <NewsCard key={rel.id} article={rel} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
