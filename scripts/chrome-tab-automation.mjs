#!/usr/bin/env node
/**
 * chrome-tab-automation.mjs
 *
 * Automated Chrome tab-to-blog pipeline for Travel Daily Post.
 *
 * Steps:
 *   1. Reads all open tabs from Google Chrome.
 *   2. Filters out non-article URLs and already processed URLs.
 *   3. Scrapes the raw text content of the tab using macOS copy-paste via AppleScript.
 *   4. Calls Claude (claude-haiku-4-5-20251001) to rewrite the content into the site's layout & tone.
 *   5. Saves the rewritten markdown file into the content posts tree.
 *   6. Saves the image prompts to a scratch file for the agent to generate.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Configuration ────────────────────────────────────────────────────────────
const SEEN_FILE = path.join(__dirname, 'seen-chrome-tabs.json');
const BASE_OUT_DIR = path.join(ROOT, 'content', 'posts');
const SCRATCH_DIR = '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/scratch';
const PENDING_IMAGES_FILE = path.join(SCRATCH_DIR, 'pending_image_generations.json');

const TODAY = new Date().toISOString().split('T')[0];
const YEAR = TODAY.slice(0, 4);
const MONTH = TODAY.slice(5, 7);

const SKIP_URL_PATTERNS = [
  'chrome://', 'chrome-extension://', 'about:', 'localhost', '127.0.0.1',
  'google.com', 'mail.google', 'drive.google', 'docs.google', 'sheets.google', 'accounts.google',
  'youtube.com', 'github.com', 'npmjs.com', 'platform.claude.ai', 'platform.openai.com',
  'hpanel.hostinger.com', 'dash.cloudflare.com', 'canva.com', 'perplexity.ai', 'genspark.ai',
  'gemini.google.com', 'one.google.com', 'aistudio.google.com', 'lmstudio.ai', 'paypal.com',
  'dashboard.linkpublishers.com', 'traveldailypost.com', 'nomadlawyer.org'
];

const VALID_CATEGORIES = [
  'travel-news', 'tourism-news', 'airline-news', 'railway-news', 'cruise-news',
  'destination-news', 'hotel-news', 'travel-alerts', 'travel-deals', 'travel-trends',
  'technology-news'
];

const CATEGORY_NAMES = {
  'travel-news': 'Travel News',
  'tourism-news': 'Tourism News',
  'airline-news': 'Airline News',
  'railway-news': 'Railway News',
  'cruise-news': 'Cruise News',
  'destination-news': 'Destination News',
  'hotel-news': 'Hotel News',
  'travel-alerts': 'Travel Alerts',
  'travel-deals': 'Travel Deals',
  'travel-trends': 'Travel Trends',
  'technology-news': 'Technology News'
};

// ── Load Environment Variables ────────────────────────────────────────────────
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      // Remove inline comments
      const commentIdx = trimmed.indexOf('#');
      const cleanLine = commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed;
      
      if (cleanLine) {
        const eq = cleanLine.indexOf('=');
        if (eq > 0) {
          const key = cleanLine.slice(0, eq).trim();
          const val = cleanLine.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
          process.env[key] = process.env[key] || val;
        }
      }
    });
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is not set in your .env file.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Seen URL Helpers ─────────────────────────────────────────────────────────
function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2) + '\n');
}

// ── Retrieve Chrome Tabs Info for a Specific Profile ────────────────────────
function getChromeTabs() {
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
          set wId to id of window 1
          repeat with t in tabs of window 1
            set tId to id of t
            set tURL to URL of t
            set tTitle to title of t
            set output to output & wId & "|||" & tId & "|||" & tURL & "|||" & tTitle & "\\n"
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
    return result.trim().split('\n').map(line => {
      const parts = line.split('|||');
      if (parts.length >= 4) {
        return {
          windowId: parts[0],
          tabId: parts[1],
          url: parts[2],
          title: parts[3]
        };
      }
      return null;
    }).filter(Boolean);
  } catch (e) {
    console.error('❌ AppleScript failed to list Chrome tabs for profile:', e.message);
    return [];
  }
}

// ── Scrape Active Tab using System Events Clipboard Copy ──────────────────────
function scrapeTabViaClipboard(windowId, tabId) {
  execSync('pbcopy < /dev/null'); // Clear clipboard
  
  const script = `
    tell application "Google Chrome"
      activate
      try
        set index of window id ${windowId} to 1
        set targetIdx to 0
        set idx to 1
        repeat with t in tabs of window id ${windowId}
          if (id of t as string) is "${tabId}" then
            set targetIdx to idx
            exit repeat
          end if
          set idx to idx + 1
        end repeat
        
        if targetIdx > 0 then
          set active tab index of window id ${windowId} to targetIdx
        end if
      end try
      delay 0.5
    end tell
    
    tell application "System Events"
      set frontmost of process "Google Chrome" to true
      delay 0.5
      keystroke "a" using command down
      delay 0.5
      keystroke "c" using command down
      delay 0.8
    end tell
  `;
  
  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 });
    const content = execSync('pbpaste', { encoding: 'utf8' });
    return content.trim();
  } catch (e) {
    console.error('❌ Clipboard capture failed:', e.message);
    return '';
  }
}

// ── Collect slugs on disk for internal related links ─────────────────────────
function collectSlugs(limit = 50) {
  const slugs = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) {
        try {
          const raw = fs.readFileSync(path.join(dir, entry.name), 'utf8');
          const sm = raw.match(/slug:\s*"([^"]+)"/);
          const tm = raw.match(/title:\s*"([^"]+)"/);
          if (sm && tm) slugs.push({ slug: sm[1], title: tm[1] });
        } catch {}
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
    .map(p => `* [${p.title}](/${p.slug})`)
    .join('\n');
}

// ── Get Next Post ID ──────────────────────────────────────────────────────────
function getNextPostId() {
  let highestId = 0;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
          const idMatch = content.match(/^id:\s*(\d+)/m);
          if (idMatch) {
            const id = parseInt(idMatch[1], 10);
            if (id > highestId) highestId = id;
          }
        } catch {}
      }
    }
  };
  walk(BASE_OUT_DIR);
  return highestId + 1;
}

// ── Claude Rewrite System Prompt ──────────────────────────────────────────────
function buildRewritePrompt(articleId, relatedLinks) {
  return `You are a professional travel journalist writing for traveldailypost.com.
Your goal is to rewrite the provided travel/tourism article into a compelling, 100% original, and SEO-optimized post.

WRITE IN THIS STYLE & FORMAT:
- Journalist and informative tone.
- Clear headings using ## (no # in body).
- Bold key terms, airline codes, prices, statistics, and entities on first mention.
- Do NOT use emojis.
- Include a "Comprehensive Data Breakdown" markdown table summarizing key statistics.
- Maintain all names, figures, and dates exactly as in the source.
- Add a "What This Means for Travelers" section with actionable bullet points.
- Include 2-3 links to high-authority official websites (e.g., FAA, IATA, UNWTO, official airline sites).
- End with a short punchy closing sentence.

MANDATORY FRONTMATTER FORMAT (start directly with --- at the very top):
---
id: ${articleId}
title: "[SEO headline containing brand names, geo targets, and key numbers]"
date: "${TODAY}"
updatedDate: "${TODAY}"
excerpt: "[150 char max summary with primary keywords]"
coverImage: "https://images.traveldailypost.com/articles/[category]/2026/06/[slug].jpg"
coverImageAlt: "[Descriptive alt text for the cover image]"
coverImageCaption: "Image generated by AI"
tags: ["Tag1", "Tag2", "Tag3", "2026"]
slug: "[url-friendly-slug-with-date-appended]"
category: "[travel-news|tourism-news|airline-news|hotel-news|cruise-news|railway-news|destination-news|travel-alerts|travel-deals|travel-trends|technology-news]"
categoryName: "[Matching Human Category Name]"
author: "[Preeti Gunjan|Raushan Kumar|Staff Writer]"
readTime: "5 min read"
featured: false
---

MANDATORY FOOTER:
## Related Travel Guides

${relatedLinks}

**Disclaimer:** Travel regulations, pricing, and scheduling are subject to change. Verify all information with official sources before finalizing plans.`;
}

// ── Rewrite Article with Claude ──────────────────────────────────────────────
async function rewriteArticle(rawText, articleId, relatedLinks) {
  const systemPrompt = buildRewritePrompt(articleId, relatedLinks);
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4090,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Rewrite this article for traveldailypost.com:\n\n${rawText.slice(0, 9500)}`
    }]
  });
  return response.content[0].text.trim();
}

// ── Main Execution ────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Running Chrome Tab Automation...');
  const tabs = getChromeTabs();
  console.log(`📋 Found ${tabs.length} open tabs.`);

  const seen = loadSeen();
  const slugPool = collectSlugs(50);
  let nextId = getNextPostId();
  
  const pendingImageGenerations = [];
  const processedUrls = [];

  // Filter out tabs
  const articleTabs = tabs.filter(tab => {
    if (seen.has(tab.url)) return false;
    if (SKIP_URL_PATTERNS.some(p => tab.url.includes(p))) return false;
    return true;
  });

  console.log(`📰 Found ${articleTabs.length} new article tabs to process.`);

  for (const tab of articleTabs) {
    console.log(`\n📄 Processing: ${tab.title} (${tab.url})`);
    console.log('   ↳ Extracting content via clipboard...');
    
    const rawText = scrapeTabViaClipboard(tab.windowId, tab.tabId);
    if (!rawText || rawText.length < 300) {
      console.warn('   ⚠️ Failed to get text or content too short. Skipping.');
      continue;
    }

    console.log(`   ↳ Text captured (${rawText.length} characters). Rewriting with Claude...`);
    const relatedLinks = pickRelatedLinks(slugPool);
    
    try {
      let md = await rewriteArticle(rawText, nextId, relatedLinks);
      
      if (md.startsWith('```markdown')) {
        md = md.replace(/^```markdown/, '').replace(/```$/, '').trim();
      } else if (md.startsWith('```')) {
        md = md.replace(/^```/, '').replace(/```$/, '').trim();
      }

      // Parse metadata from generated markdown
      const titleMatch = md.match(/title:\s*"([^"]+)"/);
      const slugMatch = md.match(/slug:\s*"([^"]+)"/);
      const categoryMatch = md.match(/category:\s*"([^"]+)"/);
      const excerptMatch = md.match(/excerpt:\s*"([^"]+)"/);

      if (!titleMatch || !slugMatch || !categoryMatch) {
        console.error('   ❌ Claude response missing title, slug, or category frontmatter. Skipping.');
        continue;
      }

      const title = titleMatch[1];
      let slug = slugMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!slug.endsWith(TODAY)) {
        slug = `${slug}-${TODAY}`;
      }
      
      let category = categoryMatch[1].toLowerCase().trim();
      if (!VALID_CATEGORIES.includes(category)) {
        category = 'travel-news';
      }

      // Update Markdown with final slug, dates, and category
      md = md.replace(/slug:\s*"[^"]*"/, `slug: "${slug}"`);
      md = md.replace(/category:\s*"[^"]*"/, `category: "${category}"`);
      md = md.replace(/categoryName:\s*"[^"]*"/, `categoryName: "${CATEGORY_NAMES[category]}"`);
      md = md.replace(/\[slug\]/g, slug);
      md = md.replace(/\[category\]/g, category);

      // Save rewritten article markdown
      const outDir = path.join(BASE_OUT_DIR, category, YEAR, MONTH);
      fs.mkdirSync(outDir, { recursive: true });
      const filename = path.join(outDir, `${slug}.md`);
      
      fs.writeFileSync(filename, md, 'utf8');
      console.log(`   ✅ Saved article: ${filename}`);

      // Extract image generation details
      const excerpt = excerptMatch ? excerptMatch[1] : title;
      pendingImageGenerations.push({
        articlePath: filename,
        title,
        excerpt,
        slug,
        category,
        year: YEAR,
        month: MONTH
      });

      processedUrls.push(tab.url);
      seen.add(tab.url);
      slugPool.push({ slug, title });
      nextId++;

      // Small delay between API requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error('   ❌ Rewrite failed:', err.message);
    }
  }

  // Save seen URLs and pending image list
  saveSeen(seen);
  
  if (pendingImageGenerations.length > 0) {
    if (!fs.existsSync(SCRATCH_DIR)) {
      fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    }
    fs.writeFileSync(PENDING_IMAGES_FILE, JSON.stringify(pendingImageGenerations, null, 2), 'utf8');
    console.log(`\n📥 Saved ${pendingImageGenerations.length} pending image generation requests to: ${PENDING_IMAGES_FILE}`);
  } else {
    console.log('\n✅ No articles to process/no images pending.');
  }
}

main().catch(err => {
  console.error('💥 Pipeline error:', err);
  process.exit(1);
});
