#!/usr/bin/env node
/**
 * blog-rewriter.mjs
 *
 * Step 3: Rewrite scraped blog content using LLM.
 *
 * This script:
 *   1. Reads scraped blog JSON from Step 2 (chrome-tab-copier.mjs)
 *   2. For each blog, sends content to LLM API with strict rewriting instructions
 *   3. Preserves layout, tone, structure, data, facts, tables, headings
 *   4. Outputs rewritten blogs as JSON for Step 4 (markdown formatter)
 *
 * It does NOT alter any existing scripts.
 *
 * Usage:
 *   node scripts/blog-rewriter.mjs
 *
 * Environment Variables:
 *   OPENAI_BASE_URL  - API endpoint (default: https://api.openai.com/v1)
 *   OPENAI_API_KEY   - API key for LLM
 *   OPENAI_MODEL     - Model to use (default: gpt-4o)
 *   SCRAPED_FILE     - Path to scraped blogs JSON (default: scratch/scraped_blogs_latest.json)
 *   OUTPUT_FILE      - Path for rewritten blogs JSON (default: scratch/rewritten_blogs_latest.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCRATCH_DIR = join(ROOT, 'scratch');

// ── Configuration ──────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const SCRAPED_FILE = process.env.SCRAPED_FILE || path.join(SCRATCH_DIR, 'scraped_blogs_latest.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(SCRATCH_DIR, 'rewritten_blogs_latest.json');

// Rate limiting: requests per minute
const MAX_REQUESTS_PER_MINUTE = 30;
const REQUEST_DELAY_MS = 60000 / MAX_REQUESTS_PER_MINUTE; // ms between requests

// ── Ensure scratch directory exists ────────────────────────────────────────────
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

// ── Validate environment ──────────────────────────────────────────────────────
if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is not set.');
  console.error('   Usage: OPENAI_API_KEY=sk-xxx node scripts/blog-rewriter.mjs');
  process.exit(1);
}

// ── LLM Rewriting Prompt ──────────────────────────────────────────────────────

const REWRITE_PROMPT = `You are a professional travel journalist and editor. Your task is to REWRITE the provided blog article while STRICTLY preserving:

1. **Structure & Layout**: Keep the exact same section order, heading hierarchy (H1/H2/H3), paragraph structure, list formats, and overall document flow.
2. **Tone**: Match the original tone - whether it's professional, conversational, analytical, or news-oriented.
3. **Data & Facts**: ALL numbers, statistics, dates, names, locations, company names, flight numbers, prices, percentages, and factual claims must be PRESERVED EXACTLY as-is. Do NOT change any data.
4. **Tables**: If the article contains tables, preserve them EXACTLY with all data intact.
5. **Headings**: Keep heading structure identical. Expand short headings into long, descriptive format matching the source style. Do NOT shorten or simplify headings.
6. **Links**: If URLs or hyperlinks are present, preserve them.

What you SHOULD change:
- Rephrase sentences to be original (avoid plagiarism)
- Improve clarity and flow where possible
- Use synonyms and alternative phrasing
- Make it read naturally while preserving all facts

CRITICAL RULES:
- NEVER change any numbers, dates, statistics, or factual data
- NEVER remove or add information
- NEVER change company names, flight numbers, or proper nouns
- NEVER shorten headings - keep them long and descriptive
- NEVER change the overall structure or section order
- If you encounter a table, preserve it exactly
- Output ONLY the rewritten article content as plain text (no markdown code blocks, no explanations)

Here is the article to rewrite:

---

`;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Clean raw scraped content - remove obvious clipboard artifacts
 */
function cleanContent(rawContent) {
  let cleaned = rawContent;

  // Remove common clipboard artifacts
  cleaned = cleaned.replace(/\r\n/g, '\n');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // Remove menu bar artifacts that sometimes get copied
  cleaned = cleaned.replace(/^(File|Edit|View|History|Bookmarks|Window|Help|Window|View|Developer|History|Bookmarks|File|Edit)\s*$/gm, '');

  return cleaned.trim();
}

/**
 * Call the LLM API to rewrite content
 */
