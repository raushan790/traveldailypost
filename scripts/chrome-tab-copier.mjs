#!/usr/bin/env node
/**
 * chrome-tab-copier.mjs
 *
 * Step 2: Copy blog content from all open tabs in a specific Chrome profile.
 *
 * This script:
 *   1. Enumerates all open tabs in the specified Chrome profile
 *   2. Activates each tab and copies its content via clipboard (Cmd+A, Cmd+C)
 *   3. Extracts clean text/HTML from the clipboard
 *   4. Saves the scraped content to JSON for the next pipeline step
 *
 * It does NOT alter any existing scripts.
 *
 * Usage:
 *   node scripts/chrome-tab-copier.mjs
 *
 * Output:
 *   scratch/scraped_blogs_YYYYMMDD_HHMMSS.json
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCRATCH_DIR = join(ROOT, 'scratch');

// ── Configuration ──────────────────────────────────────────────────────────────
const CHROME_PROFILE_NAME = 'RAM EKWAL'; // Same profile as Step 1

// URL patterns to SKIP (don't try to copy from these)
const SKIP_URL_PATTERNS = [
  'chrome://', 'chrome-extension://', 'about:', 'localhost', '127.0.0.1',
  'google.com', 'mail.google', 'drive.google', 'docs.google', 'sheets.google',
  'accounts.google', 'youtube.com', 'github.com', 'npmjs.com',
  'platform.claude.ai', 'platform.openai.com', 'canva.com',
  'perplexity.ai', 'genspark.ai', 'gemini.google.com',
  'one.google.com', 'aistudio.google.com', 'lmstudio.ai',
  'paypal.com', 'dashboard.linkpublishers.com',
  'traveldailypost.com', 'nomadlawyer.org'
];

// Minimum text length to consider a valid blog capture
const MIN_TEXT_LENGTH = 300;

// ── Ensure scratch directory exists ────────────────────────────────────────────
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Get all open tabs from the specified Chrome profile.
 * Returns array of { windowId, tabId, url, title }
 */
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
                set currentProfile to name of m
                if currentProfile is "${CHROME_PROFILE_NAME}" or currentProfile is "${CHROME_PROFILE_NAME.toLowerCase()}" then
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
    const escapedScript = script.replace(/'/g, "'\\''");
    const result = execSync(`osascript -e '${escapedScript}'`, {
      encoding: 'utf8',
      timeout: 25000,
    });
    return result.trim().split('\n')
      .map(line => {
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
      })
      .filter(Boolean);
  } catch (e) {
    console.error('❌ AppleScript failed to list Chrome tabs:', e.message);
    return [];
  }
}

/**
 * Activate a specific tab in Chrome and copy its content via clipboard.
 * Returns the raw text content.
 */
