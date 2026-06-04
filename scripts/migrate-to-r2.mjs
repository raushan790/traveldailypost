import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT; // e.g. https://<accountid>.r2.cloudflarestorage.com
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'traveldailypost-images';
const IMAGE_BASE_URL = 'https://images.traveldailypost.com';

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error('❌ Error: Missing R2 credentials in .env file. Please ensure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT are set.');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const CONTENT_POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

async function uploadFileToR2(filePath, relativePath) {
  const fileContent = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: relativePath,
    Body: fileContent,
    ContentType: getContentType(filePath),
  });

  try {
    await s3Client.send(command);
    console.log(`✅ Uploaded: ${relativePath}`);
  } catch (err) {
    console.error(`❌ Failed to upload ${relativePath}:`, err);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimes = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  return mimes[ext] || 'application/octet-stream';
}

async function migrateImages(dir, relativeBase = '') {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const relPath = path.join(relativeBase, file.name);

    if (file.isDirectory()) {
      await migrateImages(fullPath, relPath);
    } else {
      const ext = path.extname(file.name).toLowerCase();
      if (['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) {
        // We want to strip 'public/images/' from the key so it's just 'articles/news.webp'
        // But the URL will be https://images.traveldailypost.com/articles/news.webp
        // So the key should be the part after 'public/images/'
        const key = path.relative(path.join(process.cwd(), 'public', 'images'), fullPath).replace(/\\/g, '/');
        await uploadFileToR2(fullPath, key);
      }
    }
  }
}

async function updateMarkdownFiles() {
  if (!fs.existsSync(CONTENT_POSTS_DIR)) {
    console.warn(`⚠️  Directory not found: ${CONTENT_POSTS_DIR}`);
    return;
  }

  const files = fs.readdirSync(CONTENT_POSTS_DIR, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(CONTENT_POSTS_DIR, file.name);

    if (file.isDirectory()) {
      // Recursively update subdirectories
      const subDirFiles = fs.readdirSync(fullPath, { withFileTypes: true });
      // This is a simplified recursion for the purpose of the script
      await updateDir(fullPath);
    } else if (file.name.endsWith('.md')) {
      await processMarkdownFile(fullPath);
    }
  }
}

async function updateDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      await updateDir(fullPath);
    } else if (file.name.endsWith('.md')) {
      await processMarkdownFile(fullPath);
    }
  }
}

async function processMarkdownFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content, restore } = matter(fileContent);
  let changed = false;

  // 1. Update frontmatter coverImage
  if (data.coverImage && data.coverImage.startsWith('/images/')) {
    const newImagePath = data.coverImage.replace('/images/', '');
    data.coverImage = `${IMAGE_BASE_URL}/${newImagePath}`;
    changed = true;
  }

  // 2. Update image links in content
  // Matches ![alt](/images/path/to/image.webp)
  const imageRegex = /!\[(.*?)\]\(\/images\/(.*?)\)/g;
  const newContent = content.replace(imageRegex, (match, alt, imgPath) => {
    changed = true;
    return `![${alt}](${IMAGE_BASE_URL}/${imgPath})`;
  });

  if (changed) {
    const updatedContent = restore({
      data: data,
      content: newContent,
    });
    fs.writeFileSync(filePath, updatedContent);
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
  }
}

async function main() {
  console.log('🚀 Starting migration to Cloudflare R2...');
  
  console.log('\n--- Step 1: Uploading images to R2 ---');
  await migrateImages(PUBLIC_IMAGES_DIS_OR_PATH(PUBLIC_IMAGES_DIR));

  console.log('\n--- Step 2: Updating Markdown files ---');
  await updateDir(CONTENT_POSTS_DIR);

  console.log('\n✨ Migration complete!');
}

// Helper to fix the initial call to migrateImages
function PUBLIC_IMAGES_DIS_OR_PATH(p) {
    return p;
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});