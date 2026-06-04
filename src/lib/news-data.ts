import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { Article, Category } from './types'

// Function to recursively read all markdown files from content/posts
function loadArticlesFromFiles(): Article[] {
  const articles: Article[] = []
  const contentDir = path.join(process.cwd(), 'content', 'posts')

  if (!fs.existsSync(contentDir)) {
    console.warn('⚠️  content/posts directory not found, returning empty articles')
    return articles
  }

  // Recursively walk through directories
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const fullPath = path.join(dir, file.name)

      if (file.isDirectory()) {
        walkDir(fullPath) // Recursively walk subdirectories
      } else if (file.name.endsWith('.md')) {
        try {
          const fileContent = fs.readFileSync(fullPath, 'utf-8')
          const { data, content } = matter(fileContent)

          // Convert frontmatter to Article type
          const article: Article = {
            id: data.id ? parseInt(data.id, 10) : 0,
            slug: data.slug || file.name.replace('.md', ''),
            title: data.title || 'Untitled',
            excerpt: data.excerpt || '',
            content: content.trim(), // Raw markdown content
            category: data.category || 'travel-news',
            categoryName: data.categoryName || 'Travel News',
            image: data.coverImage || '/images/placeholder.jpg',
            author: data.author || 'Staff Writer',
            date: data.date || new Date().toISOString().split('T')[0],
            readTime: data.readTime || '5 min read',
            featured: data.featured || false,
            tags: Array.isArray(data.tags) ? data.tags : [],
            coverImageCaption: data.coverImageCaption,
          }

          articles.push(article)
        } catch (err) {
          console.error(`❌ Error reading ${fullPath}:`, err)
        }
      }
    }
  }

  walkDir(contentDir)

  // Sort by id (highest first)
  articles.sort((a, b) => b.id - a.id)

  return articles
}

// Load articles from markdown files at runtime
const articles: Article[] = loadArticlesFromFiles()

export * from './constants'

// ─── Helper Functions ──────────────────────────────────────────────────────────
export function getArticlesByCategory(slug: string): Article[] {
  return articles.filter(a => a.category === slug)
}

export function getFeaturedArticle(): Article | undefined {
  return articles.find(a => a.featured) || articles[0]
}

export function getLatestArticles(count: number = 8): Article[] {
  return [...articles].sort((a, b) => b.id - a.id).slice(0, count)
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug)
}

export function getRelatedArticles(article: Article, count: number = 3): Article[] {
  return articles
    .filter(a => a.id !== article.id && a.category === article.category)
    .slice(0, count)
}

export function getArticlesByRegion(region: string, regionalMap: Record<string, string[]>): Article[] {
  const keywords = regionalMap[region] || [];
  return articles
    .filter((a) =>
      keywords.some(
        (kw) =>
          a.title.toLowerCase().includes(kw) ||
          a.excerpt.toLowerCase().includes(kw)
      )
    )
    .slice(0, 3);
}

export function getAllArticles(): Article[] {
  return articles
}
