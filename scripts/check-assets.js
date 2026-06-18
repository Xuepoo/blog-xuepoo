const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "../content/posts");
const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

let uncompressedCount = 0;

files.forEach((file) => {
  const content = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
  const tempImageRegex = /(?:\.\.\/\.\.\/static|\/static|)\/tmp\/raw\/images\/([^\s"'>)]+)/g;
  let match;
  let matches = [];
  while ((match = tempImageRegex.exec(content)) !== null) {
    matches.push(match[0]);
  }

  if (matches.length > 0) {
    console.log(`File: ${file} contains uncompressed images:`);
    matches.forEach((m) => {
      console.log(`  - ${m}`);
      uncompressedCount++;
    });
  }
});

if (uncompressedCount === 0) {
  console.log("All referenced images are correctly optimized and linked to CDN.");
} else {
  console.log(
    `Warning: Found ${uncompressedCount} raw image reference(s) to optimize before deploy.`,
  );
}
