import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
const key = 42;

function encrypt(text: string): string {
  const buf = Buffer.from(text, 'utf-8');
  const encrypted = buf.map((b) => b ^ key);
  return Buffer.from(encrypted).toString('base64');
}
async function walk(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = await readdir(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      await walk(filePath, fileList);
    } else if (filePath.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function run() {
  const publicDir = join(import.meta.dir, '../public');
  console.log(`=== Starting obfuscation in ${publicDir} ===`);
  const files = await walk(publicDir);
  let processedCount = 0;

  for (const file of files) {
    let content = await Bun.file(file).text();
    let modified = false;
    // Obfuscate page-data
    // Match whatever Zola's minifier left behind: `type` may be
    // `application/json` (base.html) or `text/plain` (search_json.html), and
    // minify_html strips the quotes. The id is the only stable handle.
    const pageDataRegex = /<script\s+id=["']?page-data["']?[^>]*>([\s\S]*?)<\/script>/gi;
    content = content.replace(pageDataRegex, (match, p1) => {
      const trimmed = p1.trim();
      if (!trimmed || trimmed.startsWith('e:')) return match; // Already obfuscated or empty
      modified = true;
      return `<script id="page-data" type="text/plain">e:${encrypt(trimmed)}</script>`;
    });

    // Obfuscate search-data
    const searchDataRegex = /<script\s+id=["']?search-data["']?[^>]*>([\s\S]*?)<\/script>/gi;
    content = content.replace(searchDataRegex, (match, p1) => {
      const trimmed = p1.trim();
      if (!trimmed || trimmed.startsWith('e:')) return match; // Already obfuscated or empty
      modified = true;
      return `<script id="search-data" type="text/plain">e:${encrypt(trimmed)}</script>`;
    });
    if (modified) {
      await Bun.write(file, content);
      processedCount++;
    }
  }

  console.log(`=== Obfuscated ${processedCount} HTML files successfully ===`);
}

run().catch(console.error);
