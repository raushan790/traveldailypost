
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'content/posts/airline-news/2026/06/';

console.log(`🚀 Monitoring ${TARGET_DIR} for new blog files...`);

fs.watch(TARGET_DIR, (eventType, filename) => {
  if (eventType === 'rename' && filename && filename.endsWith('.md')) {
    if (fs.existsSync(path.join(TARGET_DIR, filename))) {
      console.log(`\n✅ FILE GENERATED: ${filename}`);
      console.log(`Location: ${path.join(TARGET_DIR, filename)}`);
      process.exit(0);
    }
  }
});
