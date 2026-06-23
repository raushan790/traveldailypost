import { Together } from 'together-ai';
import fs from 'fs';
import path from 'path';

const ROOT = '.';
// Load env
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(ROOT, envFile);
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const eq = t.indexOf('=');
        if (eq > 0) {
          const k = t.slice(0, eq).trim();
          const v = t.slice(eq + 1).trim().replace(/^"|"$/g, '');
          process.env[k] = process.env[k] || v;
        }
      }
    });
  }
}

async function listModels() {
  try {
    const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });
    const models = await together.models.list();
    console.log('Available Models:');
    models.forEach(m => {
      if (m.type === 'chat' || m.type === 'language') {
        console.log(`- ${m.id} (${m.type})`);
      }
    });
  } catch (err) {
    console.error('Error listing models:', err.message);
  }
}

listModels();
