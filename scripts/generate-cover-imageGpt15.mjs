#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Together } from 'together-ai';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env and .env.local (Next.js convention)
for (const envFile of ['.env', '.env.local']) {
  const envPath = path.resolve(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx);
          const value = trimmed.slice(eqIdx + 1).replace(/^"|"$/g, ''); // strip surrounding quotes
          process.env[key] = process.env[key] || value; // don't override native env
        }
      }
    });
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node scripts/generate-cover-image.mjs <markdown_file_path>");
  process.exit(1);
}

const mdPath = path.resolve(ROOT, args[0]);
if (!fs.existsSync(mdPath)) {
  console.error(`❌ Markdown file not found: ${mdPath}`);
  process.exit(1);
}

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Validate R2 credentials early
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'traveldailypost';
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
  console.error('❌ Missing R2 credentials. Ensure these are set in .env.local:');
  if (!R2_ACCOUNT_ID) console.error('   R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY) console.error('   R2_ACCESS_KEY_ID');
  if (!R2_SECRET_KEY) console.error('   R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

console.log(`[i] R2 Bucket: ${R2_BUCKET}`);

const r2Client = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});

async function main() {
  console.log(`[i] Reading Markdown file: ${args[0]}`);
  let content = fs.readFileSync(mdPath, 'utf8');

  // Extract frontmatter info
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!frontmatterMatch) {
    console.error("❌ Could not find frontmatter block.");
    process.exit(1);
  }
  const frontmatterStr = frontmatterMatch[1];

  const getField = (fieldName) => {
    const regex = new RegExp(`^${fieldName}:\\s*(["']?)(.*?)\\1\\s*$`, 'm');
    const match = frontmatterStr.match(regex);
    return match ? match[2].trim() : null;
  };

  const title = getField('title');
  const slug = getField('slug');
  const category = getField('category') || 'travel-news';
  const excerpt = getField('excerpt') || getField('description') || title;

  if (!title || !slug) {
    console.error("❌ Could not find title or slug in frontmatter.");
    process.exit(1);
  }

  console.log(`[i] Title: ${title}`);
  console.log(`[i] Category: ${category}`);

  let promptText = '';
  try {
    console.log('[i] Calling Claude chat completion to generate a category-specific image prompt...');
    const chatResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `You are an expert prompt engineer for FLUX.1-schnell image generator.
Your job is to generate a highly detailed, photorealistic, premium image description (prompt) based on the category, title, and excerpt/context of a travel article.

General Style Guidelines:
- The output prompt MUST BE in a single paragraph, highly descriptive and detailed.
- Always aim for a photorealistic style, cinematic quality, 4K resolution, shallow depth of field, warm and cool tones, shot on Canon EOS R5 with 24-70mm f/2.8 lens.
- Avoid illustrations, paintings, graphics, and cartoons.
- Do NOT include any text, watermarks, logos, or artificial borders in the scene.
- Avoid using specific trademarked/copyrighted terms (e.g., "Pokémon", "Pikachu", "Disney", "Marvel", "Star Wars", "Mickey Mouse") in the final prompt text to prevent safety/copyright filter blocks. Instead, describe them using high-quality generic equivalents (e.g., "cute cartoon monster characters", "whimsical fantasy characters", "cheerful mouse-like character", "famous theme-park characters", "giant character balloon").
- Ensure the people, ethnicities, and architectural styles match the geographical context of the article (e.g., if the article is about Japan, specify Japanese women/men and modern Japanese/Tokyo architecture).
- Keep descriptions natural, real, and raw.

Category-specific instructions:
1. For "travel-alert" category:
Use the following exact pattern, customizing the bracketed fields based on the location and context of the article:
"Three beautiful, real-looking young women — one [Ethnicity/Nationality 1] with [hair color/style 1], one [Ethnicity/Nationality 2] with [hair color/style 2], and one [Ethnicity/Nationality 3] with [hair color/style 3] — standing together inside a modern, busy [airport terminal/train station/port/transit location]. The setting is [Airport/Location Name], with large glass windows, [local architectural style, e.g., Scandinavian minimalist / futuristic glass] architecture, and departure boards visible in the background showing 'DELAYED' and 'CANCELLED' flight (or relevant transit) statuses. The women are reacting emotionally and naturally to the disruption: one is looking at her phone with a worried and frustrated expression, another is checking the departure board with a sigh, and the third is holding her luggage handle tightly with a concerned look. They are dressed in stylish, casual [local/regional style] travel outfits — light jackets, scarves, and carry-on bags. The lighting is bright and natural, coming through the airport windows. Photorealistic style, cinematic quality, 4K resolution, shallow depth of field, warm and cool tones blended to reflect a stressful yet human travel moment."

2. For "airline-news", "cruise-news", "railway-news", "travel-technology-news":
Focus on transit hubs (airports, train stations, cruise docks) showing real, diverse, stylish travelers (e.g., beautiful local women or a young couple) interacting naturally. Ensure the specific airline, train type, or cruise ship brand and location context is visually hinted (e.g., a boarding gate, runway view, cruise ship deck). The mood should be active, realistic, and modern.

3. For "hotel-news":
Focus on luxury hospitality. Show a beautiful young local woman or couple relaxing in a stunning infinity pool, a high-ceilinged elegant lobby, or a luxury suite. Focus on high-end interior/exterior architecture matching the destination (e.g., tropical, alpine, historical European) and warm, inviting, premium lighting.

4. For all other categories (e.g., "destination-news", "tourism-news", "travel-news", "travel-trends", "travel-tips", "travel-deals"):
Show scenic travel lifestyle shots. Feature two beautiful, real-looking young women (or a couple) — one local and one traveler — exploring a scenic street, local market, beach, or historic landmark in the destination, laughing or interacting naturally. Use rich textures and beautiful natural lighting (like golden hour).

CRITICAL: Return ONLY the final raw prompt string. Do not wrap it in quotes, do not include any introductory or concluding text (such as "Here is your prompt:"), and do not explain your choice. Just return the prompt text itself.`,
      messages: [
        {
          role: 'user',
          content: `Category: ${category}\nTitle: ${title}\nExcerpt: ${excerpt}`
        }
      ],
      temperature: 0.7,
    });

    promptText = chatResponse.content[0].text.trim();
    // Strip surrounding quotes if the model wrapped the prompt in quotes
    promptText = promptText.replace(/^["']|["']$/g, '');
    console.log(`\n✨ Generated Prompt:\n"${promptText}"\n`);
  } catch (err) {
    console.warn(`⚠️ Failed to generate custom prompt via LLM: ${err.message}. Falling back to default prompt.`);
    promptText = `RAW, unfiltered photojournalism. Breaking news cover photo for: "${title}". Context: ${excerpt}. Shot by a war-zone Reuters photographer embedded in the chaos. SHOW THE CHAOS — crowded airports with grounded flights and frustrated travelers, flooded streets with rising water, closed airspace with grounded planes on tarmac, or tense border checkpoints with long queues depending on the article context. People reacting with real raw emotion — stress, exhaustion, urgency, confusion. Feature real diverse travelers and locals caught in the situation: families with luggage sitting on airport floors, businessmen staring at departure boards showing CANCELLED, local women looking worried or determined, couples holding each other amid disruption. Gritty photorealistic style — motion blur on rushing crowds, harsh fluorescent airport lighting mixed with dramatic storm clouds outside, rain-streaked windows, police tape, emergency vehicles with flashing lights. Shot on Canon EOS R5 with 24-70mm f/2.8 lens, shallow depth of field with sharp subject and chaotic blurred background. High ISO grain for authenticity. Color grading: desaturated with punchy contrast, teal shadows and amber highlights. Ultra wide angle showing the full scale of the scene. NO text, NO watermarks, NO logos, NO illustrations. This must look like a real photograph that could appear on the front page of The New York Times.`;
  }


  console.log('\n🎨 Generating cover image with Together AI (openai/gpt-image-1.5)...');
  let fileBuffer;
  try {
    const response = await together.images.generate({
      model: 'openai/gpt-image-1.5',
      prompt: promptText,
      n: 1,
      size: '1536x1024',
      quality: 'low'
    });

    if (response.data && response.data[0] && response.data[0].b64_json) {
      fileBuffer = Buffer.from(response.data[0].b64_json, 'base64');
      console.log(`✅ Image generated successfully (${Math.round(fileBuffer.length / 1024)} KB raw).`);
    } else if (response.data && response.data[0] && response.data[0].url) {
      const imageUrl = response.data[0].url;
      console.log(`✅ Image generated (URL). Downloading...`);
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
      const arrayBuf = await imgRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      console.log(`✅ Image downloaded successfully (${Math.round(fileBuffer.length / 1024)} KB raw).`);
    } else {
      throw new Error('No image data or URL in response from Together AI');
    }
  } catch (err) {
    console.error('❌ Failed to generate image with Together AI:', err.message);
    process.exit(1);
  }

  console.log('🔄 Processing and resizing image with Sharp...');
  let quality = 90;
  let finalBuffer;

  // Custom compress loop to hit ~200KB
  while (true) {
    finalBuffer = await sharp(fileBuffer)
      .resize(1300, 900, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: quality })
      .toBuffer();

    if (finalBuffer.length <= 210000 || quality <= 30) {
      break;
    }
    quality -= 5;
  }

  console.log(`   Size: ${Math.round(finalBuffer.length / 1024)} KB (Quality: ${quality})`);

  console.log('📤 Uploading to Cloudflare R2...');
  const dateObj = new Date();
  const year = dateObj.getFullYear().toString();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const outFile = `${slug}-${Date.now()}.jpg`;
  const r2Key = `articles/${category}/${year}/${month}/${outFile}`;

  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: finalBuffer,
    ContentType: 'image/jpeg',
  }));

  const finalImageUrl = `https://images.traveldailypost.com/${r2Key}`;
  console.log(`✅ Uploaded to R2: ${finalImageUrl}`);

  console.log('📝 Updating markdown file...');
  // Update coverImage field regardless of what it was
  const oldCoverMatch = content.match(/coverImage:\s*"([^"]*)"/);
  if (oldCoverMatch) {
    content = content.replace(oldCoverMatch[0], `coverImage: "${finalImageUrl}"`);
  } else {
    // If it doesn't exist, inject it right after the title
    content = content.replace(/title:\s*"([^"]+)"/, `title: "$1"\ncoverImage: "${finalImageUrl}"`);
  }

  // CRITICAL: Remove any remaining duplicate empty coverImage lines to prevent YAML parse errors
  content = content.replace(/\ncoverImage:\s*""\n/g, '\n');

  // Make sure caption is defined
  if (!content.includes('coverImageCaption:')) {
    content = content.replace(/coverImage:\s*"([^"]+)"/, `coverImage: "$1"\ncoverImageCaption: "Image generated by AI"`);
  }

  fs.writeFileSync(mdPath, content, 'utf8');
  console.log('✅ Markdown file successfully updated! Workflow complete.');
}

main().catch(err => {
  console.error('\n❌ Fatal Error:', err);
  process.exit(1);
});