async function rewriteWithLLM(content, title, url) {
  const systemPrompt = `You are a professional travel journalist and editor at Travel Daily Post. You rewrite articles while preserving all facts, data, structure, and tone. You NEVER change numbers, dates, statistics, company names, or proper nouns. You keep headings long and descriptive. You output ONLY the rewritten article as plain text - no markdown code blocks, no explanations, no preamble.`;

  const userPrompt = `${REWRITE_PROMPT}
TITLE: ${title}
URL: ${url}

ARTICLE:
${content}
`;

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const rewritten = data.choices?.[0]?.message?.content?.trim();

  if (!rewritten) {
    throw new Error('Empty response from LLM');
  }

  return rewritten;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('✍️  Blog Rewriter - Travel Daily Post Automation');
  console.log('='.repeat(60));

  // Read scraped blogs
  console.log(`\n📂 Reading scraped blogs from: ${SCRAPED_FILE}`);

  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(`❌ File not found: ${SCRAPED_FILE}`);
    console.error('   Run scripts/chrome-tab-copier.mjs first.');
    process.exit(1);
  }

  const scrapedData = JSON.parse(fs.readFileSync(SCRAPED_FILE, 'utf8'));
  console.log(`📰 Found ${scrapedData.length} blogs to rewrite.`);

  if (scrapedData.length === 0) {
    console.warn('⚠️ No blogs to rewrite.');
    process.exit(0);
  }

  // Process each blog
  const rewrittenData = [];
  const failures = [];

  for (let i = 0; i < scrapedData.length; i++) {
    const blog = scrapedData[i];
    console.log(`\n[${i + 1}/${scrapedData.length}] Rewriting: ${blog.title}`);
    console.log(`   URL: ${blog.url}`);
    console.log(`   Raw content length: ${blog.rawContent.length} chars`);

    try {
      // Clean content
      const cleanedContent = cleanContent(blog.rawContent);
      console.log(`   Cleaned content length: ${cleanedContent.length} chars`);

      if (cleanedContent.length < 100) {
        throw new Error('Content too short after cleaning');
      }

      // Call LLM
      console.log('   ↳ Calling LLM to rewrite...');
      const rewrittenContent = await rewriteWithLLM(cleanedContent, blog.title, blog.url);
      console.log(`   ✅ Rewritten: ${rewrittenContent.length} chars`);

      // Validate rewritten content
      if (rewrittenContent.length < blog.rawContent.length * 0.3) {
        console.warn('   ⚠️ Rewritten content is suspiciously short - may have lost data');
      }

      rewrittenData.push({
        url: blog.url,
        title: blog.title,
        category: blog.category,
        originalContent: cleanedContent,
        rewrittenContent: rewrittenContent,
        contentLength: rewrittenContent.length,
        rewrittenAt: new Date().toISOString(),
        model: MODEL,
        windowId: blog.windowId,
        tabId: blog.tabId
      });

      console.log(`   ✅ Done.`);

    } catch (err) {
      console.error(`   ❌ Rewrite failed: ${err.message}`);
      failures.push({
        blog,
        error: err.message
      });
    }

    // Rate limiting delay
    if (i < scrapedData.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = path.join(SCRATCH_DIR, `rewritten_blogs_${timestamp}.json`);

  fs.writeFileSync(outputFile, JSON.stringify(rewrittenData, null, 2), 'utf8');

  // Also save a latest symlink
  const latestFile = path.join(SCRATCH_DIR, 'rewritten_blogs_latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(rewrittenData, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   ✅ Successfully rewritten: ${rewrittenData.length} blogs`);
  console.log(`   ❌ Failed: ${failures.length} blogs`);
  console.log(`   📁 Output: ${outputFile}`);

  if (failures.length > 0) {
    console.log('\n   Failed blogs:');
    for (const f of failures) {
      console.log(`      - ${f.blog.title}: ${f.error}`);
    }
  }

  console.log('\n✅ Rewriting complete.');
  console.log('   Next step: Run scripts/blog-markdown-formatter.mjs to format as .md files.');
}

main().catch(err => {
  console.error('💥 Rewriter error:', err);
  process.exit(1);
});
