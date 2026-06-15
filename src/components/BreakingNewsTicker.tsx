'use client';

import { useState, useEffect } from 'react';

interface BreakingNewsTickerProps {
  items: string[];
}

export default function BreakingNewsTicker({ items: fallbackItems }: BreakingNewsTickerProps) {
  const [items, setItems] = useState<string[]>(fallbackItems || []);

  useEffect(() => {
    fetch('/api/articles')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setItems(data.slice(0, 5).map((a: any) => a.title));
        }
      })
      .catch(console.error);
  }, []);

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
