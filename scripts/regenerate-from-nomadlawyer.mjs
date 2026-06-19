#!/usr/bin/env node
/**
 * regenerate-from-nomadlawyer.mjs
 *
 * This script:
 *   1. Scrapes recently generated articles from Nomadlawyer's content/posts directory.
 *   2. Reuses the exact same coverImage, coverImageAlt, and coverImageCaption to avoid Together AI costs.
 *   3. Calls Claude to rewrite the article body specifically for traveldailypost.com (preventing search duplicate content penalty).
 *   4. Automatically maps categories to traveldailypost valid slugs.
 *   5. Injects Related Travel Guide links from traveldailypost's own slug pool.
 *   6. Synchronizes traveldailypost's seen-chrome-urls.json using scraped tab text matching.
 *
 * Usage:
 *   node scripts/regenerate-from-nomadlawyer.mjs
 *
 * Optional flags:
 *   --days=N         Check Nomadlawyer files modified or dated in the last N days (default: 2)
 *   --date=YYYY-MM-DD Filter by exact frontmatter date
 *   --limit=N        Process at most N articles
 *   --force          Overwrites existing posts in traveldailypost if they have the same slug
 *   --dry-run        Lists posts that would be processed without calling Claude or writing files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ───────────────────────────────────────────────────────────────────
const NOMAD_DIR = process.env.NOMAD_DIR || '/Users/raushankumar/Working/Nomadlawyer';
const BASE_OUT_DIR = path.join(ROOT, 'content', 'posts');
const SEEN_FILE = path.join(__dirname, 'seen-chrome-urls.json');

const TODAY = new Date().toISOString().split('T')[0];
const YEAR = TODAY.slice(0, 4);
const MONTH = TODAY.slice(5, 7);

// Parse CLI flags
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

const limitArg = args.find(a => a.startsWith('--limit='));
const MAX_TABS = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const daysArg = args.find(a => a.startsWith('--days='));
const DAYS_LOOKBACK = daysArg ? parseInt(daysArg.split('=')[1], 10) : 2;

const dateArg = args.find(a => a.startsWith('--date='));
const TARGET_DATE = dateArg ? dateArg.split('=')[1] : null;

const commitArg = args.find(a => a.startsWith('--commit='));
const TARGET_COMMIT = commitArg ? commitArg.split('=')[1] : null;

const gitLimitArg = args.find(a => a.startsWith('--git-limit='));
const GIT_LIMIT = gitLimitArg ? parseInt(gitLimitArg.split('=')[1], 10) : null;

// Valid categories for traveldailypost.com
const VALID_CATEGORIES = [
  'travel-news', 'tourism-news', 'airline-news', 'railway-news',
  'cruise-news', 'destination-news', 'hotel-news', 'travel-alerts',
  'travel-deals', 'travel-trends', 'technology-news'
];

// Mapping from Nomadlawyer categories to Travel Daily Post categories
const CATEGORY_MAP = {
  'airline-news': 'airline-news',
  'travel-news': 'travel-news',
  'tourism-news': 'tourism-news',
  'hotel-news': 'hotel-news',
  'cruise-news': 'cruise-news',
  'railway-news': 'railway-news',
  'destination-news': 'destination-news',
  'travel-alert': 'travel-alerts',
  'travel-alerts': 'travel-alerts',
  'travel-deals': 'travel-deals',
  'travel-trends': 'travel-trends',
  'travel-technology-news': 'technology-news',
  'technology-news': 'technology-news',
  'travel-tips': 'travel-news',
  'law-facts': 'travel-news' // Default fallback
};

// ── Load env ─────────────────────────────────────────────────────────────────
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(ROOT, envFile);
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      const commentIdx = trimmed.indexOf('#');
      const cleanLine = commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed;

      if (cleanLine) {
        const eq = cleanLine.indexOf('=');
        if (eq > 0) {
          const k = cleanLine.slice(0, eq).trim();
          const v = cleanLine.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
          process.env[k] = process.env[k] || v;
        }
      }
    });
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is not set in traveldailypost env files.');
  process.exit(1);
}

// ── Seen URLs helper ─────────────────────────────────────────────────────────
function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2) + '\n');
}

// ── Helper: check if file exists in traveldailypost by slug ──────────────────
function findPostBySlug(slug) {
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name === `${slug}.md`) {
        return full;
      }
    }
    return null;
  };
  return walk(BASE_OUT_DIR);
}

// ── Helper: parse Nomadlawyer frontmatter & body ─────────────────────────────
function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return null;

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length).trim();

  const getField = (fieldName) => {
    const regex = new RegExp(`^${fieldName}:\\s*(["']?)(.*?)\\1\\s*$`, 'm');
    const m = frontmatterStr.match(regex);
    return m ? m[2].trim() : null;
  };

  const getTags = () => {
    const m = frontmatterStr.match(/^tags:\s*\[([\s\S]*?)\]/m);
    if (m) {
      return m[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    return [];
  };

  return {
    filePath,
    id: getField('id'),
    title: getField('title'),
    date: getField('date'),
    excerpt: getField('excerpt'),
    coverImage: getField('coverImage'),
    coverImageAlt: getField('coverImageAlt'),
    coverImageCaption: getField('coverImageCaption') || 'Image generated by AI',
    tags: getTags(),
    slug: getField('slug'),
    category: getField('category'),
    readTime: getField('readTime') || '5 min read',
    keywords: getField('keywords'),
    body: body
  };
}

// ── Helper: Find matching original URL from scraped tabs ────────────────────
function findOriginalUrl(title, body, scrapedTabs) {
  if (!scrapedTabs || scrapedTabs.length === 0) return null;

  // Extract keywords from title
  const titleWords = title.toLowerCase().split(/[^a-z0-9]+/);
  let bestTab = null;
  let bestScore = 0;

  for (const tab of scrapedTabs) {
    let score = 0;
    const tabTextLower = tab.text.toLowerCase();

    for (const word of titleWords) {
      if (word.length > 3 && tabTextLower.includes(word)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTab = tab;
    }
  }

  // Require a decent keyword match score
  if (bestScore >= 3) {
    return bestTab.url;
  }
  return null;
}

// ── Step 1: Scan Nomadlawyer Posts ───────────────────────────────────────────
function scanNomadLawyerPosts() {
  const nomadPostsDir = path.join(NOMAD_DIR, 'content', 'posts');
  if (!fs.existsSync(nomadPostsDir)) {
    console.error(`❌ Nomadlawyer posts directory not found: ${nomadPostsDir}`);
    process.exit(1);
  }

  const posts = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const parsed = parseMarkdownFile(full);
          if (parsed) {
            posts.push(parsed);
          }
        } catch (e) {
          // skip malformed
        }
      }
    }
  };
  walk(nomadPostsDir);
  return posts;
}

// ── Step 2: Related Guides link helpers ──────────────────────────────────────
function collectSlugs(limit = 60, targetCategory = null) {
  const filePaths = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        filePaths.push(fullPath);
      }
    }
  };
  walk(BASE_OUT_DIR);

  if (filePaths.length === 0) return [];

  const shuffled = filePaths.sort(() => Math.random() - 0.5);
  const selected = [];

  for (const fp of shuffled) {
    try {
      const raw = fs.readFileSync(fp, 'utf8');
      const sm = raw.match(/slug:\s*"([^"]+)"/);
      const tm = raw.match(/title:\s*"([^"]+)"/);
      const cm = raw.match(/category:\s*"([^"]+)"/);
      if (sm && tm && cm) {
        const postCategory = cm[1];
        if (targetCategory && postCategory !== targetCategory) {
          continue;
        }
        selected.push({ slug: sm[1], title: tm[1], category: postCategory });
        if (selected.length >= limit) break;
      }
    } catch { /* skip */ }
  }

  // Fallback if category-specific is sparse
  if (selected.length < limit && targetCategory) {
    for (const fp of shuffled) {
      try {
        const raw = fs.readFileSync(fp, 'utf8');
        const sm = raw.match(/slug:\s*"([^"]+)"/);
        const tm = raw.match(/title:\s*"([^"]+)"/);
        const cm = raw.match(/category:\s*"([^"]+)"/);
        if (sm && tm && cm) {
          if (selected.some(s => s.slug === sm[1])) continue;
          selected.push({ slug: sm[1], title: tm[1], category: cm[1] });
          if (selected.length >= limit) break;
        }
      } catch { /* skip */ }
    }
  }

  return selected;
}

