const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

function loadArticlesFromFiles() {
  const articles = [];
  const contentDir = path.join(__dirname, '..', 'content', 'posts');

  if (!fs.existsSync(contentDir)) {
    console.warn('⚠️ content/posts directory not found');
    return articles;
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        walkDir(fullPath);
      } else if (file.name.endsWith('.md')) {
        try {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          const { data, content } = matter(fileContent);

          const article = {
            id: data.id ? parseInt(data.id, 10) : 0,
            slug: data.slug || file.name.replace('.md', ''),
            title: data.title || 'Untitled',
            category: data.category || 'travel-news',
            date: data.date,
            featured: data.featured || false,
            filePath: path.relative(path.join(__dirname, '..'), fullPath)
          };

          articles.push(article);
        } catch (err) {
          console.error(`❌ Error reading ${fullPath}:`, err);
        }
      }
    }
  }

  walkDir(contentDir);

  articles.sort((a, b) => b.id - a.id);
  return articles;
}

const loaded = loadArticlesFromFiles();
console.log(`Total articles loaded: ${loaded.length}`);
console.log('\nTop 15 articles by ID:');
loaded.slice(0, 15).forEach(a => {
  console.log(`ID: ${a.id} | Date: ${a.date} | Title: "${a.title}" | Path: ${a.filePath}`);
});
