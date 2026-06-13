'use client';

interface BreakingNewsTickerProps {
  items: string[];
}

export default function BreakingNewsTicker({ items }: BreakingNewsTickerProps) {
  const displayItems = items.length > 0 ? items : ['Loading latest news...'];
  const doubled = [...displayItems, ...displayItems];

  return (
    <div className="breaking-bar" role="complementary" aria-label="Breaking news">
      <div className="breaking-label">
        <span className="breaking-dot" aria-hidden="true" />
        Breaking
      </div>
      <div className="breaking-ticker-wrap">
        <div className="breaking-ticker" aria-live="polite">
          {doubled.map((item, idx) => (
            <span key={idx} className="breaking-ticker-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
