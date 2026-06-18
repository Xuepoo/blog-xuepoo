const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const POSTS_DIR = path.join(__dirname, "../content/posts");
const SYNC_SCRIPT = path.join(__dirname, "../../scripts/sync-assets.sh");

if (!fs.existsSync(POSTS_DIR)) return;

const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));

files.forEach((file) => {
  const filePath = path.join(POSTS_DIR, file);
  let content = fs.readFileSync(filePath, "utf-8");
  const tempImageRegex = /\/tmp\/raw\/images\/([^\s)]+)/g;
  let match;
  let matches = [];

  while ((match = tempImageRegex.exec(content)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length > 0) {
    const postSlug = file.replace(".md", "");
    console.log(`Optimizing images for post: ${postSlug}...`);
    let updatedContent = content;
    let hasFailed = false;

    matches.forEach((imgName) => {
      const imgLocalPath = path.join(__dirname, "../static/tmp/raw/images", imgName);
      if (!fs.existsSync(imgLocalPath)) {
        console.warn(`Local file ${imgLocalPath} not found!`);
        return;
      }

      // We create a single-item temp directory for sync-assets.sh to upload
      const tempDir = path.join(__dirname, `../tmp/raw-batch-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      fs.copyFileSync(imgLocalPath, path.join(tempDir, imgName));

      const r2Prefix = `blog/posts/${postSlug}`;
      console.log(`Running sync-assets.sh for ${imgName} to prefix ${r2Prefix}...`);

      try {
        const cmd = `${SYNC_SCRIPT} "${tempDir}" "${r2Prefix}" 85 cdn-xuepoo-xyz`;
        execSync(cmd, { stdio: "inherit" });

        // Rewrite Markdown link in content
        const baseNameWithoutExt = path.parse(imgName).name;
        const newUrl = `https://cdn.xuepoo.xyz/${r2Prefix}/${baseNameWithoutExt}.webp`;
        const oldRef = `/tmp/raw/images/${imgName}`;

        updatedContent = updatedContent.split(oldRef).join(newUrl);
        console.log(`Prepared link update: ${oldRef} -> ${newUrl}`);
      } catch (err) {
        console.error(`Failed to process image ${imgName}:`, err.message);
        hasFailed = true;
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    if (!hasFailed) {
      // Safe transactional replacement with backup
      const backupPath = filePath + ".bak";
      fs.copyFileSync(filePath, backupPath);
      fs.writeFileSync(filePath, updatedContent, "utf-8");
      fs.unlinkSync(backupPath);
      console.log(`Successfully updated links and saved file: ${file}`);
    } else {
      console.error(`Aborting updates for file ${file} due to R2 upload failures.`);
    }
  }
});
console.log("Asset optimization complete!");