function pickRelatedLinks(pool, count = 3) {
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(p => `[${p.title}](/${p.slug})`)
    .join('\n\n');
}

// ── Step 3: Get Next Post ID in traveldailypost ──────────────────────────────
function getNextPostId() {
  let maxId = 8000;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf8');
        const m = content.match(/^id:\s*(\d+)/m);
        if (m) {
          const id = parseInt(m[1], 10);
          if (id > maxId) maxId = id;
        }
      }
    }
  };
  walk(BASE_OUT_DIR);
  return maxId + 1;
}

// ── Step 4: Call Claude to Rewrite Content ───────────────────────────────────
async function rewriteArticle(nomadPost, articleId, relatedLinks, targetCategory, author) {
  const systemPrompt = `You are a senior travel journalist writing for traveldailypost.com — a blog covering travel news, airline updates, destination guides, hotel reviews, and cruise news.
- You MUST set the category in the frontmatter to EXACTLY "${targetCategory}".

Your task: Rewrite the provided article from nomadlawyer.org into a 100% original, highly engaging, and viral SEO-optimized blog post for traveldailypost.com. Focus on strong narrative hooks, dramatic journalistic formatting, and a compelling temperament that encourages shares and reader retention.

CRITICAL: Avoid duplicate phrasing, sentences, or paragraphs from the source article to prevent search engine duplicate content penalties. Re-phrase, re-structure, and rewrite the content completely, but preserve all factual data, statistics, names, dates, and figures exactly as they are in the source.

BLOG TONE & STYLE RULES:
- Write in first-person observer tone where appropriate ("I visited", "what I found")
- For news articles: confident, factual, journalistic, no fluff
- Short, punchy paragraphs (2-4 sentences max)
- Bold important entities, statistics, proper nouns on first mention
- Use ## headings for each major section (no H1 in body)
- Add Reddit-style quotes where appropriate: Reddit: *"Quote here."* — r/travel
- Preserve ALL factual data, statistics, names, dates, and figures exactly
- Embed 2-3 outbound links to authoritative sources naturally in the body
- End with a short punchy italic sign-off line
- **Data Tables & Key Facts**: If the source article contains structured data, statistics, flight/rail schedules, routes, cancellations, speed, capacity, or key numbers, you MUST organize and present these key facts in a clear, clean Markdown table under an appropriate ## subheading (e.g. "## Key Figures and Route Data" or "## Service Disruption At a Glance") to make the data easily digestible for the reader.

OUTPUT FORMAT — output ONLY valid markdown with YAML frontmatter. Start directly with ---

---
id: ${articleId}
title: "Compelling SEO title (60 chars max, primary keyword in first 5 words)"
date: "${nomadPost.date}"
updatedDate: "${nomadPost.date}"
excerpt: "One clear summary sentence (40-50 words) with primary keyword."
coverImage: "${nomadPost.coverImage}"
coverImageAlt: "${nomadPost.coverImageAlt}"
coverImageCaption: "${nomadPost.coverImageCaption}"
tags: ${JSON.stringify(nomadPost.tags)}
slug: "${nomadPost.slug}"
category: "${targetCategory}"
author: "${author}"
readTime: "${nomadPost.readTime}"
featured: false
metaTitle: "Full SEO meta title"
metaDescription: "150-160 char meta description with primary keyword"
keywords: "${nomadPost.keywords || nomadPost.tags.join(', ')}"
---

[Article body here — 900-1200 words]

*[Punchy italic closing line]*

## Related Travel Guides

${relatedLinks}

**Disclaimer:** [Topic-appropriate disclaimer]

PROHIBITIONS:
- No H1 heading in body
- No emojis
- No invented facts or statistics
- No "delve into", "in conclusion", "all in all"
- No code blocks or triple backticks
- Do NOT link back to the source URL.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Here is the source post from nomadlawyer.org to rewrite for traveldailypost.com:\n\nTitle: ${nomadPost.title}\nExcerpt: ${nomadPost.excerpt}\n\nBody:\n${nomadPost.body}`,
    }],
  });

  let md = message.content[0].text.trim();
  if (md.startsWith('```')) md = md.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  return md;
}

