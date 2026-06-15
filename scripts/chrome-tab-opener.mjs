#!/usr/bin/env node
/**
 * chrome-tab-opener.mjs
 *
 * Step 1: Open URLs in a specific Google Chrome profile.
 *
 * This script takes a list of URLs and opens them as tabs in a specified Chrome profile.
 * It does NOT alter any existing scripts.
 *
 * Usage:
 *   node scripts/chrome-tab-opener.mjs
 *
 * Configuration is done at the top of this file.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Configuration ──────────────────────────────────────────────────────────────
const CHROME_PROFILE_NAME = 'RAM EKWAL'; // Change this to your Chrome profile name

// URLs to open - add your blog source URLs here
const TARGET_URLS = [
  'https://www.example-travel-blog.com/article-1',
  'https://www.example-travel-blog.com/article-2',
  'https://www.example-travel-blog.com/article-3',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function openTabsInChromeProfile(urls, profileName) {
  if (urls.length === 0) {
    console.warn('⚠️ No URLs provided to open.');
    return;
  }

  console.log(`🚀 Opening ${urls.length} tabs in Chrome profile: "${profileName}"`);

  // Build AppleScript to open URLs in the specified Chrome profile
  let script = `
    tell application "Google Chrome"
      activate
  `;

  for (const url of urls) {
    script += `
      tell active window
        make new tab with properties {url:"${url}"}
      end tell
    `;
  }

  // Switch to the specified profile
  script += `
      -- Switch to the target profile
      tell application "System Events"
        tell process "Google Chrome"
          click menu item "${profileName}" of menu 1 of menu bar item "Profiles" of menu bar 1
        end tell
      end tell
    end tell
  `;

  try {
    const escapedScript = script.replace(/'/g, "'\\''");
    execSync(`osascript -e '${escapedScript}'`, {
      timeout: 30000,
      stdio: 'pipe',
    });
    console.log(`✅ Successfully opened ${urls.length} tabs in profile "${profileName}"`);
  } catch (e) {
    console.error('❌ Failed to open tabs in Chrome:', e.message);
    throw e;
  }
}

function verifyChromeProfile(profileName) {
  let script = `
    set profileFound to false
    tell application "Google Chrome" to activate
    delay 0.5
    tell application "System Events"
      tell process "Google Chrome"
        repeat with m in menu items of menu 1 of menu bar item "Profiles" of menu bar 1
          if name of m is "${profileName}" then
            set profileFound to true
            exit repeat
          end if
        end repeat
      end tell
    end tell
    return profileFound
  `;

  try {
    const escapedScript = script.replace(/'/g, "'\\''");
    const result = execSync(`osascript -e '${escapedScript}'`, {
      encoding: 'utf8',
      timeout: 10000,
    }).trim();
    return result === 'true';
  } catch (e) {
    console.error('❌ Failed to verify Chrome profile:', e.message);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧 Chrome Tab Opener - Travel Daily Post Automation');
  console.log('='.repeat(60));

  // Verify profile exists
  console.log(`\n🔍 Verifying Chrome profile: "${CHROME_PROFILE_NAME}"...`);
  const profileExists = verifyChromeProfile(CHROME_PROFILE_NAME);

  if (!profileExists) {
    console.warn(`⚠️ Profile "${CHROME_PROFILE_NAME}" not found or Chrome is not running.`);
    console.log('   Make sure Chrome is running with the profile available.');
    console.log('   Update CHROME_PROFILE_NAME in this script if needed.');
    process.exit(1);
  }
  console.log('✅ Chrome profile verified.');

  // Open tabs
  console.log(`\n📋 URLs to open:`);
  for (let i = 0; i < TARGET_URLS.length; i++) {
    console.log(`   ${i + 1}. ${TARGET_URLS[i]}`);
  }

  console.log('\n⏳ Opening tabs...');
  openTabsInChromeProfile(TARGET_URLS, CHROME_PROFILE_NAME);

  console.log('\n✅ Tab opening complete.');
  console.log('   Next step: Run scripts/chrome-tab-copier.mjs to copy blog content from these tabs.');
}

main().catch(err => {
  console.error('💥 Pipeline error:', err);
  process.exit(1);
});
