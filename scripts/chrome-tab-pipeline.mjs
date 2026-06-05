#!/usr/bin/env node
/**
 * chrome-tab-pipeline.mjs
 *
 * End-to-end automated pipeline:
 *   1. Reads ALL open tabs from Google Chrome (any window)
 *   2. Fetches article content via node-fetch (public URLs) or clipboard (private)
 *   3. Rewrites each article with Claude claude-haiku-4-5 in the established blog tone/layout
 *   4. Saves the markdown under content/posts/[category]/2026/MM/[slug].md
 *   5. Generates a cover image via gpt-image-1-mini and uploads to Cloudflare R2
 *   6. Skips already-seen URLs (persisted in scripts/seen-chrome-urls.json)
 *
 * Usage:
 *   node scripts/chrome-tab-pipeline.mjs
 *
 * Optional flags:
 *   --dry-run        List detected tabs without writing files
 *   --no-images      Skip image generation (faster for testing)
 *   --limit=N        Process at most N tabs this run
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ───────────────────────────────────────────────────────────────────
const SEEN_FILE    = path.join(__dirname, 'seen-chrome-urls.json');
const BASE_OUT_DIR = path.join(ROOT, 'content', 'posts');
const TODAY        = new Date().toISOString().split('T')[0];
const YEAR         = TODAY.slice(0, 4);
const MONTH        = TODAY.slice(5, 7);

// Parse CLI flags
const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const NO_IMAGES  = args.includes('--no-images');
const limitArg   = args.find(a => a.startsWith('--limit='));
const MAX_TABS   = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

// Pages to SKIP (not articles)
const SKIP_URL_PATTERNS = [
  'chrome://', 'about:', 'localhost', '127.0.0.1',
  'google.com', 'mail.google', 'drive.google',
  'docs.google', 'sheets.google', 'accounts.google',
  'youtube.com', 'github.com', 'npmjs.com',
  'nomadlawyer.org', 'hostinger.com', 'hpanel',
  'cloudflare', 'r2.cloudflarestorage', 'console.aws',
  'canva.com', 'claude.ai', 'claude.com', 'openai.com',
  'perplexity.ai', 'genspark.ai', 'chatgpt.com',
  'antigravity.google', 'teamviewer.com', 'hauspire.com', 'labs.google',
  'microsoft.com', 'linkpublishers.com', 'paypal.com', 'lmstudio.ai',
  'traveldailypost.com', 'together.ai', 'openart.ai'
];

// Valid blog categories
const VALID_CATEGORIES = [
  'travel-news', 'tourism-news', 'airline-news', 'railway-news',
  'cruise-news', 'destination-news', 'hotel-news', 'travel-alerts',
  'travel-deals', 'travel-trends', 'technology-news'
];

// ── Load env ─────────────────────────────────────────────────────────────────
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(ROOT, envFile);
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      // Remove inline comments
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Seen URL helpers ──────────────────────────────────────────────────────────
function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2) + '\n');
}

// ── Step 1: Get all Chrome tab URLs via AppleScript (Targeted Profile) ────────
function getChromeTabUrls() {
  const script = `
    set output to ""
    tell application "Google Chrome" to activate
    delay 0.5
    tell application "Google Chrome"
      set winCount to count of windows
    end tell
    
    repeat with i from 1 to winCount
      tell application "Google Chrome"
        set index of window i to 1
      end tell
      delay 0.5
      
      set isActiveProfile to false
      tell application "System Events"
        tell process "Google Chrome"
          repeat with m in menu items of menu 1 of menu bar item "Profiles" of menu bar 1
            try
              if value of attribute "AXMenuItemMarkChar" of m is not missing value then
                set profileName to name of m
                if profileName is "RAM EKWAL" or profileName is "Ram Ekwal" then
                  set isActiveProfile to true
                end if
                exit repeat
              end if
            end try
          end repeat
        end tell
      end tell
      
      if isActiveProfile then
        tell application "Google Chrome"
          repeat with t in tabs of window 1
            set output to output & URL of t & "\\n"
          end repeat
        end tell
      end if
    end repeat
    return output
  `;
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf8',
      timeout: 25000,
    });
    return result.trim().split('\n').filter(Boolean);
  } catch (e) {
    console.error('❌ AppleScript failed to list Chrome tabs for profile:', e.message);
    return [];
  }
}

// ── Step 2: Fetch article content via HTTP ────────────────────────────────────
async function fetchContent(url) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 20000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Strip HTML tags for a readable plain text version
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 12000);
}

// ── Step 3: Collect slug pool for Related Travel Guides footer ────────────────
function collectSlugs(limit = 60) {
  const slugs = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) {
        const raw = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        const sm = raw.match(/slug:\s*"([^"]+)"/);
        const tm = raw.match(/title:\s*"([^"]+)"/);
        const cm = raw.match(/category:\s*"([^"]+)"/);
        if (sm && tm && cm) slugs.push({ slug: sm[1], title: tm[1], category: cm[1] });
      }
    }
  };
  walk(BASE_OUT_DIR);
  return slugs.sort(() => Math.random() - 0.5).slice(0, limit);
}

function pickRelatedLinks(pool, count = 3) {
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(p => `[${p.title}](/${p.slug})`)
    .join('\n\n');
}

// ── Step 4: Get the next available post ID ────────────────────────────────────
function getNextPostId() {
  let maxId = 0;
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

function extractSourceCategory(rawText) {
  const match = rawText.match(/Home\s*(?:»|>>|&raquo;)\s*([^»>]+?)\s*(?:»|>>|&raquo;)/i);
  if (match) {
    const rawCat = match[1].trim();
    const slug = rawCat
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    if (slug === 'mice') return 'travel-news';
    if (slug === 'association-news') return 'travel-news';
    if (slug === 'event-news') return 'travel-news';
    if (slug === 'destinations') return 'destination-news';
    if (slug === 'technology-news') return 'technology-news';

    // Map regional and subcategories to the primary valid categories
    if (slug.includes('airline')) return 'airline-news';
    if (slug.includes('hotel')) return 'hotel-news';
    if (slug.includes('cruise')) return 'cruise-news';
    if (slug.includes('railway') || slug.includes('train')) return 'railway-news';
    if (slug.includes('tourism')) return 'tourism-news';
    if (slug.includes('travel-news')) return 'travel-news';
    if (slug.includes('travel-tips')) return 'travel-news';
    if (slug.includes('travel-deals')) return 'travel-deals';
    if (slug.includes('travel-trends')) return 'travel-trends';
    if (slug.includes('travel-alert')) return 'travel-alerts';
    if (slug.includes('destination')) return 'destination-news';

    return slug;
  }
  return null;
}

// ── Step 5: Rewrite article with Claude ──────────────────────────────────────
async function rewriteWithClaude(rawText, url, articleId, relatedLinks, suggestedCategory = null, suggestedAuthor = 'Preeti Gunjan') {
  const systemPrompt = `You are a senior travel journalist writing for traveldailypost.com — a blog covering travel news, airline updates, destination guides, hotel reviews, and cruise news.
${suggestedCategory ? `- You MUST set the category in the frontmatter to EXACTLY "${suggestedCategory}".` : ''}

Your task: Rewrite the provided article into a 100% original, highly engaging, and viral SEO-optimized blog post in the same TONE, STYLE, and LAYOUT as the blog. Focus on strong narrative hooks, dramatic journalistic formatting, and a compelling temperament that encourages shares and reader retention.

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

OUTPUT FORMAT — output ONLY valid markdown with YAML frontmatter. Start directly with ---

---
id: ${articleId}
title: "Compelling SEO title (60 chars max, primary keyword in first 5 words)"
date: "${TODAY}"
updatedDate: "${TODAY}"
excerpt: "One clear summary sentence (40-50 words) with primary keyword."
coverImage: ""
coverImageAlt: "Descriptive alt text for the cover image"
coverImageCaption: "Image generated by AI"
tags: ["primary keyword", "secondary keyword", "travel 2026", "category type"]
slug: "url-friendly-slug-here"
category: "EXACT_CATEGORY_SLUG"
author: "${suggestedAuthor}"
readTime: "5 min read"
featured: false
metaTitle: "Full SEO meta title"
metaDescription: "150-160 char meta description with primary keyword"
keywords: "comma separated keywords"
---

[Article body here — 900-1200 words]

*[Punchy italic closing line]*

## Related Travel Guides

${relatedLinks}

**Disclaimer:** [Topic-appropriate disclaimer]

CATEGORY MUST BE EXACTLY ONE OF:
travel-news | tourism-news | airline-news | railway-news | cruise-news | destination-news | hotel-news | travel-alerts | travel-deals | travel-trends | technology-news

PROHIBITIONS:
- No H1 heading in body
- No emojis
- No invented facts or statistics
- No "delve into", "in conclusion", "all in all"
- No code blocks or triple backticks
- Do NOT link back to the source URL: ${url}
- CRITICAL: Under "## Related Travel Guides", you MUST copy the EXACT markdown links provided above — do NOT invent, change, or add any links. Use them exactly as-is, word for word.`;

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Recreate Anthropic client instance to prevent connection reuse issues/hangs
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Rewrite this article for traveldailypost.com:\n\nSource URL: ${url}\n\nContent:\n${rawText.slice(0, 9000)}`,
        }],
      });

      let md = message.content[0].text.trim();
      // Strip accidental code fences
      if (md.startsWith('```')) md = md.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      return md;
    } catch (err) {
      lastError = err;
      console.warn(`   ⚠ Anthropic attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) {
        console.log(`   ↳ Retrying in 4 seconds...`);
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }
  throw lastError;
}

// ── Step 6: Normalize and save markdown ──────────────────────────────────────
function saveArticle(md, articleId, forcedCategory = null, forcedAuthor = null, slugPool = []) {
  // Extract fields
  const titleMatch    = md.match(/title:\s*"([^"]+)"/);
  const categoryMatch = md.match(/category:\s*"([^"]+)"/);
  const slugMatch     = md.match(/slug:\s*"([^"]+)"/);

  if (!titleMatch || !categoryMatch) {
    throw new Error('Missing title or category in generated markdown');
  }

  const title = titleMatch[1];

  // Normalize category
  let category = forcedCategory || categoryMatch[1].toLowerCase().trim();
  if (!VALID_CATEGORIES.includes(category)) {
    console.warn(`   ⚠ Unknown category "${category}" → defaulting to travel-news`);
    category = 'travel-news';
  }
  md = md.replace(/category:\s*"[^"]*"/, `category: "${category}"`);

  if (forcedAuthor) {
    md = md.replace(/^author:\s*"[^"]*"/m, `author: "${forcedAuthor}"`);
  }

  // Normalize slug from title if missing/placeholder
  const rawSlug = slugMatch ? slugMatch[1] : title;
  const slug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  md = md.replace(/slug:\s*"[^"]+"/, `slug: "${slug}"`);

  // Fix coverImage placeholder path
  md = md.replace(
    /coverImage:\s*""/,
    `coverImage: "https://images.traveldailypost.com/articles/${category}/${YEAR}/${MONTH}/${slug}.jpg"`
  );

  // Ensure ID is correct
  md = md.replace(/id:\s*\d+/, `id: ${articleId}`);

  // ── Post-processing: Fix any broken Related Travel Guide links ─────────────
  // Claude sometimes ignores the provided links and invents non-existent slugs.
  // We detect and replace them with real slugs from the pool before writing to disk.
  if (slugPool.length > 0) {
    const validSlugs = new Set(slugPool.map(p => p.slug));
    const sectionMatch = md.match(/(## Related Travel Guides\s*\n)([\s\S]*?)(\n\n\*\*Disclaimer|\n\*[^\n]|$)/);
    if (sectionMatch) {
      const sectionBody = sectionMatch[2];
      const links = [...sectionBody.matchAll(/\[([^\]]+)\]\((\/[^)]+)\)/g)];
      const hasBroken = links.some(m => !validSlugs.has(m[2].slice(1)));
      if (hasBroken) {
        console.log('   🔧 Detected hallucinated links in Related Travel Guides — auto-fixing...');
        const candidates = slugPool.filter(p => p.slug !== slug);
        const picks = candidates.sort(() => Math.random() - 0.5).slice(0, 3);
        const newLinks = picks.map(p => `[${p.title}](/${p.slug})`).join('\n\n');
        md = md.slice(0, sectionMatch.index) +
          sectionMatch[1] + newLinks + '\n' +
          md.slice(sectionMatch.index + sectionMatch[0].length - sectionMatch[3].length);
        console.log(`   ✅ Replaced with ${picks.length} valid links.`);
      }
    }
  }

  // Write file
  const outDir = path.join(BASE_OUT_DIR, category, YEAR, MONTH);
  fs.mkdirSync(outDir, { recursive: true });

  let filePath = path.join(outDir, `${slug}.md`);
  // Avoid overwriting — append counter if needed
  let counter = 1;
  while (fs.existsSync(filePath)) {
    filePath = path.join(outDir, `${slug}-${counter}.md`);
    counter++;
  }

  fs.writeFileSync(filePath, md, 'utf8');
  return { filePath, slug, category, title };
}

// ── Step 7: Generate cover image ─────────────────────────────────────────────
function generateImage(filePath) {
  try {
    execSync(`node scripts/generate-cover-image-fast.mjs "${filePath}"`, {
      stdio: 'inherit',
      cwd: ROOT,
      timeout: 300000,
    });
  } catch (e) {
    console.error(`   ⚠ Image generation failed: ${e.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Chrome Tab → Blog Pipeline\n' + '─'.repeat(50));

  if (DRY_RUN) console.log('⚠  DRY RUN MODE — no files will be written\n');

  // 1. Get all Chrome tab URLs
  console.log('📋 Step 1: Listing open Chrome tabs...');
  const allUrls = getChromeTabUrls();
  console.log(`   Found ${allUrls.length} total tabs`);

  // 2. Filter to article URLs only
  const articleUrls = allUrls.filter(url => {
    if (SKIP_URL_PATTERNS.some(p => url.includes(p))) return false;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      if (path === '/' || path === '' || path === '/rss') {
        return false;
      }
    } catch (e) {
      return false;
    }
    return true;
  });
  console.log(`   ${articleUrls.length} appear to be article pages\n`);

  if (articleUrls.length === 0) {
    console.log('✅ No new article tabs found. Exiting.');
    return;
  }

  if (DRY_RUN) {
    console.log('Tabs that would be processed:');
    articleUrls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
    return;
  }

  // 3. Load state
  const seenUrls = loadSeen();
  const slugPool = collectSlugs(60);
  let nextId = getNextPostId();

  // Load local scraped tabs (from python scraper fallback)
  const scrapedTabsMap = new Map();
  const scrapedTabsPath = path.join(ROOT, 'scratch', 'scraped_tabs.json');
  if (fs.existsSync(scrapedTabsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(scrapedTabsPath, 'utf8'));
      for (const item of data) {
        if (item.url && item.text) {
          scrapedTabsMap.set(item.url, item.text);
        }
      }
      console.log(`ℹ Loaded ${scrapedTabsMap.size} scraped tabs from scratch/scraped_tabs.json`);
    } catch (e) {
      console.warn('⚠ Failed to load scratch/scraped_tabs.json:', e.message);
    }
  }

  console.log(`📦 Next post ID: ${nextId}`);
  console.log(`🗂  Slug pool: ${slugPool.length} articles loaded for footer links\n`);

  const pendingImageGenerations = [];
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const url of articleUrls) {
    if (processed >= MAX_TABS) {
      console.log(`\n⚡ Reached --limit=${MAX_TABS}. Stopping.`);
      break;
    }

    if (seenUrls.has(url)) {
      console.log(`⏭  Skip (already processed): ${url}`);
      skipped++;
      continue;
    }

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📰 Processing [ID: ${nextId}]\n   ${url}`);

    try {
      // Fetch content
      console.log('   ↳ Fetching article content...');
      let rawText;
      if (scrapedTabsMap.has(url)) {
        rawText = scrapedTabsMap.get(url);
        console.log(`   ✅ Loaded from scratch/scraped_tabs.json (${rawText.length} chars)`);
      } else {
        try {
          rawText = await fetchContent(url);
          if (rawText.length < 400) throw new Error('Content too short — may be paywalled or JS-rendered');
          console.log(`   ✅ Fetched ${rawText.length} chars`);
        } catch (fetchErr) {
          console.warn(`   ↳ HTTP fetch failed (${fetchErr.message}), trying clipboard capture...`);
          // Try to fallback to active tab scraping if HTTP fetch fails (e.g. Cloudflare)
          try {
            // Find window and tab IDs for this URL
            const tabsInfo = execSync(`osascript -e '
              set output to ""
              tell application "Google Chrome"
                repeat with w in windows
                  set wId to id of w
                  repeat with t in tabs of w
                    if URL of t is "${url}" then
                      set tId to id of t
                      set output to wId & "," & tId
                      exit repeat
                    end if
                  end repeat
                  if output is not "" then exit repeat
                end repeat
              end tell
              return output
            '`).toString().trim().split(',');
            
            if (tabsInfo.length === 2) {
              const [wId, tId] = tabsInfo;
              execSync('pbcopy < /dev/null');
              execSync(`osascript -e '
                tell application "Google Chrome"
                  activate
                  set index of window id ${wId} to 1
                  set targetIdx to 0
                  set idx to 1
                  repeat with t in tabs of window id ${wId}
                    if (id of t as string) is "${tId}" then
                      set targetIdx to idx
                      exit repeat
                    end if
                    set idx to idx + 1
                  end repeat
                  if targetIdx > 0 then set active tab index of window id ${wId} to targetIdx
                end tell
                tell application "System Events"
                  set frontmost of process "Google Chrome" to true
                  delay 0.5
                  keystroke "a" using command down
                  delay 0.5
                  keystroke "c" using command down
                  delay 0.8
                end tell
              '`);
              rawText = execSync('pbpaste').toString().trim();
              if (rawText.length < 400) throw new Error('Clipboard content too short');
              console.log(`   ✅ Captured ${rawText.length} chars via clipboard`);
            } else {
              throw new Error('Tab not found for clipboard fallback');
            }
          } catch (clipErr) {
            console.error(`   ❌ Both HTTP fetch and clipboard capture failed. Skipping tab.`);
            errors++;
            continue;
          }
        }
      }

      // Extract category from source if available
      const sourceCategory = extractSourceCategory(rawText);
      if (sourceCategory && VALID_CATEGORIES.includes(sourceCategory)) {
        console.log(`   📂 Detected source category: ${sourceCategory}`);
      }

      // Select round-robin author from existing authors
      const authors = ['Kunal K Choudhary', 'Raushan Kumar', 'Preeti Gunjan'];
      const author = authors[nextId % authors.length];
      console.log(`   ✍ Selected author: ${author}`);

      // Rewrite with Claude
      const relatedLinks = pickRelatedLinks(slugPool);
      console.log('   ↳ Rewriting with Claude...');
      const md = await rewriteWithClaude(rawText, url, nextId, relatedLinks, sourceCategory, author);

      // Save
      console.log('   ↳ Saving markdown...');
      const { filePath, slug, category, title } = saveArticle(md, nextId, sourceCategory, author, slugPool);
      console.log(`   ✅ Saved: content/posts/${category}/${YEAR}/${MONTH}/${slug}.md`);
      console.log(`   📄 Title: ${title}`);

      // Extract excerpt from markdown frontmatter
      const excerptMatch = md.match(/excerpt:\s*"([^"]+)"/);
      const excerpt = excerptMatch ? excerptMatch[1] : title;

      pendingImageGenerations.push({
        articlePath: filePath,
        title,
        excerpt,
        slug,
        category,
        year: YEAR,
        month: MONTH
      });

      // Add to slug pool for subsequent articles this run
      slugPool.push({ slug, title, category });

      // Generate cover image
      if (!NO_IMAGES) {
        console.log('   ↳ Generating cover image...');
        generateImage(filePath);
      }

      // Mark seen
      seenUrls.add(url);
      saveSeen(seenUrls);

      nextId++;
      processed++;

      // Brief pause between articles to avoid API rate limits
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      errors++;
    }
  }

  // Save pending images to disk
  if (pendingImageGenerations.length > 0) {
    const scratchDir = '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/scratch';
    const pendingImagesFile = path.join(scratchDir, 'pending_image_generations.json');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    fs.writeFileSync(pendingImagesFile, JSON.stringify(pendingImageGenerations, null, 2), 'utf8');
    console.log(`\n📥 Saved ${pendingImageGenerations.length} pending image generation requests to: ${pendingImagesFile}`);
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Pipeline complete.`);
  console.log(`   Processed : ${processed}`);
  console.log(`   Skipped   : ${skipped}`);
  console.log(`   Errors    : ${errors}`);
  console.log(`   Next ID   : ${nextId}`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