// ── Step 5: Save Markdown and Post-Process Related Guides ───────────────────
function saveArticle(md, articleId, category, slug, slugPool) {
  // Post-process to inject valid related travel guide links from traveldailypost pool
  const relatedMatch = md.match(/(##\s+Related\s+Travel\s+Guides|##\s+Related\s+Guides)([\s\S]*?)(##\s+Disclaimer|Disclaimer:|\*\*Disclaimer:\*\*|$)/i);
  if (relatedMatch) {
    const header = relatedMatch[1];
    const disclaimer = relatedMatch[3];
    const realGuides = slugPool.filter(s => s.slug !== slug).sort(() => Math.random() - 0.5).slice(0, 3);
    if (realGuides.length > 0) {
      const guideLinks = realGuides.map(g => `* [${g.title}](/${g.slug})`).join('\n\n');
      const oldSection = relatedMatch[0];
      const newSection = `${header}\n\n${guideLinks}\n\n${disclaimer}`;
      md = md.replace(oldSection, newSection);
    }
  }

  // Ensure ID is correct
  md = md.replace(/id:\s*\d+/, `id: ${articleId}`);

  const outDir = path.join(BASE_OUT_DIR, category, YEAR, MONTH);
  fs.mkdirSync(outDir, { recursive: true });

  const filePath = path.join(outDir, `${slug}.md`);
  fs.writeFileSync(filePath, md, 'utf8');

  return filePath;
}

// ── Main Execution ───────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔄 Nomadlawyer → Travel Daily Post Re-generator\n' + '─'.repeat(55));

  if (DRY_RUN) console.log('⚠  DRY RUN MODE — no files will be written\n');

  // Load scraped tabs cache from Nomadlawyer for URL matching
  const scrapedTabsPath = path.join(NOMAD_DIR, 'scratch', 'scraped_tabs.json');
  let scrapedTabs = [];
  if (fs.existsSync(scrapedTabsPath)) {
    try {
      scrapedTabs = JSON.parse(fs.readFileSync(scrapedTabsPath, 'utf8'));
      console.log(`ℹ Loaded ${scrapedTabs.length} scraped tabs cache from Nomadlawyer for source URL recovery.`);
    } catch (e) {
      console.warn('⚠ Could not load Nomadlawyer scraped_tabs.json:', e.message);
    }
  }

  // Retrieve commit files if filtering by commit
  let commitFiles = null;
  if (TARGET_COMMIT) {
    try {
      const output = execSync(`git show --name-only --pretty="" ${TARGET_COMMIT}`, { cwd: NOMAD_DIR, encoding: 'utf8' });
      commitFiles = new Set(
        output.split('\n')
          .map(f => f.trim())
          .filter(Boolean)
          .map(f => path.resolve(NOMAD_DIR, f))
      );
      console.log(`ℹ Filtering by git commit ${TARGET_COMMIT} (${commitFiles.size} files in commit).`);
    } catch (e) {
      console.error(`❌ Failed to get files for commit ${TARGET_COMMIT}:`, e.message);
      process.exit(1);
    }
  }

  // Retrieve last N git-added files if filtering by git-limit
  let gitLimitFiles = null;
  if (GIT_LIMIT) {
    try {
      const output = execSync(`git log --name-only --diff-filter=A --pretty="" content/posts | head -n ${GIT_LIMIT}`, { cwd: NOMAD_DIR, encoding: 'utf8' });
      gitLimitFiles = new Set(
        output.split('\n')
          .map(f => f.trim())
          .filter(Boolean)
          .map(f => path.resolve(NOMAD_DIR, f))
      );
      console.log(`ℹ Filtering by last ${GIT_LIMIT} git-added files (${gitLimitFiles.size} files found).`);
    } catch (e) {
      console.error(`❌ Failed to get last git-added files:`, e.message);
      process.exit(1);
    }
  }

  // Scan Nomadlawyer
  console.log('🔍 Scanning Nomadlawyer content for recent articles...');
  const nomadPosts = scanNomadLawyerPosts();
  console.log(`   Found ${nomadPosts.length} total posts in Nomadlawyer.`);

  // Filter matching posts by commit, git limit, date, or lookback window
  const cutOffTime = Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000;
  const filtered = nomadPosts.filter(p => {
    if (TARGET_COMMIT) {
      return commitFiles.has(path.resolve(p.filePath));
    }
    if (GIT_LIMIT) {
      return gitLimitFiles.has(path.resolve(p.filePath));
    }
    // If TARGET_DATE is specified, match exact date
    if (TARGET_DATE) {
      return p.date === TARGET_DATE;
    }
    // Otherwise filter by file stats mtime
    try {
      const stats = fs.statSync(p.filePath);
      return stats.mtimeMs >= cutOffTime;
    } catch {
      return false;
    }
  });

  console.log(`   Found ${filtered.length} posts matching filter criteria.`);

  // Check which ones are already processed or need processing
  const toProcess = [];
  for (const post of filtered) {
    const existingPath = findPostBySlug(post.slug);
    if (existingPath && !FORCE) {
      console.log(`⏭  Skip (already exists in traveldailypost): ${post.slug}`);
      continue;
    }
    toProcess.push(post);
  }

  console.log(`📋 Articles to process: ${toProcess.length}`);
  if (toProcess.length === 0) {
    console.log('✅ All recent posts already exist. Nothing to do.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nPosts that would be regenerated:');
    toProcess.forEach((p, idx) => {
      console.log(`  ${idx + 1}. [Nomadlawyer Path: ${p.filePath}]`);
      console.log(`     Title: ${p.title}`);
      console.log(`     Image: ${p.coverImage}`);
    });
    return;
  }

  // Load traveldailypost state
  const seenUrls = loadSeen();
  const slugPool = collectSlugs(60);
  let nextId = getNextPostId();

  console.log(`📦 Next Travel Daily Post ID: ${nextId}`);
  console.log(`🗂  Slug pool: ${slugPool.length} articles loaded for footer links\n`);

  let processed = 0;
  let errors = 0;

  for (const post of toProcess) {
    if (processed >= MAX_TABS) {
      console.log(`\n⚡ Reached limit of ${MAX_TABS}. Stopping.`);
      break;
    }

    const targetCategory = CATEGORY_MAP[post.category] || 'travel-news';
    const authors = ['Preeti Gunjan', 'Kunal K Choudhary', 'Raushan Kumar'];
    const author = authors[nextId % authors.length];

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📰 Processing [ID: ${nextId}] | Slug: ${post.slug}`);
    console.log(`   Category: ${post.category} ➔ ${targetCategory}`);
    console.log(`   Image (Reused): ${post.coverImage}`);

    try {
      // Pick related links
      const relatedLinks = pickRelatedLinks(slugPool);

      // Rewrite with Claude
      console.log('   ↳ Rewriting body with Claude...');
      const md = await rewriteArticle(post, nextId, relatedLinks, targetCategory, author);

      // Save
      console.log('   ↳ Saving markdown...');
      const filePath = saveArticle(md, nextId, targetCategory, post.slug, slugPool);
      console.log(`   ✅ Saved: content/posts/${targetCategory}/${YEAR}/${MONTH}/${post.slug}.md`);

      // Add to slug pool
      slugPool.push({ slug: post.slug, title: post.title, category: targetCategory });

      // Synchronize seen-chrome-urls.json using matching scraped tab url
      const originalUrl = findOriginalUrl(post.title, post.body, scrapedTabs);
      if (originalUrl) {
        console.log(`   🔗 Added to seen list: ${originalUrl}`);
        seenUrls.add(originalUrl);
        saveSeen(seenUrls);
      }

      nextId++;
      processed++;

      // Pause to avoid Claude rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`   ❌ Failed to process ${post.slug}: ${e.message}`);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Regeneration complete.`);
  console.log(`   Processed : ${processed}`);
  console.log(`   Errors    : ${errors}`);
  console.log(`   Next ID   : ${nextId}`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
