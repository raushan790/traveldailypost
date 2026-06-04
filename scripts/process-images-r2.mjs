import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Configuration ────────────────────────────────────────────────────────────
const PENDING_IMAGES_FILE = '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/scratch/pending_image_generations.json';

// Array of generated PNG file paths from Antigravity tool
const GENERATED_PNGS = [
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/oman_air_seeb_airport_1780602226817.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/oslo_airport_cancellations_1780602240073.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/middle_east_flight_crisis_1780602251952.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/bogota_airport_chaos_1780602289193.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/mexico_airport_meltdown_1780602303220.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/skywest_uturn_flight_1780602315922.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/malpensa_airport_delays_1780602367536.png',
  '/Users/raushankumar/.gemini/antigravity-ide/brain/4c7770fb-1443-468b-a091-23ddd50b6b60/world_cup_liveries_1780602381220.png'
];

// ── Load Env ─────────────────────────────────────────────────────────────────
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

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing Cloudflare R2 Credentials in env.');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = R2_BUCKET_NAME || 'traveldailypost';
const PUBLIC_URL = (R2_PUBLIC_URL || 'https://images.traveldailypost.com').replace(/\/$/, '');

async function processImage(pngPath, outLocalJpgPath) {
  const dir = path.dirname(outLocalJpgPath);
  fs.mkdirSync(dir, { recursive: true });

  await sharp(pngPath)
    .resize(1200, 700, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88 })
    .toFile(outLocalJpgPath);
}

async function uploadToR2(localJpgPath, r2Key) {
  const fileContent = fs.readFileSync(localJpgPath);
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: fileContent,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function main() {
  if (!fs.existsSync(PENDING_IMAGES_FILE)) {
    console.log('⚠️ No pending images file found.');
    return;
  }

  const items = JSON.parse(fs.readFileSync(PENDING_IMAGES_FILE, 'utf8'));
  console.log(`🖼️ Processing ${items.length} pending images...`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { articlePath, slug, category, year, month } = item;
    
    const pngSource = GENERATED_PNGS[i % GENERATED_PNGS.length];
    
    // Paths
    const localJpgRelPath = `images/articles/${category}/${year}/${month}/${slug}.jpg`;
    const localJpgFullPath = path.join(ROOT, 'public', localJpgRelPath);
    const r2Key = `articles/${category}/${year}/${month}/${slug}.jpg`;
    const r2PublicUrl = `${PUBLIC_URL}/${r2Key}`;

    console.log(`\n📦 Article: ${slug}`);
    console.log(`   🎨 Converting ${path.basename(pngSource)} to JPEG...`);
    try {
      await processImage(pngSource, localJpgFullPath);
      console.log(`   ✅ Saved local JPEG: public/${localJpgRelPath}`);

      console.log(`   ☁️ Uploading to R2 (${BUCKET}/${r2Key})...`);
      await uploadToR2(localJpgFullPath, r2Key);
      console.log(`   ✅ R2 URL: ${r2PublicUrl}`);

      // Delete the local JPEG file after upload
      fs.unlinkSync(localJpgFullPath);
      console.log(`   🗑️  Deleted local JPEG`);

      // Update Markdown Cover Image
      let md = fs.readFileSync(articlePath, 'utf8');
      md = md.replace(/coverImage:\s*"[^"]*"/, `coverImage: "${r2PublicUrl}"`);
      fs.writeFileSync(articlePath, md, 'utf8');
      console.log(`   ✅ Updated Markdown coverImage`);
    } catch (e) {
      console.error(`   ❌ Failed processing: ${e.message}`);
    }
  }

  // Clear pending images file since they are now processed
  fs.unlinkSync(PENDING_IMAGES_FILE);
  console.log('\n✨ All images processed, uploaded, and linked!');
}

main().catch(console.error);
