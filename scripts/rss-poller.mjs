#!/usr/bin/env node
/**
 * rss-poller.mjs
 *
 * Fetches RSS feeds, rewrites articles with Claude Haiku 4.5 (4 rotating SEO prompts),
 * generates cover images with gpt-image-1-mini, and updates src/lib/news-data.ts.
 *
 * Optimized for: Google Discover, Google News, Bing News.
 *
 * Required GitHub Secrets:
 *   ANTHROPIC_API_KEY  → Claude Haiku 4.5 (article writing)
 *   OPENAI_API_KEY     → gpt-image-1-mini (cover image generation)
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'
import { XMLParser } from 'fast-xml-parser'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Load .env.local if it exists (for local development)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = fs.existsSync(path.join(process.cwd(), 'src', 'lib'))
  ? process.cwd()
  : path.resolve(__dirname, '..')

const envLocalPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value && !process.env[key]) {
      process.env[key] = value.trim()
    }
  })
}

// ─── Configuration ────────────────────────────────────────────────────────────
const FEED_CONFIG = process.env.FEED_URLS
  ? process.env.FEED_URLS.split(',').map(u => ({ url: u.trim(), category: 'travel-news' }))
  : [
      { url: 'https://www.travelandtourworld.com/news/article/category/travel-news/feed/', category: 'travel-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/tourism-news/feed', category: 'tourism-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/airline-news/feed/', category: 'airline-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/railway-news/feed', category: 'railway-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/cruise-news/feed/', category: 'cruise-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/destination-news/feed/', category: 'destination-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/hotel-news/feed/', category: 'hotel-news' },
      { url: 'https://www.travelandtourworld.com/news/article/category/travel-alert/feed/', category: 'travel-alerts' },
      { url: 'https://www.travelandtourworld.com/news/article/category/travel-deals/feed', category: 'travel-deals' },
      { url: 'https://www.travelandtourworld.com/news/article/category/travel-trends/feed/', category: 'travel-trends' },
      { url: 'https://www.travelandtourworld.com/news/article/category/travel-technology-news/feed/', category: 'technology-news' }
    ]

const SEEN_FILE = path.join(__dirname, 'seen-articles.json')
const NEWS_DATA_FILE = path.join(ROOT, 'src', 'lib', 'news-data.ts')
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'articles')
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES_PER_RUN || '1', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'

// ─── AI Clients ───────────────────────────────────────────────────────────────
function createClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

// ─── Cloudflare R2 Client ─────────────────────────────────────────────────────
function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AUTHORS = ['Raushan Kumar', 'Kunal K Choudhary', 'Preeti Gunjan', 'Naina Thakur']
function randomAuthor() { return AUTHORS[Math.floor(Math.random() * AUTHORS.length)] }

function loadSeenArticles() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))) }
  catch { return new Set() }
}

function saveSeenArticles(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2) + '\n')
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

async function fetchFeed(url) {
  const headers = {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`)
  const xml = await res.text()
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata' })
  const parsed = parser.parse(xml)
  const items = parsed?.rss?.channel?.item || []
  return Array.isArray(items) ? items : [items]
}

function stripHtml(html = '') {
  return (html.__cdata || html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"').replace(/&#8230;/g, '...')
    .replace(/\s{2,}/g, ' ').trim()
}

function toSlug(title = '') {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90)
}

function getDateParts(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { year, month, day, iso: `${year}-${month}-${day}` }
}

function isPublishedToday(dateStr) {
  if (!dateStr) return false
  const articleDate = new Date(dateStr)
  if (isNaN(articleDate)) return false
  const now = new Date()
  const diffInHours = (now - articleDate) / (1000 * 60 * 60)
  return diffInHours <= 48 && diffInHours >= 0
}

// ─── Article Type Detection ──────────────────────────────────────────────────
function detectArticleType(title, tags) {
  const text = (title + ' ' + tags).toLowerCase()
  if (/cancel|delay|flight|airline|airport|runway|aviation|faa|atc|aircraft|departure|arrival/.test(text)) return 'airline'
  if (/hotel|resort|spa|accommodation|lodge|property|bnb|airbnb|michelin|dining/.test(text)) return 'hotel'
  if (/cruise|ship|port|yacht|sail|embark|vessel/.test(text)) return 'cruise'
  if (/visa|passport|entry|border|immigration|permit|customs|citizen/.test(text)) return 'visa'
  if (/train|rail|railway|metro|tram|eurostar|amtrak|station/.test(text)) return 'rail'
  if (/tour|destination|beach|mountain|safari|museum|heritage|park|attraction/.test(text)) return 'destination'
  return 'general'
}

// ─── Keyword Extraction ─────────────────────────────────────────────────────
function extractKeywords(title, tags) {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its',
    'we', 'our', 'they', 'their', 'you', 'your', 'amid', 'over', 'into', 'after', 'before',
    'about', 'more', 'than', 'just', 'also', 'news', '2026', '2025',
  ])
  const words = (title + ' ' + tags)
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))

  const freq = {}
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w)

  return {
    primary: sorted.slice(0, 3).join(' '),
    secondary: sorted.slice(3, 7),
    lsi: sorted.slice(7, 14),
  }
}

// ─── Type-Specific Writing Guidance ─────────────────────────────────────────
const TYPE_GUIDANCE = {
  airline: `ARTICLE TYPE: AIRLINE / AVIATION NEWS
- Lead with specific airline name, airport (IATA code), affected routes, and passenger count
- Include: cause → affected airlines → impacted routes → passenger rights → recovery timeline
- Must have a "Traveler Action Checklist" section with numbered steps
- Reference: FlightAware, IATA, FAA, or US DOT where relevant`,

  hotel: `ARTICLE TYPE: HOTEL / ACCOMMODATION NEWS
- Lead with property name, brand, location city, and what changed/opened/upgraded
- Include: what's new → rooms & amenities → pricing & packages → booking details → local attractions
- Must have a "What Guests Get" section with bullet list of inclusions
- Reference: official hotel website, Booking.com, Expedia where relevant`,

  cruise: `ARTICLE TYPE: CRUISE / MARITIME NEWS
- Lead with ship name, cruise line, departure port, and itinerary summary
- Include: itinerary highlights → ship features → pricing → embarkation guide → booking window
- Must have a "Cruise Itinerary at a Glance" data table with ports and dates
- Reference: cruise line official site, Cruise Critic where relevant`,

  visa: `ARTICLE TYPE: VISA / TRAVEL REGULATIONS NEWS
- Lead with affected nationalities, visa type, duration, conditions
- Include: who qualifies → requirements → fees & processing time → common mistakes → official links
- Must have "Who Qualifies?" and "How to Apply" sections
- Reference: official government portal, IATA Travel Centre where relevant`,

  rail: `ARTICLE TYPE: RAIL / TRANSPORT NEWS
- Lead with route, operator, key stations, journey time, and what changed
- Include: service changes → ticket types & pricing → booking guide → onboard experience
- Must have a "How to Book the Best Fare" section
- Reference: rail operator official site where relevant`,

  destination: `ARTICLE TYPE: DESTINATION / TOURISM NEWS
- Lead with what is new at the destination: opening, policy, event, or tourist surge
- Include: what's happening → why visit now → best time to go → how to get there → practical tips
- Must have "Best Time to Visit" and "How to Get There" sections
- Reference: official tourism board, TripAdvisor, Lonely Planet where relevant`,

  general: `ARTICLE TYPE: GENERAL TRAVEL NEWS
- Lead with the core news angle and direct traveler impact
- Cover the 5 Ws fully before adding context or analysis
- Must include a data table and a "What This Means for Travelers" section`,
}

// ─── CATEGORY NAME MAP ──────────────────────────────────────────────────────
const CATEGORY_NAME_MAP = {
  'airline-news': 'Airline News',
  'hotel-news': 'Hotel News',
  'cruise-news': 'Cruise News',
  'travel-news': 'Travel News',
  'tourism-news': 'Tourism News',
  'destination-news': 'Destination News',
  'railway-news': 'Railway News',
  'travel-alerts': 'Travel Alerts',
  'travel-deals': 'Travel Deals',
  'travel-trends': 'Travel Trends',
  'technology-news': 'Technology News',
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4 ROTATING SEO PROMPTS — Optimized for Google Discover / Google News / Bing News
// One is chosen at random per article to give content variation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildPrompt_GoogleDiscover(title, body, category, type, kw, guidance, iso, year, monthName) {
  const systemPrompt = `You are a senior travel journalist writing for kordinate.world — optimized for Google Discover.

YOUR GOAL: Write ENGAGING, MARKDOWN-formatted article for Discover feeds.

${guidance}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON (no markdown fences). Structure:
{
  "title": "Curiosity headline, 55-68 chars. Primary keyword first 4 words.",
  "excerpt": "2-3 sentences, 145-160 chars. What happened, who's affected, why NOW in ${year}.",
  "content": "Full MARKDOWN article (see structure below)",
  "categoryName": "${CATEGORY_NAME_MAP[category] || 'Travel News'}",
  "author": "${randomAuthor()}",
  "readTime": "X min read",
  "tags": ["${kw.primary}", "travel ${year}", "${kw.secondary[0]}", "${kw.secondary[1]}", "${kw.secondary[2]}"]
}

━━━ MARKDOWN CONTENT STRUCTURE ━━━
(Return as string inside "content" field - NO HTML tags, use proper markdown)

> **Opening hook** — 2-3 sentences. Bold the key entity. Create curiosity. WHO + WHAT + WHY NOW.

## What Happened: Context & Timeline

Paragraph 1: Core news with specific facts (names, numbers, dates, locations).
Paragraph 2: Background or impact.
Paragraph 3: Key details with citations.

## Key Facts & Data

| Metric | Value | Context |
|--------|-------|---------|
| Fact 1 | Number | Details |
| Fact 2 | Number | Details |
| Fact 3 | Number | Details |
| Fact 4 | Number | Details |
| Fact 5 | Number | Details |

## What This Means for Travelers

- **Actionable tip 1:** Specific advice with details
- **Actionable tip 2:** Concrete steps to take NOW
- **Actionable tip 3:** Workaround or alternative
- **Actionable tip 4:** Timing or deadline info
- **Actionable tip 5:** Money-saving opportunity

## Industry Context & Analysis

2-3 paragraphs diving deeper. Use data, comparisons, trend language.

## Frequently Asked Questions

**[Question 1 with "${kw.primary}" in natural way?]**
Direct 50-60 word answer starting with the subject. Include number or date.

**[Question 2 — practical traveler question about next steps?]**
Standalone answer with specific steps or values.

**[Question 3 — comparison or "is it worth" question?]**
Data-backed answer with benchmarks or alternatives.

## Related Resources

- [Latest ${CATEGORY_NAME_MAP[category]} updates for ${year}](/${type}-${year})
- [${monthName} ${year} ${CATEGORY_NAME_MAP[category]} guide](/${type}-guide-${monthName.toLowerCase()})
- [More ${CATEGORY_NAME_MAP[category]} news](/category/${category})

---

**Disclaimer:** Information based on reporting as of ${iso}. Details subject to change. Verify current policies with relevant airlines or authorities before booking.

━━━ MARKDOWN RULES ━━━
✅ Use ## for H2 headers (NOT ### or #)
✅ Use \`backticks\` for inline code/prices/codes (e.g., \`LAX\`, \`$299\`)
✅ Use **bold** for emphasis, NOT <strong>
✅ Use * for bullet lists, NOT <ul><li>
✅ Use | tables |, NOT <table> tags
✅ Use [link text](url) format for links
✅ Use > for blockquotes
✅ Use --- for horizontal dividers (section breaks)
❌ NO HTML tags anywhere (<p>, <div>, <span>, etc.)
❌ NO backticks around entire sentences
❌ NO inline HTML styling`

  const userMessage = `Rewrite for Google Discover as MARKDOWN (not HTML):

Title: ${title}
Published: ${iso}
Category: ${category}
Type: ${type}
Keyword: ${kw.primary}

Source:
${body.slice(0, 5000)}`

  return { systemPrompt, userMessage }
}

function buildPrompt_GoogleNews(title, body, category, type, kw, guidance, iso, year, monthName) {
  const systemPrompt = `You are a breaking news travel journalist for kordinate.world — a publication indexed in Google News and Bing News.

YOUR GOAL: Write a FAST-BREAKING NEWS article in MARKDOWN format optimized for Google News indexing.

${guidance}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. Structure:
{
  "title": "Breaking news headline, 55-68 chars. Lead with entity name. Include action verb.",
  "excerpt": "Inverted pyramid summary, 145-160 chars. WHO did WHAT, WHERE, WHEN, WHY.",
  "content": "Full MARKDOWN article (see structure below)",
  "categoryName": "${CATEGORY_NAME_MAP[category] || 'Travel News'}",
  "author": "${randomAuthor()}",
  "readTime": "X min read",
  "tags": ["${kw.primary}", "breaking news ${year}", "${kw.secondary[0]}", "${kw.secondary[1]}", "${kw.secondary[2]}"]
}

━━━ MARKDOWN ARTICLE STRUCTURE ━━━

> **${iso.split('T')[0]}** — [BREAKING LEDE — 2-3 sentences. WHO + WHAT + WHEN + WHERE. Bold the primary entity. Active voice.]

## Key Developments

- **Development 1:** [Specific fact with number/date]
- **Development 2:** [Specific fact with impact]
- **Development 3:** [Specific fact with timeline]
- **Development 4:** [Additional detail]
- **Development 5:** [Related action or response]

## Full Coverage: What We Know

First paragraph: Core breaking news with specifics (names, numbers, locations, dates).

Second paragraph: Background and context that led to this news.

Third paragraph: Official statements or immediate responses.

Fourth paragraph: Impact on the travel industry or key stakeholders.

Fifth paragraph: Timeline or next steps.

## By the Numbers

| Metric | Value | Context |
|--------|-------|---------|
| [Key stat 1] | [Number] | [Significance] |
| [Key stat 2] | [Number] | [Impact] |
| [Key stat 3] | [Number] | [Timeline] |
| [Key stat 4] | [Number] | [Industry impact] |
| [Key stat 5] | [Number] | [Market context] |
| [Key stat 6] | [Number] | [Comparison] |

## Timeline of Events

- **[Date/Time]:** [Initial announcement or trigger]
- **[Date/Time]:** [Key development]
- **[Date/Time]:** [Official response]
- **[Date/Time]:** [Next planned action]

## Traveler Impact: What You Need to Know

1-2 paragraphs with concrete impact on bookings, routes, prices, or schedules. Include specific actions travelers should take NOW.

## Industry Response

2 paragraphs on competitor reactions, regulatory implications, or industry-wide shifts resulting from this news.

## FAQ

**What exactly happened and when?**
[Direct answer with specific date and details]

**How does this affect my existing bookings?**
[Concrete guidance based on the news]

**What should I do about upcoming travel?**
[Specific steps or resources]

---

**Published:** ${iso.split('T')[0]}
**Category:** ${CATEGORY_NAME_MAP[category] || 'Travel News'}

━━━ MARKDOWN RULES ━━━
✅ Use ## for H2 headers only
✅ Use **bold** for emphasis
✅ Use | tables | for data
✅ Use - for lists
✅ Use > for blockquote (opening with date)
✅ Use \`code\` for amounts, codes, specific terms
❌ NO HTML tags anywhere
❌ NO <p>, <div>, <table>, <strong>, <h2>, etc.`

  const userMessage = `Rewrite as a Google News breaking story in MARKDOWN:

Title: ${title}
Published: ${iso}
Category: ${category}
Type: ${type}
Keyword: ${kw.primary}

Source:
${body.slice(0, 5000)}`

  return { systemPrompt, userMessage }
}

function buildPrompt_BingNewsDataDriven(title, body, category, type, kw, guidance, iso, year, monthName) {
  const systemPrompt = `You are a data-driven travel analyst and journalist for kordinate.world — indexed on Bing News and news aggregators.

YOUR GOAL: Write a DATA-RICH, MARKDOWN-formatted article optimized for Bing News and knowledge panels.

${guidance}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. Structure:
{
  "title": "Data-forward headline, 55-68 chars. Include a number or statistic.",
  "excerpt": "Fact-dense summary, 145-160 chars. Lead with key number/stat. Include entity + ${year}.",
  "content": "Full MARKDOWN article (see structure below)",
  "categoryName": "${CATEGORY_NAME_MAP[category] || 'Travel News'}",
  "author": "${randomAuthor()}",
  "readTime": "X min read",
  "tags": ["${kw.primary}", "${kw.secondary[0]}", "travel ${year}", "${kw.secondary[1]}", "${kw.secondary[2]}"]
}

━━━ MARKDOWN ARTICLE STRUCTURE ━━━

> **Data-led opening** — Start with KEY NUMBER or STATISTIC. Bold the entity. 2-3 sentences with hard facts.

## Comprehensive Data Breakdown

| Parameter | Current Value | Previous/Comparison | Change |
|-----------|----------------|-------------------|--------|
| [Data 1] | [Number] | [Baseline] | [+/- X%] |
| [Data 2] | [Number] | [Baseline] | [+/- X%] |
| [Data 3] | [Number] | [Baseline] | [+/- X%] |
| [Data 4] | [Number] | [Baseline] | [+/- X%] |
| [Data 5] | [Number] | [Baseline] | [+/- X%] |
| [Data 6] | [Number] | [Baseline] | [+/- X%] |
| [Data 7] | [Number] | [Baseline] | [+/- X%] |
| [Data 8] | [Number] | [Baseline] | [+/- X%] |

## Detailed Analysis

Paragraph 1 (with 2+ specific numbers, entity names, dates): Deep factual analysis.

Paragraph 2 (with comparison data): Industry benchmark comparison.

Paragraph 3 (with trend or percentages): Market trend and historical context.

Paragraph 4 (with forecasts or projections): Future implications.

Paragraph 5 (with specific examples): Real-world examples from the data.

## Key Facts at a Glance

- **[Fact 1]:** [Specific number with context]
- **[Fact 2]:** [Comparison or trend data]
- **[Fact 3]:** [Geographic or market scope]
- **[Fact 4]:** [Financial or pricing data]
- **[Fact 5]:** [Timeline or date-specific info]
- **[Fact 6]:** [Passenger/traveler impact numbers]

## Market Context & Competitive Landscape

3 paragraphs comparing to competitors, industry averages, or market trends. Use specific brand names and numbers throughout.

## Practical Takeaways for Travelers

| Action | Details | When |
|--------|---------|------|
| [Step 1] | [Specific guidance] | [Deadline/timing] |
| [Step 2] | [Specific guidance] | [Deadline/timing] |
| [Step 3] | [Specific guidance] | [Deadline/timing] |
| [Step 4] | [Specific guidance] | [Deadline/timing] |
| [Step 5] | [Specific guidance] | [Deadline/timing] |

## FAQs

**[Search-query formatted question about ${kw.primary}?]**
[50-70 word answer with specific data]

**[Practical traveler question?]**
[Actionable answer with numbers and dates]

**[Comparison or analysis question?]**
[Data-backed answer with benchmarks]

---

**Published:** ${iso.split('T')[0]}
**Data as of:** ${iso}

━━━ MARKDOWN RULES ━━━
✅ Use ## for H2 headers
✅ Use **bold** for emphasis
✅ Use | tables | with + entries each
✅ Use - for lists
✅ Use \`code\` for codes/entities
✅ Use > for opening blockquote
❌ NO HTML tags anywhere`

  const userMessage = `Rewrite as data-rich analysis in MARKDOWN:

Title: ${title}
Published: ${iso}
Category: ${category}
Type: ${type}
Keyword: ${kw.primary}

Source:
${body.slice(0, 5000)}`

  return { systemPrompt, userMessage }
}

function buildPrompt_DiscoverStorytelling(title, body, category, type, kw, guidance, iso, year, monthName) {
  const systemPrompt = `You are a compelling travel storyteller and journalist for kordinate.world — optimized for Google Discover.

YOUR GOAL: Write an EMOTIONALLY ENGAGING, MARKDOWN-formatted narrative article.

${guidance}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. Structure:
{
  "title": "Story-driven headline, 55-68 chars. Evoke emotion or surprise.",
  "excerpt": "Curiosity-gap excerpt, 145-160 chars. Tease without revealing the answer.",
  "content": "Full MARKDOWN article (see structure below)",
  "categoryName": "${CATEGORY_NAME_MAP[category] || 'Travel News'}",
  "author": "${randomAuthor()}",
  "readTime": "X min read",
  "tags": ["${kw.primary}", "travel stories ${year}", "${kw.secondary[0]}", "${kw.secondary[1]}", "${kw.secondary[2]}"]
}

━━━ MARKDOWN ARTICLE STRUCTURE ━━━

> **[NARRATIVE HOOK]** — Start with vivid scene or surprising fact. Pull reader into the story. Bold the key entity. Create curiosity.

## The Story Behind the Headlines

Paragraph 1: Narrative opening with storytelling — scene-setting, emotions, specific details.

Paragraph 2: Cause-and-effect explanation with hard facts woven in naturally.

Paragraph 3: Character or stakeholder perspective with human interest.

Paragraph 4: Deeper context showing WHY this matters to travelers.

## What Makes This Different

2-3 paragraphs of comparative analysis. Specific differentiators with data. How does this compete? What's unique?

## By the Numbers — Quick Facts

| What | Detail | Why It Matters |
|------|--------|----------------|
| [Fact 1] | [Detail] | [Human impact] |
| [Fact 2] | [Detail] | [Market context] |
| [Fact 3] | [Detail] | [Travel implication] |
| [Fact 4] | [Detail] | [Timeline/deadline] |
| [Fact 5] | [Detail] | [Financial impact] |
| [Fact 6] | [Detail] | [Broader trend] |
| [Fact 7] | [Detail] | [Comparative context] |
| [Fact 8] | [Detail] | [Forward-looking] |

## The Insider's Perspective

- **[Insider tip 1]:** [Specific, actionable advice]
- **[Insider tip 2]:** [Booking hack or timing strategy]
- **[Insider tip 3]:** [Money-saving or experience-enhancing tip]
- **[Insider tip 4]:** [Behind-the-scenes knowledge]
- **[Insider tip 5]:** [Location-specific practical advice]

## What Travelers Are Saying

2 paragraphs on traveler sentiment, booking trends, social media buzz, or reviews. Use specific data and platforms.

## Should You Book? The Bottom Line

2 paragraphs of opinionated but data-backed recommendation. Who should care, who shouldn't, and what to do NOW.

## Your Questions Answered

**[Conversational question about ${kw.primary}?]**
[Friendly, authoritative 40-60 word answer with insider knowledge]

**[Practical "should I..." or "is it worth..." question?]**
[Direct recommendation with reasoning and data]

---

**Published:** ${iso.split('T')[0]}
**Category:** ${CATEGORY_NAME_MAP[category] || 'Travel News'}

━━━ MARKDOWN RULES ━━━
✅ Use ## for H2 headers
✅ Use **bold** for emphasis
✅ Use | tables | for facts
✅ Use - for lists
✅ Use > for opening blockquote
✅ Use \`code\` for codes/amounts
✅ Narrative, conversational tone
❌ NO HTML tags anywhere`

  const userMessage = `Rewrite as engaging travel story in MARKDOWN:

Title: ${title}
Published: ${iso}
Category: ${category}
Type: ${type}
Keyword: ${kw.primary}

Source:
${body.slice(0, 5000)}`

  return { systemPrompt, userMessage }
}

// ─── Prompt Selection ───────────────────────────────────────────────────────
const PROMPT_BUILDERS = [
  { name: 'Google Discover (Engagement)', fn: buildPrompt_GoogleDiscover },
  { name: 'Google News (Breaking)', fn: buildPrompt_GoogleNews },
  { name: 'Bing News (Data-Driven)', fn: buildPrompt_BingNewsDataDriven },
  { name: 'Discover Storytelling (Narrative)', fn: buildPrompt_DiscoverStorytelling },
]

function buildDynamicPrompt(item, sourceCategory = 'travel-news') {
  const title = typeof item.title === 'object' ? stripHtml(item.title) : (item.title || 'Untitled')
  const body = stripHtml(item['content:encoded'] || item.description || '') ||
    'No body content available — rewrite based on the headline and tags only.'

  const rawCategories = item.category
    ? Array.isArray(item.category) ? item.category : [item.category]
    : []
  const tags = rawCategories
    .map(c => typeof c === 'object' ? (c.__cdata || c['#text'] || '') : String(c))
    .filter(Boolean).join(', ')

  const pubDate = item.pubDate || item['dc:date'] || new Date().toUTCString()
  const { year, month, iso } = getDateParts(pubDate)
  const monthName = new Date(pubDate).toLocaleString('en-US', { month: 'long' })
  const type = detectArticleType(title, tags)
  const kw = extractKeywords(title, tags)
  const guidance = TYPE_GUIDANCE[type] || TYPE_GUIDANCE.general

  // Random prompt selection
  const selected = PROMPT_BUILDERS[Math.floor(Math.random() * PROMPT_BUILDERS.length)]
  console.log(`   🎲 Prompt style: ${selected.name}`)

  return selected.fn(title, body, sourceCategory, type, kw, guidance, iso, year, monthName)
}

// ─── Robust Claude JSON Parser ───────────────────────────────────────────────
// Claude's "content" field contains long markdown with unescaped quotes/newlines
// which breaks JSON.parse(). We extract each field individually instead.
function parseClaudeJson(raw) {
  // 1. Strip markdown code fences
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // 2. Find the outer JSON object boundaries
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')
  text = text.slice(start, end + 1)

  // 3. Try standard JSON.parse first (works when Claude behaves)
  try {
    return JSON.parse(text)
  } catch (_) {
    // fall through to field-by-field extraction
  }

  // 4. Field-by-field extraction for resilience against unescaped content
  const extractString = (key) => {
    // Match: "key": "value" where value may span multiple lines
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`, 's')
    const m = text.match(re)
    if (!m) return ''
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  const extractArray = (key) => {
    const re = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*?)\\]`, 's')
    const m = text.match(re)
    if (!m) return []
    return m[1].match(/"((?:[^"\\]|\\.)*)"/g)?.map(s => s.slice(1, -1)) || []
  }

  // Extract the "content" field specially — it contains raw markdown with unescaped quotes
  // Strategy: find "content": " ... " by locating the key and scanning forward for the
  // closing quote that is followed by a top-level key like "categoryName", "author", etc.
  let content = ''
  const contentKeyIdx = text.indexOf('"content"')
  if (contentKeyIdx !== -1) {
    const colonIdx = text.indexOf(':', contentKeyIdx)
    const openQuote = text.indexOf('"', colonIdx + 1)
    if (openQuote !== -1) {
      // Find where content ends: look for ","categoryName" or ","author" pattern
      const nextFieldRe = /",\s*"(?:categoryName|author|readTime|tags)"/
      const nextFieldMatch = text.slice(openQuote + 1).search(nextFieldRe)
      if (nextFieldMatch !== -1) {
        content = text.slice(openQuote + 1, openQuote + 1 + nextFieldMatch)
          .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      } else {
        content = extractString('content')
      }
    }
  }

  const result = {
    title: extractString('title'),
    excerpt: extractString('excerpt'),
    content,
    categoryName: extractString('categoryName'),
    author: extractString('author'),
    readTime: extractString('readTime'),
    tags: extractArray('tags'),
  }

  if (!result.title) throw new Error('Could not extract required fields from Claude response')
  return result
}

// ─── Article Generation (Claude) ─────────────────────────────────────────────
async function generateArticle(item, claudeClient, category) {
  const { systemPrompt, userMessage } = buildDynamicPrompt(item, category)

  if (DRY_RUN) {
    const title = typeof item.title === 'object' ? stripHtml(item.title) : (item.title || 'Untitled')
    console.log(`   [DRY_RUN] Dynamic prompt built for: ${title.slice(0, 60)}`)
    return null
  }

  try {
    const message = await claudeClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const responseText = message.content[0]?.text || ''
    return parseClaudeJson(responseText)
  } catch (err) {
    console.error(`   ⚠️  Claude error: ${err.message}`)
    return null
  }
}

// ─── Image Generation + R2 Upload (gpt-image-1-mini → Cloudflare R2) ───────────
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'traveldailypost-images'
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://images.traveldailypost.com').replace(/\/$/, '')

async function generateCoverImage(title, excerpt, slug, category, year, month, openaiClient) {
  const r2Key = `articles/${category}/${year}/${month}/${slug}.jpg`
  const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`

  if (DRY_RUN) {
    console.log(`   [DRY_RUN] Would generate image for: ${title.slice(0, 50)}`)
    return publicUrl
  }

  const imagePrompt = `Professional editorial travel photograph for article: "${title.slice(0, 120)}". ${excerpt ? excerpt.slice(0, 150) : ''} Photorealistic, cinematic lighting, journalistic style, wide 16:9 composition, no text overlays, no watermarks, no logos.`

  try {
    console.log(`   🎨 Generating cover image with gpt-image-1-mini...`)
    const response = await openaiClient.images.generate({
      model: 'gpt-image-1-mini',
      prompt: imagePrompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
    })

    const b64 = response.data[0]?.b64_json
    if (!b64) throw new Error('gpt-image-1-mini returned no image data')

    // Resize to 1200×700 JPEG
    const pngBuffer = Buffer.from(b64, 'base64')
    const jpegBuffer = await sharp(pngBuffer)
      .resize(1200, 700, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toBuffer()

    // Upload to Cloudflare R2
    const r2 = createR2Client()
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: jpegBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }))

    console.log(`   🖼️  Uploaded (1200×700) → ${publicUrl}`)
    return publicUrl

  } catch (err) {
    console.error(`   ⚠️  Image generation/upload failed: ${err.message}. Using CDN placeholder URL.`)
    return publicUrl
  }
}

// ─── Save articles as Markdown files (Nomadlawyer style) ──────────────────────
function getNextArticleId() {
  let highestId = 0;
  const contentDir = path.join(ROOT, 'content', 'posts');
  
  if (!fs.existsSync(contentDir)) return 1;

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath);
      } else if (fullPath.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const idMatch = content.match(/^id:\s*(\d+)/m);
        if (idMatch) {
          const id = parseInt(idMatch[1], 10);
          if (id > highestId) highestId = id;
        }
      }
    }
  }
  
  scanDir(contentDir);
  return highestId + 1;
}

function updateNewsData(articles) {
  let currentId = getNextArticleId();
  
  for (const article of articles) {
    try {
      // Extract date from article slug/date
      const [, year, month] = article.date.match(/(\d{4})-(\d{2})/) || ['', '2026', '01']
      
      // Get category slug (e.g., 'airline-news', 'hotel-news')
      const categorySlug = article.category || 'travel-news'

      // Create directory structure: content/posts/category/YYYY/MM/
      const articleDir = path.join(ROOT, 'content', 'posts', categorySlug, year, month)
      fs.mkdirSync(articleDir, { recursive: true })

      // Create YAML frontmatter
      const frontmatter = `---
id: ${currentId++}
title: "${article.title.replace(/"/g, '\\"')}"
date: "${article.date}"
updatedDate: "${article.date}"
excerpt: "${article.excerpt.replace(/"/g, '\\"')}"
coverImage: "${article.image}"
coverImageAlt: "${article.categoryName} news article thumbnail"
coverImageCaption: "Image generated by AI"
tags: [${article.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]
slug: "${article.slug}"
category: "${article.category}"
categoryName: "${article.categoryName}"
author: "${article.author}"
readTime: "${article.readTime}"
featured: false
---\n\n`

      // Combine frontmatter with markdown content
      const fileContent = frontmatter + article.content

      // Write markdown file
      const filePath = path.join(articleDir, `${article.slug}.md`)
      fs.writeFileSync(filePath, fileContent, 'utf8')

      console.log(`   📄 Saved: content/posts/${categorySlug}/${year}/${month}/${article.slug}.md`)
    } catch (err) {
      console.error(`   ❌ Failed to save article: ${err.message}`)
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  let activeFeeds = FEED_CONFIG
  if (process.env.TARGET_CATEGORY) {
    activeFeeds = FEED_CONFIG.filter(f => f.category === process.env.TARGET_CATEGORY)
  }

  console.log(`\n🛫 Kordinate News RSS Poller — ${new Date().toISOString()}`)
  console.log(`   Feeds: ${activeFeeds.length}`)
  activeFeeds.forEach(f => console.log(`     - [${f.category}] ${f.url.slice(0, 60)}...`))
  console.log(`   Article AI: Claude Haiku 4.5 (4 rotating SEO prompts)`)
  console.log(`   Image AI:   gpt-image-1-mini`)
  console.log(`   Max articles per run: ${MAX_ARTICLES}${DRY_RUN ? '  [DRY RUN]' : ''}`)
  if (process.env.TARGET_CATEGORY) {
    console.log(`   🎯 Targeting single category: ${process.env.TARGET_CATEGORY}\n`)
  } else {
    console.log(`\n`)
  }

  const seen = loadSeenArticles()
  let allItems = []

  for (const { url, category } of activeFeeds) {
    try {
      const items = await fetchFeed(url)
      console.log(`📡 Fetched ${items.length} items from ${category}`)
      allItems.push(...items.map(item => ({ ...item, _sourceCategory: category })))
      
      // Sleep 2-4 seconds between requests to avoid 429 Too Many Requests / 403 Forbidden
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
    } catch (err) {
      console.error(`   ❌ Error fetching ${category}: ${err.message}`)
      await new Promise(r => setTimeout(r, 4000)) // longer sleep after error
    }
  }

  console.log(`\nTotal feed items: ${allItems.length}. Previously seen: ${seen.size}`)

  const todayItems = allItems.filter((item) => {
    const pubDate = item.pubDate || item['dc:date'] || ''
    if (!isPublishedToday(pubDate)) return false
    const rawGuid = item.guid?.__cdata || item.guid?.['#text'] || item.guid || item.link || item.title
    return !seen.has(String(rawGuid))
  })

  todayItems.sort((a, b) => {
    const da = new Date(a.pubDate || a['dc:date'] || 0)
    const db = new Date(b.pubDate || b['dc:date'] || 0)
    return db - da
  })

  const todayCount = allItems.filter(i => isPublishedToday(i.pubDate || i['dc:date'] || '')).length
  console.log(`📅 Published today: ${todayCount} article(s). New (unseen): ${todayItems.length}`)

  const newItems = []
  const categoryCounts = {}
  
  for (const item of todayItems) {
    const cat = item._sourceCategory || 'travel-news'
    if (!categoryCounts[cat]) categoryCounts[cat] = 0
    if (categoryCounts[cat] < MAX_ARTICLES) {
      newItems.push(item)
      categoryCounts[cat]++
    }
  }

  if (newItems.length === 0) {
    console.log('✅ No new articles to publish.')
    process.exit(0)
  }

  console.log(`\n🆕 Processing ${newItems.length} new article(s)...\n`)

  const claudeClient = DRY_RUN ? null : createClaudeClient()
  const openaiClient = DRY_RUN ? null : createOpenAIClient()
  const generatedArticles = []

  for (const item of newItems) {
    const title = typeof item.title === 'object' ? stripHtml(item.title) : (item.title || 'Untitled')
    const category = item._sourceCategory || 'travel-news'
    const rawGuid = item.guid?.__cdata || item.guid?.['#text'] || item.guid || item.link || item.title
    const guid = String(rawGuid)
    const type = detectArticleType(title, '')

    console.log(`📝 [${type.toUpperCase()}] [${category}] ${title.slice(0, 70)}`)

    try {
      const articleData = await generateArticle(item, claudeClient, category)

      if (DRY_RUN) {
        seen.add(guid)
        console.log('   [DRY_RUN] Would process article\n')
        continue
      }

      if (!articleData) {
        console.log('   ⚠️  Skipping article\n')
        continue
      }

      // Validate essential fields
      if (!articleData.content || articleData.content.length < 200) {
        console.log('   ⚠️  Content too short, skipping\n')
        continue
      }

      const { year, month, iso } = getDateParts(item.pubDate)
      const slug = toSlug(articleData.title) + '-' + iso

      const image = await generateCoverImage(title, articleData.excerpt, slug, category, year, month, openaiClient)

      const fullArticle = {
        id: slug,
        slug,
        title: articleData.title,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category,
        categoryName: articleData.categoryName || CATEGORY_NAME_MAP[category] || 'Travel News',
        image,
        author: articleData.author || randomAuthor(),
        date: iso,
        readTime: articleData.readTime || `${Math.ceil(articleData.content.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200)} min read`,
        featured: false,
        tags: articleData.tags || [category],
      }

      generatedArticles.push(fullArticle)
      seen.add(guid)
      console.log(`   ✅ Article generated (${articleData.content.length} chars)\n`)

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`)
    }
  }

  if (generatedArticles.length > 0 && !DRY_RUN) {
    updateNewsData(generatedArticles)
    saveSeenArticles(seen)
    console.log(`\n🎉 ${generatedArticles.length} article(s) published successfully!`)
  } else {
    console.log('\nℹ️  No articles were processed.')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
