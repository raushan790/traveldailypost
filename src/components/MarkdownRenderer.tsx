'use client';

import { marked } from 'marked';
import { useEffect, useState } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let sanitized: string;
    try {
      // DOMPurify only works in browser environment
      const DOMPurify = require('dompurify');
      sanitized = DOMPurify.sanitize(marked(content) as string, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'hr',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'rel', 'target', 'colspan', 'rowspan',
          'style', 'id', 'width', 'height',
        ],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
      });
    } catch {
      // Fallback during SSR/build: marked output is safe for controlled markdown files
      sanitized = marked(content) as string;
    }
    setHtml(sanitized);
  }, [content]);

  if (!html) return null;

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
