#!/usr/bin/env node
/**
 * chrome-blog-automation-v2.mjs
 *
 * Specialized automation for Travel Daily Post:
 * 1. Extracts tabs from a specific Chrome profile.
 * 2. Scrapes content via clipboard.
 * 3. Rewrites content preserving layout, tone, structure, and facts.
 * 4. Ensures long-format headings and standard .md formatting.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Configuration ────────────────────────────────────────────────────────────
const SEEN_FILE = path.join(__dirname, 'seen-automation-v2.json');
const BASE_OUT_DIR = path.join(ROOT, 'content', 'posts');
const TARGET_PROFILE = "RAM EKWAL"; // As identified in existing scripts

const TODAY = new Date().toISOString().split('T')[0];
const YEAR = TODAY.slice(0, 4);
const MONTH = TODAY.slice(5, 7);

const SKIP_URL_PATTERNS = [
  'chrome://', 'chrome-extension://', 'about:', 'localhost', '127.0.0.1',
  'google.com', 'mail.google', 'drive.google', 'docs.google', 'sheets.google',
  'accounts.google', 'youtube.com', 'github.com', 'npmjs.com', 'platform.claude.ai',
  'platform.openai.com', 'hpanel.hostinger.com', 'dash.cloudflare.com',
  'canva.com', 'perplexity.ai', 'genspark.ai', 'gemini.google.com',
  'one.google.com', 'aistudio.google.com', 'lmstudio.ai', 'paypal.com',
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

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is not set.');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1', // Default to Ollama local endpoint
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'))); }
  catch { return new Set(); }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2) + '\n');
}

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
                if profileName is "${TARGET_PROFILE}" then
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
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf8', timeout: 25000 });
    return result.trim().split('\n').map(line => {
      const parts = line.split('|||');
      if (parts.length >= 4) return { windowId: parts[0], tabId: parts[1], url: parts[2], title: parts[3] };
      return null;
    }).filter(Boolean);
  } catch (e) {
    console.error('❌ AppleScript failed:', e.message);
    return [];
  }
}

function scrapeTabViaClipboard(windowId, tabId) {
  execSync('pbcopy < /dev/null');
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
      delay 1.0
    end tell
    tell application "System Events"
      set frontmost of process "Google Chrome" to true
      delay 0.5
      keystroke "a" using command down
      delay 0.5
      keystroke "c" using command down
      delay 1.0
    end tell
  `;
  try {
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 });
    const content = execSync('pbpaste', { encoding: 'utf8' }).trim();
    return content;
  } catch (e) {
    console.error('❌ Clipboard failure:', e.message);
    return '';
  }
}

function getNextPostId() {
  let highestId = 0;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
          const idMatch = content.match(/^id:\\s*(\\d+)/m);
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

function buildRewritePrompt(articleId) {
  return `You are a senior travel journalist for traveldailypost.com.
Your task is to rewrite the provided blog post while strictly adhering to the following requirements:

1. LAYOUT & STRUCTURE:
   - Preserve the exact layout, tone, and structural flow of the source blog.
   - If the source has a specific sequence of sections, follow it.
   - Keep the narrative arc identical.

2. HEADINGS:
   - Use long-format headings exactly as they appear or are implied in the source.
   - Use ## for all headings in the body (no # in body).

3. DATA INTEGRITY:
   - PRESERVE ALL data, facts, figures, dates, and statistics.
   - PRESERVE all tables. If the source has a table, recreate it accurately in Markdown.
   - Bold key terms, airline codes, and prices on first mention.

4. STANDARDS:
   - No emojis.
   - Journalist-style informative tone.
   - Include a "What This Means for Travelers" section with actionable bullet points.
   - End with a punchy closing sentence.

MANDATORY FRONTMATTER (Start with ---):
---
id: ${articleId}
title: "[SEO headline containing brand names and key numbers]"
date: "${TODAY}"
updatedDate: "${TODAY}"
excerpt: "[150 char max summary]"
coverImage: "https://images.traveldailypost.com/articles/[category]/2026/06/[slug].jpg"
coverImageAlt: "[Descriptive alt text]"
coverImageCaption: "Image generated by AI"
tags: ["Tag1", "Tag2", "2026"]
slug: "[url-friendly-slug]"
category: "[category-slug]"
categoryName: "[Human Category Name]"
author: "Staff Writer"
readTime: "5 min read"
featured: false
---`;
}

async function rewriteArticle(rawText, articleId) {
  const systemPrompt = buildRewritePrompt(articleId);
  const response = await openai.chat.completions.create({
    model: 'gemma4:31b-cloud',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Source Blog Content:\n\n${rawText}` }
    ],
    temperature: 0.3,
    max_tokens: 4096,
    options: {
      num_ctx: 32768
    },
  });
  return response.choices[0].message.content.trim();
}

async function main() {
  console.log('🚀 Starting Chrome Blog Automation V2...');
  const tabs = getChromeTabs();
  console.log(`📋 Found ${tabs.length} tabs in profile ${TARGET_PROFILE}.`);

  const seen = loadSeen();
  let nextId = getNextPostId();

  const articleTabs = tabs.filter(tab => {
    if (seen.has(tab.url)) return false;
    if (SKIP_URL_PATTERNS.some(p => tab.url.includes(p))) return false;
    return true;
  });

  console.log(`📰 Processing ${articleTabs.length} new articles.`);

  for (const tab of articleTabs) {
    console.log(`\n📄 Processing: ${tab.title}`);
    const rawText = scrapeTabViaClipboard(tab.windowId, tab.tabId);
    if (!rawText || rawText.length < 300) {
      console.warn('   ⚠️ Content too short. Skipping.');
      continue;
    }

    try {
      console.log(`   ⏳ Rewriting with LLM (this may take 1-2 minutes)...`);
      let md = await rewriteArticle(rawText, nextId);
      console.log(`   ✨ Rewrite complete!`);
      if (md.startsWith('```markdown')) md = md.replace(/^```markdown/, '').replace(/```$/, '').trim();
      else if (md.startsWith('```')) md = md.replace(/^```/, '').replace(/```$/, '').trim();

      const titleMatch = md.match(/title:\\s*"([^"]+)"/);
      const slugMatch = md.match(/slug:\\s*"([^"]+)"/);
      const categoryMatch = md.match(/category:\\s*"([^"]+)"/);

      if (!titleMatch || !slugMatch || !categoryMatch) {
        console.error('   ❌ Missing frontmatter. Skipping.');
        continue;
      }

      const title = titleMatch[1];
      let slug = slugMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!slug.endsWith(TODAY)) slug = `${slug}-${TODAY}`;

      let category = categoryMatch[1].toLowerCase().trim();
      if (!VALID_CATEGORIES.includes(category)) category = 'travel-news';

      md = md.replace(/slug:\\s*"[^"]*"/, `slug: "${slug}"`);
      md = md.replace(/category:\\s*"[^"]*"/, `category: "${category}"`);
      md = md.replace(/categoryName:\\s*"[^"]*"/, `categoryName: "${CATEGORY_NAMES[category]}"`);
      md = md.replace(/\\[slug\\]/g, slug);
      md = md.replace(/\\[category\\]/g, category);

      const outDir = path.join(BASE_OUT_DIR, category, YEAR, MONTH);
      fs.mkdirSync(outDir, { recursive: true });
      const filename = path.join(outDir, `${slug}.md`);

      fs.writeFileSync(filename, md, 'utf8');
      console.log(`   ✅ Saved: ${filename}`);

      seen.add(tab.url);
      nextId++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }
  }
  saveSeen(seen);
  console.log('\n✅ Automation completed.');
}

main().catch(err => {
  console.error('💥 Pipeline crash:', err);
  process.exit(1);
});