function scrapeTabContent(windowId, tabId, tabUrl) {
  // Clear clipboard first
  try {
    execSync('pbcopy < /dev/null', { timeout: 3000 });
  } catch {}

  const script = `
    tell application "Google Chrome"
      activate
      delay 0.5
      try
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

      -- Try to select and copy article content
      -- First try: select all and copy
      keystroke "a" using command down
      delay 0.5
      keystroke "c" using command down
      delay 1.0
    end tell
  `;

  try {
    const escapedScript = script.replace(/'/g, "'\\''");
    execSync(`osascript -e '${escapedScript}'`, { timeout: 20000 });

    const content = execSync('pbpaste', {
      encoding: 'utf8',
      timeout: 5000,
    });
    return content.trim();
  } catch (e) {
    console.error(`   ❌ Clipboard capture failed for "${tabUrl}": ${e.message}`);
    return '';
  }
}

/**
 * Determine the category of a URL based on its domain/path.
 */
function inferCategory(url) {
  const lower = url.toLowerCase();

  if (lower.includes('airline') || lower.includes('flight') || lower.includes('boeing') || lower.includes('airbus') || lower.includes('delta') || lower.includes('emirates') || lower.includes('american airlines') || lower.includes('british airways')) return 'airline-news';
  if (lower.includes('cruise') || lower.includes('royal caribbean') || lower.includes('norwegian')) return 'cruise-news';
  if (lower.includes('hotel') || lower.includes('resort') || lower.includes('hospitality') || lower.includes('marriott') || lower.includes('hilton')) return 'hotel-news';
  if (lower.includes('rail') || lower.includes('train') || lower.includes('bullet train')) return 'railway-news';
  if (lower.includes('tech') || lower.includes('technology') || lower.includes('digital') || lower.includes('app')) return 'technology-news';
  if (lower.includes('deal') || lower.includes('discount') || lower.includes('sale') || lower.includes('offer')) return 'travel-deals';
  if (lower.includes('alert') || lower.includes('warning') || lower.includes('safety') || lower.includes('security')) return 'travel-alerts';
  if (lower.includes('trend') || lower.includes('future') || lower.includes('forecast') || lower.includes('prediction')) return 'travel-trends';
  if (lower.includes('destination') || lower.includes('city') || lower.includes('country') || lower.includes('tourism')) return 'destination-news';

  return 'travel-news'; // default
}

/**
 * Generate a URL-friendly slug from a title.
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📋 Chrome Tab Copier - Travel Daily Post Automation');
  console.log('='.repeat(60));

  // Get tabs
  console.log(`\n🔍 Enumerating tabs in Chrome profile: "${CHROME_PROFILE_NAME}"...`);
  const tabs = getChromeTabs();
  console.log(`📋 Found ${tabs.length} open tabs.`);

  if (tabs.length === 0) {
    console.warn('⚠️ No tabs found. Make sure Chrome is running with the correct profile.');
    process.exit(1);
  }

  // Filter tabs
  const articleTabs = tabs.filter(tab => {
    if (SKIP_URL_PATTERNS.some(p => tab.url.includes(p))) {
      console.log(`   ⏭️ Skipping (filtered): ${tab.title}`);
      return false;
    }
    if (!tab.url.startsWith('http')) {
      console.log(`   ⏭️ Skipping (non-HTTP): ${tab.title}`);
      return false;
    }
    return true;
  });

  console.log(`\n📰 ${articleTabs.length} article tabs to process (${tabs.length - articleTabs.length} filtered out).`);

  // Scrape each tab
  const scrapedData = [];
  const failures = [];

  for (let i = 0; i < articleTabs.length; i++) {
    const tab = articleTabs[i];
    console.log(`\n[${i + 1}/${articleTabs.length}] Processing: ${tab.title}`);
    console.log(`   URL: ${tab.url}`);
    console.log('   ↳ Activating tab and copying content...');

    const rawContent = scrapeTabContent(tab.windowId, tab.tabId, tab.url);

    if (!rawContent || rawContent.length < MIN_TEXT_LENGTH) {
      console.warn(`   ⚠️ Content too short (${rawContent?.length || 0} chars). Skipping.`);
      failures.push({
        tab,
        reason: `Content too short (${rawContent?.length || 0} chars)`
      });
      continue;
    }

    scrapedData.push({
      url: tab.url,
      title: tab.title,
      category: inferCategory(tab.url),
      rawContent: rawContent,
      contentLength: rawContent.length,
      scrapedAt: new Date().toISOString(),
      windowId: tab.windowId,
      tabId: tab.tabId
    });

    console.log(`   ✅ Captured ${rawContent.length} characters.`);

    // Small delay between tabs
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = path.join(SCRATCH_DIR, `scraped_blogs_${timestamp}.json`);

  fs.writeFileSync(outputFile, JSON.stringify(scrapedData, null, 2), 'utf8');

  // Also save a latest symlink
  const latestFile = path.join(SCRATCH_DIR, 'scraped_blogs_latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(scrapedData, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   ✅ Successfully scraped: ${scrapedData.length} tabs`);
  console.log(`   ❌ Failed: ${failures.length} tabs`);
  console.log(`   📁 Output: ${outputFile}`);

  if (failures.length > 0) {
    console.log('\n   Failed tabs:');
    for (const f of failures) {
      console.log(`      - ${f.tab.title}: ${f.reason}`);
    }
  }

  console.log('\n✅ Copying complete.');
  console.log('   Next step: Run scripts/blog-rewriter.mjs to rewrite the scraped content.');
}

main().catch(err => {
  console.error('💥 Pipeline error:', err);
  process.exit(1);
});
