const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Load config from editor-config.json with default fallback
const CONFIG_FILE = path.join(__dirname, "../editor-config.json");
const DEFAULT_CONFIG = {
  apiPort: 8086,
  zolaPort: 8085,
  postsDir: "content/posts",
  staticDir: "static",
  imagesDir: "static/tmp/raw/images",
  webPathPrefix: "/tmp/raw/images",
};

let config = { ...DEFAULT_CONFIG };
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    config = { ...DEFAULT_CONFIG, ...userConfig };
  } catch (err) {
    console.error("Failed to parse editor-config.json, using defaults.", err);
  }
}

const PORT = config.apiPort;
const POSTS_DIR = path.resolve(__dirname, "..", config.postsDir);
const RAW_IMG_DIR = path.resolve(__dirname, "..", config.imagesDir);

// Ensure directories exist
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!fs.existsSync(RAW_IMG_DIR)) fs.mkdirSync(RAW_IMG_DIR, { recursive: true });

// Programmatically spawn zola serve as a child process to prevent background port leaks
// Bind to 0.0.0.0 to support remote dev forwarding
const zola = spawn("zola", ["serve", "-p", String(config.zolaPort), "-i", "0.0.0.0"], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});

zola.on("error", (err) => {
  console.error("Failed to start Zola server:", err);
});

// Clean up child process on exit
process.on("SIGINT", () => {
  zola.kill();
  process.exit();
});
process.on("SIGTERM", () => {
  zola.kill();
  process.exit();
});
process.on("exit", () => {
  zola.kill();
});

function isRelativeImagePath(url) {
  if (!url) return false;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("/")
  ) {
    return false;
  }
  return true;
}

function copyRelativeImageToTemp(baseDir, imgRelativePath) {
  try {
    const imgAbsPath = path.resolve(baseDir, imgRelativePath);
    if (fs.existsSync(imgAbsPath) && fs.statSync(imgAbsPath).isFile()) {
      const ext = path.extname(imgRelativePath);
      const uniqueName = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const destPath = path.join(RAW_IMG_DIR, uniqueName);

      fs.copyFileSync(imgAbsPath, destPath);
      console.log(`Successfully copied image from ${imgAbsPath} to ${destPath}`);
      return `/tmp/raw/images/${uniqueName}`;
    }
  } catch (err) {
    console.error("Failed to copy image:", imgRelativePath, err);
  }
  return null;
}

function processImportedMarkdown(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("File not found: " + filePath);
  }
  let content = fs.readFileSync(filePath, "utf-8");
  const baseDir = path.dirname(filePath);

  // 1. Match Markdown images: ![alt](url)
  content = content.replace(
    /(!\[[^\]]*?\]\()([^)]+?)(\))/g,
    (match, prefix, imgUrlAndTitle, suffix) => {
      const parts = imgUrlAndTitle.trim().split(/\s+/);
      let imgUrl = parts[0].replace(/^["']|["']$/g, "");

      if (isRelativeImagePath(imgUrl)) {
        const newUrl = copyRelativeImageToTemp(baseDir, imgUrl);
        if (newUrl) {
          const titlePart = parts.slice(1).join(" ");
          const newUrlAndTitle = titlePart ? `${newUrl} ${titlePart}` : newUrl;
          return `${prefix}${newUrlAndTitle}${suffix}`;
        }
      }
      return match;
    },
  );

  // 2. Match HTML image tags
  content = content.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/g,
    (match, beforeSrc, imgUrl, afterSrc) => {
      if (isRelativeImagePath(imgUrl)) {
        const newUrl = copyRelativeImageToTemp(baseDir, imgUrl);
        if (newUrl) {
          return `<img ${beforeSrc}src="${newUrl}"${afterSrc}>`;
        }
      }
      return match;
    },
  );

  return content;
}

function parseFrontmatter(fileContent) {
  const content = fileContent.trimStart();
  if (!content.startsWith("+++")) {
    return { frontmatter: {}, body: fileContent };
  }
  const secondPlusPlusPlusIndex = content.indexOf("+++", 3);
  if (secondPlusPlusPlusIndex === -1) {
    return { frontmatter: {}, body: fileContent };
  }
  const fmRaw = content.slice(3, secondPlusPlusPlusIndex).trim();
  let body = content.slice(secondPlusPlusPlusIndex + 3);
  if (body.startsWith("\r\n")) {
    body = body.slice(2);
  } else if (body.startsWith("\n")) {
    body = body.slice(1);
  }
  const frontmatter = {};

  // Simple TOML-like parser for key-value strings
  fmRaw.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join("=").trim().replace(/^"|"$/g, "");
      // Support array tags = ["A", "B"]
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val
          .substring(1, val.length - 1)
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);
      }
      frontmatter[key] = val;
    }
  });
  return { frontmatter, body };
}

function stringifyFrontmatter(frontmatter, body) {
  let fmRaw = "+++\n";
  let taxRaw = "";
  for (const [key, val] of Object.entries(frontmatter)) {
    if (key === "tags") {
      taxRaw += `[taxonomies]\ntags = [${val.map((v) => `"${v}"`).join(", ")}]\n`;
    } else if (Array.isArray(val)) {
      fmRaw += `${key} = [${val.map((v) => `"${v}"`).join(", ")}]\n`;
    } else {
      fmRaw += `${key} = "${val}"\n`;
    }
  }
  fmRaw += taxRaw;
  fmRaw += "+++\n";
  return fmRaw + body;
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-filename");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // --- Static Assets Mapping ---
  if (req.url === "/tmp/easymde.min.js") {
    const jsPath = path.resolve(__dirname, "..", config.staticDir, "tmp/easymde.min.js");
    if (fs.existsSync(jsPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(fs.readFileSync(jsPath));
      return;
    }
  }
  if (req.url === "/tmp/easymde.min.css") {
    const cssPath = path.resolve(__dirname, "..", config.staticDir, "tmp/easymde.min.css");
    if (fs.existsSync(cssPath)) {
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end(fs.readFileSync(cssPath));
      return;
    }
  }
  if (req.url === "/favicon.svg") {
    const faviconPath = path.resolve(__dirname, "..", config.staticDir, "favicon.svg");
    if (fs.existsSync(faviconPath)) {
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      res.end(fs.readFileSync(faviconPath));
      return;
    }
  }
  if (req.url === "/css/page.css") {
    const cssPath = path.resolve(__dirname, "..", config.staticDir, "css/page.css");
    if (fs.existsSync(cssPath)) {
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end(fs.readFileSync(cssPath));
      return;
    }
  }
  if (req.url === "/giallo-light.css") {
    const cssPath = path.resolve(__dirname, "..", config.staticDir, "giallo-light.css");
    if (fs.existsSync(cssPath)) {
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end(fs.readFileSync(cssPath));
      return;
    }
  }
  if (req.url === "/tmp/marked.min.js") {
    const jsPath = path.resolve(__dirname, "..", config.staticDir, "tmp/marked.min.js");
    if (fs.existsSync(jsPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(fs.readFileSync(jsPath));
      return;
    }
  }
  if (req.url.startsWith(config.webPathPrefix + "/")) {
    const filename = path.basename(req.url);
    const filePath = path.join(RAW_IMG_DIR, filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      else if (ext === ".gif") contentType = "image/gif";
      else if (ext === ".webp") contentType = "image/webp";
      else if (ext === ".svg") contentType = "image/svg+xml";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // --- API Router ---
  if (req.url === "/api/posts" && req.method === "GET") {
    fs.readdir(POSTS_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const posts = files
        .filter((f) => f.endsWith(".md") && f !== "_index.md")
        .map((f) => {
          const content = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
          const { frontmatter } = parseFrontmatter(content);
          return {
            filename: f,
            title: frontmatter.title || f,
            date: frontmatter.date || "",
            tags: frontmatter.tags || [],
          };
        });
      // Sort posts by date descending
      posts.sort((a, b) => b.date.localeCompare(a.date));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(posts));
    });
  } else if (req.url.startsWith("/api/posts/") && req.method === "GET") {
    const filename = decodeURIComponent(req.url.substring(11));
    const filePath = path.join(POSTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(fileContent);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ filename, frontmatter, body }));
  } else if (req.url.startsWith("/api/posts/") && req.method === "POST") {
    const filename = decodeURIComponent(req.url.substring(11));
    const filePath = path.join(POSTS_DIR, filename);
    let bodyData = "";
    req.on("data", (chunk) => {
      bodyData += chunk;
    });
    req.on("end", () => {
      try {
        const { frontmatter, body } = JSON.parse(bodyData);
        const fileContent = stringifyFrontmatter(frontmatter, body);
        fs.writeFileSync(filePath, fileContent, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON payload" }));
      }
    });
  } else if (req.url === "/api/import" && req.method === "POST") {
    let bodyData = "";
    req.on("data", (chunk) => {
      bodyData += chunk;
    });
    req.on("end", () => {
      try {
        const { filePath } = JSON.parse(bodyData);
        if (!filePath) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing filePath parameter" }));
          return;
        }
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "File not found: " + filePath }));
          return;
        }

        // Process Markdown and copy relative images
        const processedContent = processImportedMarkdown(filePath);
        const { frontmatter, body } = parseFrontmatter(processedContent);

        // Auto complement frontmatter metadata if missing
        if (!frontmatter.title) {
          frontmatter.title = path.basename(filePath, path.extname(filePath));
        }
        if (!frontmatter.date) {
          frontmatter.date = new Date().toISOString().split("T")[0];
        }
        if (!frontmatter.tags) {
          frontmatter.tags = ["imported"];
        }
        if (!frontmatter.description) {
          frontmatter.description = "Imported article from: " + filePath;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            filename: path.basename(filePath),
            frontmatter,
            body,
          }),
        );
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.url.startsWith("/api/posts/") && req.method === "DELETE") {
    const filename = decodeURIComponent(req.url.substring(11));
    const filePath = path.join(POSTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }
    try {
      fs.unlinkSync(filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === "/api/images" && req.method === "POST") {
    let chunks = [];
    let filename = req.headers["x-filename"] || `image-${Date.now()}.png`;

    // Make filename unique to prevent overwritten pasted images
    const ext = path.extname(filename) || ".png";
    const base = path.basename(filename, ext);
    if (
      base.toLowerCase() === "image" ||
      base.toLowerCase() === "blob" ||
      base.toLowerCase().startsWith("pasted-image")
    ) {
      filename = `pasted-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    } else {
      filename = `${base}-${Date.now()}${ext}`;
    }

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const filePath = path.join(RAW_IMG_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, localPath: `${config.webPathPrefix}/${filename}` }));
    });
  } else {
    // Serve HTML Editor UI directly for root request
    const uiHtml = getEditorHtml();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(uiHtml);
  }
});

function getEditorHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Zola Blog Editor</title>
  <!-- Load Zola original styles -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="stylesheet" href="/css/page.css">
  <link rel="stylesheet" href="/giallo-light.css">
  <!-- Load local markdown renderer -->
  <script src="/tmp/marked.min.js"></script>
  <!-- Load EasyMDE Editor -->
  <link rel="stylesheet" href="/tmp/easymde.min.css">
  <script src="/tmp/easymde.min.js"></script>
  <!-- Load KaTeX math library -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>

  <style>
    /* Global layout style referencing Obsidian & Typora classic look */
    body {
      font-family: 'Noto Sans SC', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      background: #fdfcf7; /* Premium paper texture color */
      color: #2c2c2a;
      display: flex;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    #app-container {
      display: flex;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    /* Left Sidebar: strictly occupies full 100vh vertical height */
    #sidebar {
      width: 280px;
      height: 100vh;
      border-right: 1px solid #e0dcd3;
      background: #f5f2eb; /* Sightly darker cream for subtle visual separation */
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 0.25s cubic-bezier(0.25, 1, 0.5, 1), margin-left 0.25s cubic-bezier(0.25, 1, 0.5, 1);
      box-sizing: border-box;
      z-index: 10;
      overflow: hidden;
    }
    #sidebar.collapsed {
      margin-left: -280px;
      border-right: none;
    }

    .sidebar-header {
      padding: 0 16px;
      height: 48px;
      border-bottom: 1px solid #e0dcd3;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .sidebar-title {
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #857a70;
    }
    .sidebar-actions {
      display: flex;
      gap: 6px;
    }

    .post-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-sizing: border-box;
    }

    .post-item {
      padding: 10px 12px;
      border: 1px solid #e0dcd3;
      border-radius: 6px;
      cursor: pointer;
      background: #fff;
      font-size: 0.85rem;
      transition: all 0.2s ease;
      line-height: 1.4;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .post-item:hover {
      border-color: #857a70;
      background: #faf6f0;
    }
    .post-item.active {
      border-color: #4a3e3d;
      background: #e0dcd3;
      font-weight: bold;
    }

    /* Right main content space */
    #main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: #fdfcf7;
    }

    /* Top Header Toolbar: Horizontal narrow bar aligned with sidebar header */
    #toolbar {
      height: 48px;
      background: #faf7f2;
      border-bottom: 1px solid #e0dcd3;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #active-filename-display {
      font-weight: 600;
      font-size: 0.9rem;
      color: #4a3e3d;
    }

    /* Buttons */
    .btn {
      cursor: pointer;
      padding: 5px 10px;
      border: 1px solid #4a3e3d;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: bold;
      background: #fff;
      color: #4a3e3d;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s ease;
      user-select: none;
    }
    .btn:hover {
      background: #e0dcd3;
    }
    .btn-primary {
      background: #34c759;
      color: white;
      border-color: #2ca349;
    }
    .btn-primary:hover {
      background: #2ca349;
    }
    .btn-danger {
      background: #ff3b30;
      color: white;
      border-color: #d62f26;
    }
    .btn-danger:hover {
      background: #d62f26;
    }

    /* Toggle sidebar button inside toolbar */
    #btn-toggle-sidebar {
      padding: 4px 8px;
      font-size: 0.9rem;
    }

    /* Editor workspace box */
    #workspace {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    /* Paper sheet layout for center content preview */
    .paper-sheet {
      width: 92%;
      max-width: 820px;
      margin: 2rem auto;
      background: #fdfcf7;
      box-sizing: border-box;
    }
    /* EasyMDE styling overrides to match the premium paper-sheet theme */
    .editor-toolbar {
      background: #faf6ef !important;
      border: 1px solid #e0dcd3 !important;
      border-radius: 4px 4px 0 0 !important;
      opacity: 0.9;
    }
    .editor-toolbar button {
      color: #3c3836 !important;
    }
    .editor-toolbar button.active, .editor-toolbar button:hover {
      background: #eee8d5 !important;
      border-color: #c9c3b5 !important;
    }
    .CodeMirror {
      background: #fdfcf7 !important;
      color: #2c2c2a !important;
      border: 1px solid #e0dcd3 !important;
      border-top: none !important;
      border-radius: 0 0 4px 4px !important;
      font-family: 'Noto Sans SC', system-ui, -apple-system, sans-serif !important;
      font-size: 1rem !important;
      line-height: 1.7 !important;
      min-height: 500px !important;
      box-shadow: none !important;
    }
    .CodeMirror-focused {
      border: 1px solid #4a3e3d !important;
      border-top: none !important;
    }
    .editor-preview {
      background: #fdfcf7 !important;
      font-family: 'Noto Sans SC', system-ui, -apple-system, sans-serif !important;
      line-height: 1.7 !important;
    }
    /* EasyMDE Fullscreen & Side-by-side Overrides to layer above sidebar */
    .editor-toolbar.fullscreen,
    .CodeMirror-fullscreen,
    .CodeMirror-sided,
    .editor-preview-active-side {
      z-index: 99999 !important;
    }
    /* Modern Custom Modal Dialog Styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(40, 40, 40, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    }
    .modal-card {
      background: #faf6ef;
      border: 1px solid #4a3e3d;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      width: 90%;
      max-width: 420px;
      padding: 1.5rem;
      box-sizing: border-box;
      animation: modalFadeIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes modalFadeIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .modal-title {
      margin-top: 0;
      margin-bottom: 0.75rem;
      font-weight: 600;
      font-size: 1.1rem;
      color: #3c3836;
      border-bottom: 1px solid #e0dcd3;
      padding-bottom: 0.5rem;
    }
    .modal-message {
      font-size: 0.9rem;
      color: #504945;
      line-height: 1.5;
      margin-bottom: 1.25rem;
      white-space: pre-line;
    }
    .modal-input-container {
      margin-bottom: 1.25rem;
    }
    .modal-input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid #c9c3b5;
      border-radius: 4px;
      background: #fdfcf7;
      color: #2c2c2a;
      outline: none;
      font-family: inherit;
    }
    .modal-input:focus {
      border-color: #4a3e3d;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    /* Modal buttons style override matching Zola client button standard */
    .modal-card .btn {
      padding: 6px 16px;
      font-size: 0.85rem;
      border: 1px solid #c9c3b5;
      cursor: pointer;
    }
    .modal-card .btn-primary {
      background: #4a3e3d;
      color: #fff;
      border-color: #4a3e3d;
    }

    /* Metadata container inside Typora mode */
    .typora-metadata-container {
      background: rgba(74, 62, 61, 0.03);
      border: 1px dashed #e0dcd3;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 2rem;
      font-size: 0.85rem;
    }
    .typora-metadata-header {
      font-weight: bold;
      color: #857a70;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .metadata-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .meta-row label {
      width: 90px;
      color: #857a70;
      font-weight: bold;
    }
    .meta-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #e0dcd3;
      border-radius: 4px;
      background: #fff;
      outline: none;
      font-size: 0.85rem;
    }
    .meta-input:focus {
      border-color: #4a3e3d;
    }

    /* Interactive body rendering styles (Typora look) */
    .typora-body-view {
      min-height: max(500px, calc(100vh - 300px));
      outline: none;
      padding: 12px;
      cursor: text;
      border: 1px solid transparent;
      border-radius: 6px;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }
    .typora-body-view:hover {
      border-color: #e0dcd3;
    }
    .typora-body-editor {
      width: 100%;
      min-height: 500px;
      font-family: inherit;
      font-size: 1.05rem;
      line-height: 1.75;
      color: inherit;
      background: transparent;
      border: none;
      resize: none;
      outline: none;
      padding: 12px;
      box-sizing: border-box;
      overflow: hidden;
      display: none;
    }
    .typora-block {
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 6px 12px;
      margin: 4px 0;
      position: relative;
      transition: background-color 0.15s ease, border-color 0.15s ease;
      cursor: text;
    }
    .typora-block:hover {
      background-color: rgba(240, 237, 230, 0.35);
      border-color: rgba(224, 220, 211, 0.6);
    }
    .typora-block.editing {
      background-color: rgba(240, 237, 230, 0.45);
      border-color: #c9c3b5;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .typora-block-editor {
      width: 100%;
      min-height: 40px;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      color: inherit;
      background: transparent;
      border: none;
      resize: none;
      outline: none;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
      display: none;
    }

    .tip-text {
      font-size: 0.75rem;
      color: #857a70;
    }

    /* Scrollbars design for modern look */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #d5cfc5;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #a8a094;
    }

    /* Tabs Bar Styles */
    #tabs-bar {
      display: flex;
      background: #f5f2eb;
      border-bottom: 1px solid #e0dcd3;
      padding: 6px 16px 0;
      gap: 4px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .editor-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: #e8e4da;
      border: 1px solid #d5cfc5;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      font-size: 0.8rem;
      color: #7c6f64;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      max-width: 180px;
    }
    .editor-tab:hover {
      background: #faf7f2;
      color: #3c3836;
    }
    .editor-tab.active {
      background: #fdfcf7;
      border-color: #e0dcd3;
      border-bottom: 1px solid #fdfcf7;
      color: #2c2c2a;
      font-weight: 600;
      margin-bottom: -1px;
      z-index: 2;
    }
    .tab-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tab-close {
      font-size: 0.75rem;
      color: #a89984;
      border-radius: 50%;
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .tab-close:hover {
      background: #d5cfc5;
      color: #3c3836;
    }
    .tab-dirty-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #ff3b30;
      border-radius: 50%;
      flex-shrink: 0;
    }
  </style>
</head>
<body>

  <div id="app-container">

    <!-- Left Sidebar -->
    <aside id="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Articles</span>
        <div class="sidebar-actions">
          <button class="btn" style="padding: 2px 6px; font-size: 0.7rem;" onclick="createNewPost()" title="New Post">New</button>
          <button class="btn" style="padding: 2px 6px; font-size: 0.7rem;" onclick="importLocalPost()" title="Import Post">Import</button>
        </div>
      </div>
      <div id="post-list" class="post-list">
        Loading...
      </div>
    </aside>

    <!-- Right Content Area -->
    <main id="main-content">

      <!-- Top header toolbar -->
      <div id="toolbar">
        <div class="toolbar-left">
          <button class="btn" onclick="toggleSidebar()" id="btn-toggle-sidebar">
            ☰ Toggle Sidebar
          </button>
          <div id="active-filename-display">
            No article selected
          </div>
        </div>



        <div class="toolbar-right">
          <div class="tip-text">Ctrl+V to paste image</div>
          <button class="btn btn-primary" onclick="saveActivePost()">Save</button>
          <button class="btn btn-danger" onclick="deleteActivePost()">Delete</button>
        </div>
      </div>

      <!-- Open Tabs Bar -->
      <div id="tabs-bar" style="display: none;"></div>

      <div id="workspace">

        <!-- View: No Post Selected Placeholder -->
        <div id="view-no-post" style="display: flex; align-items: center; justify-content: center; height: 60vh; text-align: center; font-family: inherit;">
          <div style="background: #faf6ef; border: 2px solid #e0dcd3; border-radius: 8px; padding: 3rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 450px; margin: auto;">
            <div style="font-size: 3rem; margin-bottom: 1.5rem;">✍️</div>
            <h3 style="margin-top: 0; color: #3c3836; font-size: 1.25rem;">No Article Selected</h3>
            <p style="color: #7c6f64; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.5rem;">
              Select an article from the left sidebar to start editing, or create a brand new post.
            </p>
            <button class="btn btn-primary" onclick="createNewPost()">+ Create New Post</button>
          </div>
        </div>

        <!-- View: Typora (Interactive WYSIWYG) -->
        <div id="view-typora" style="display: none; width: 100%; height: 100%; overflow-y: auto; box-sizing: border-box;">
          <div class="paper-sheet">

            <!-- Metadata Panel -->
            <div class="typora-metadata-container">
              <div class="typora-metadata-header" onclick="toggleMetadataForm()">
                <span>⚙️ Metadata Config (TOML Frontmatter)</span>
                <span id="meta-expand-indicator">[-]</span>
              </div>
              <div id="typora-metadata-form" class="metadata-form">
                <div class="meta-row">
                  <label>Title</label>
                  <input type="text" id="typora-title" class="meta-input" oninput="onMetadataInput()">
                </div>
                <div class="meta-row">
                  <label>Date</label>
                  <input type="date" id="typora-date" class="meta-input" oninput="onMetadataInput()">
                </div>
                <div class="meta-row">
                  <label>Tags</label>
                  <input type="text" id="typora-tags" class="meta-input" placeholder="e.g. Rust, DevOps" oninput="onMetadataInput()">
                </div>
                <div class="meta-row">
                  <label>Description</label>
                  <input type="text" id="typora-desc" class="meta-input" oninput="onMetadataInput()">
                </div>
              </div>
            </div>

            <!-- Body area -->
            <div id="typora-body-container" style="position:relative; margin-top: 1.5rem;">
              <textarea id="typora-body-editor" placeholder="Write markdown here..."></textarea>
            </div>

          </div>
        </div>

        <!-- Modern Custom Modal Backdrop -->
        <div id="custom-modal" class="modal-backdrop" style="display: none;">
          <div class="modal-card">
            <h4 id="modal-title" class="modal-title">Prompt</h4>
            <p id="modal-message" class="modal-message">Enter filename:</p>
            <div id="modal-input-container" class="modal-input-container">
              <input type="text" id="modal-input" class="modal-input">
            </div>
            <div class="modal-actions">
              <button id="btn-modal-cancel" class="btn">Cancel</button>
              <button id="btn-modal-ok" class="btn btn-primary">OK</button>
            </div>
          </div>
        </div>

        <!-- Hidden input for MD file import -->
        <input type="file" id="import-file-input" accept=".md" style="display: none;">
      </div>

    </main>

  </div>

  <script>
    let openTabs = {};
    let activePost = null;
    let rawContent = "";
    let activePostMetadata = {};
    let activePostBody = "";
    let isSidebarCollapsed = false;
    let easyMde = null;

    marked.setOptions({
      breaks: true,
      headerIds: true,
      gfm: true
    });

    // Toggle Left Sidebar
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const toggleBtn = document.getElementById('btn-toggle-sidebar');
      isSidebarCollapsed = !isSidebarCollapsed;
      if (isSidebarCollapsed) {
        sidebar.classList.add('collapsed');
        toggleBtn.innerText = "☰ Show Sidebar";
      } else {
        sidebar.classList.remove('collapsed');
        toggleBtn.innerText = "☰ Toggle Sidebar";
      }
    }

    // Toggle Metadata panel
    function toggleMetadataForm() {
      const form = document.getElementById('typora-metadata-form');
      const ind = document.getElementById('meta-expand-indicator');
      if (form.style.display === 'none') {
        form.style.display = 'flex';
        ind.innerText = "[-]";
      } else {
        form.style.display = 'none';
        ind.innerText = "[+]";
      }
    }

    // --- Custom Modern Promise-based Dialog Modals ---
    function showModal({ title, message, showInput = false, defaultValue = "" }) {
      return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const inputContainer = document.getElementById('modal-input-container');
        const inputEl = document.getElementById('modal-input');
        const btnCancel = document.getElementById('btn-modal-cancel');
        const btnOk = document.getElementById('btn-modal-ok');

        titleEl.innerText = title;
        messageEl.innerText = message;

        if (showInput) {
          inputContainer.style.display = 'block';
          inputEl.value = defaultValue;
          setTimeout(() => inputEl.focus(), 50);
        } else {
          inputContainer.style.display = 'none';
        }

        if (title === 'Alert') {
          btnCancel.style.display = 'none';
        } else {
          btnCancel.style.display = 'inline-block';
        }

        modal.style.display = 'flex';

        function cleanup() {
          modal.style.display = 'none';
          btnOk.onclick = null;
          btnCancel.onclick = null;
          inputEl.onkeydown = null;
        }

        btnOk.onclick = () => {
          const val = showInput ? inputEl.value : true;
          cleanup();
          resolve(val);
        };

        btnCancel.onclick = () => {
          cleanup();
          resolve(showInput ? null : false);
        };

        inputEl.onkeydown = (e) => {
          if (e.key === 'Enter') {
            btnOk.click();
          } else if (e.key === 'Escape') {
            btnCancel.click();
          }
        };
      });
    }

    function showCustomAlert(msg) {
      return showModal({ title: 'Alert', message: msg, showInput: false });
    }

    function showCustomConfirm(msg) {
      return showModal({ title: 'Confirm Action', message: msg, showInput: false });
    }

    function showCustomPrompt(msg, defVal = "") {
      return showModal({ title: 'Input Required', message: msg, showInput: true, defaultValue: defVal });
    }

    // Load articles from backend API
    async function loadPosts() {
      try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        const container = document.getElementById('post-list');
        container.innerHTML = posts.map(function(p) {
          const isActive = activePost === p.filename;
          const isDirty = openTabs[p.filename] && openTabs[p.filename].isDirty;
          const dirtyIndicator = isDirty ? ' <span style="display:inline-block;width:6px;height:6px;background:#ff3b30;border-radius:50%;margin-left:4px;"></span>' : '';
          return '<div class="post-item ' + (isActive ? 'active' : '') + '" onclick="selectPost(&apos;' + p.filename + '&apos;)">' +
            '<strong style="display:flex;align-items:center;justify-content:space-between;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + p.title + '</span>' +
              dirtyIndicator +
            '</strong>' +
            '<div style="font-size:0.75rem;color:#857a70;margin-top:0.25rem;">📅 ' + p.date + '</div>' +
          '</div>';
        }).join('');

        if (!activePost && posts.length > 0) {
          selectPost(posts[0].filename);
        } else if (!activePost) {
          document.getElementById('view-typora').style.display = 'none';
          document.getElementById('view-no-post').style.display = 'flex';
        }
      } catch (err) {
        console.error("Failed to load posts", err);
      }
    }

    // Select article post
    async function selectPost(filename) {
      await openTab(filename);
    }

    // Obsidian-style Tab operations
    async function openTab(filename) {
      // If switching tabs, sync current fields to the old active tab first
      if (activePost && openTabs[activePost]) {
        syncMetadataAndBodyToTab(activePost);
      }

      activePost = filename;
      document.getElementById('active-filename-display').innerText = filename;

      // If the tab is not in memory, fetch it from server
      if (!openTabs[filename]) {
        const res = await fetch('/api/posts/' + encodeURIComponent(filename));
        if (res.status === 200) {
          const post = await res.json();
          openTabs[filename] = {
            filename: filename,
            frontmatter: post.frontmatter || {},
            body: post.body || "",
            isDirty: false
          };
        } else {
          // If server failed (e.g. newly created draft not on server yet)
          openTabs[filename] = {
            filename: filename,
            frontmatter: { title: filename.replace(/\\.md$/, ""), date: new Date().toISOString().split('T')[0], tags: [], description: "" },
            body: "",
            isDirty: true
          };
        }
      }

      const tabData = openTabs[filename];
      activePostMetadata = tabData.frontmatter;
      activePostBody = tabData.body;

      document.getElementById('typora-title').value = activePostMetadata.title || "";
      document.getElementById('typora-date').value = activePostMetadata.date || "";
      document.getElementById('typora-tags').value = (activePostMetadata.tags || []).join(", ");
      document.getElementById('typora-desc').value = activePostMetadata.description || "";

      if (easyMde) {
        easyMde.codemirror.off("change", onEasyMdeChange);
        easyMde.value(activePostBody || "");
        easyMde.codemirror.on("change", onEasyMdeChange);
      }

      document.getElementById('view-typora').style.display = 'block';
      document.getElementById('view-no-post').style.display = 'none';

      renderTabs();
      loadPosts();

      if (easyMde && easyMde.codemirror) {
        setTimeout(() => {
          easyMde.codemirror.refresh();
        }, 50);
      }
    }

    function syncMetadataAndBodyToTab(filename) {
      if (!openTabs[filename]) return;
      openTabs[filename].frontmatter.title = document.getElementById('typora-title').value;
      openTabs[filename].frontmatter.date = document.getElementById('typora-date').value;
      openTabs[filename].frontmatter.tags = document.getElementById('typora-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      openTabs[filename].frontmatter.description = document.getElementById('typora-desc').value;
      if (easyMde) {
        openTabs[filename].body = easyMde.value();
      }
    }

    function onMetadataInput() {
      if (!activePost || !openTabs[activePost]) return;
      syncMetadataAndBodyToTab(activePost);
      if (!openTabs[activePost].isDirty) {
        openTabs[activePost].isDirty = true;
        renderTabs();
        loadPosts();
      }
    }

    function onEasyMdeChange() {
      if (!activePost || !openTabs[activePost]) return;
      const currentVal = easyMde.value();
      if (openTabs[activePost].body !== currentVal) {
        openTabs[activePost].body = currentVal;
        if (!openTabs[activePost].isDirty) {
          openTabs[activePost].isDirty = true;
          renderTabs();
          loadPosts();
        }
      }
    }

    function renderTabs() {
      const bar = document.getElementById('tabs-bar');
      const keys = Object.keys(openTabs);
      if (keys.length === 0) {
        bar.style.display = 'none';
        return;
      }
      bar.style.display = 'flex';
      bar.innerHTML = keys.map(filename => {
        const tab = openTabs[filename];
        const isActive = filename === activePost;
        const displayTitle = tab.frontmatter.title || filename;
        const dirtyDot = tab.isDirty ? '<span class="tab-dirty-dot" title="Unsaved changes"></span>' : '';
        return '<div class="editor-tab ' + (isActive ? 'active' : '') + '" onclick="openTab(&apos;' + filename + '&apos;)">' +
          dirtyDot +
          '<span class="tab-title" title="' + filename + '">' + displayTitle + '</span>' +
          '<span class="tab-close" onclick="closeTab(&apos;' + filename + '&apos;, event)">×</span>' +
        '</div>';
      }).join('');
    }

    async function closeTab(filename, event) {
      if (event) event.stopPropagation();
      const tab = openTabs[filename];
      if (!tab) return;

      if (tab.isDirty) {
        const title = tab.frontmatter.title || filename;
        if (!await showCustomConfirm('Discard unsaved changes for "' + title + '"?')) {
          return;
        }
      }

      delete openTabs[filename];

      if (activePost === filename) {
        const remaining = Object.keys(openTabs);
        if (remaining.length > 0) {
          await openTab(remaining[remaining.length - 1]);
        } else {
          activePost = null;
          document.getElementById('active-filename-display').innerText = "No article selected";
          document.getElementById('view-typora').style.display = 'none';
          document.getElementById('view-no-post').style.display = 'flex';
        }
      }

      renderTabs();
      loadPosts();
    }

    // Create a new file
    async function createNewPost() {
      const filename = await showCustomPrompt('Enter filename (e.g. hello-world.md):');
      if (!filename) return;
      const cleanName = filename.endsWith('.md') ? filename : filename + '.md';

      const res = await fetch('/api/posts');
      const posts = await res.json();
      const exists = posts.some(p => p.filename.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        await showCustomAlert('A post with filename "' + cleanName + '" already exists.');
        return;
      }

      openTabs[cleanName] = {
        filename: cleanName,
        frontmatter: {
          title: "New Post Title",
          date: new Date().toISOString().split('T')[0],
          tags: ["draft"],
          description: "This is a new article draft."
        },
        body: "## New Section\\n\\nStart writing your content here...",
        isDirty: true
      };

      await openTab(cleanName);
    }

    // Import a local Markdown file
    function importLocalPost() {
      document.getElementById('import-file-input').click();
    }

    // Save active post
    async function saveActivePost() {
      if (!activePost) return showCustomAlert('No active article selected.');

      syncMetadataAndBodyToTab(activePost);
      const tabData = openTabs[activePost];

      try {
        const payload = {
          frontmatter: tabData.frontmatter,
          body: tabData.body
        };
        const res = await fetch('/api/posts/' + encodeURIComponent(activePost), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          tabData.isDirty = false;
          renderTabs();
          loadPosts();
          await showCustomAlert('Post saved successfully!');
        } else {
          await showCustomAlert('Save failed: ' + data.error);
        }
      } catch (err) {
        await showCustomAlert('Save error: ' + err.message);
      }
    }

    // Permanent delete post
    async function deleteActivePost() {
      if (!activePost) return showCustomAlert('Please select a post to delete.');
      if (!await showCustomConfirm('Are you sure you want to permanently delete this post? This action cannot be undone!\\n\\nFile: ' + activePost)) return;

      try {
        const res = await fetch('/api/posts/' + encodeURIComponent(activePost), {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          const deletedFile = activePost;
          delete openTabs[deletedFile];

          activePost = null;
          document.getElementById('active-filename-display').innerText = "No article selected";

          if (easyMde) {
            easyMde.value("");
          }

          const remaining = Object.keys(openTabs);
          if (remaining.length > 0) {
            await openTab(remaining[remaining.length - 1]);
          } else {
            document.getElementById('view-typora').style.display = 'none';
            document.getElementById('view-no-post').style.display = 'flex';
          }

          loadPosts();
          await showCustomAlert('Post deleted successfully!');
        } else {
          await showCustomAlert('Delete failed: ' + data.error);
        }
      } catch (err) {
        await showCustomAlert('Delete error: ' + err.message);
      }
    }

    // --- Parser & Sync Helpers ---

    function parseFrontmatter(fileContent) {
      const content = fileContent.trimStart();
      if (!content.startsWith('+++')) {
        return { frontmatter: {}, body: fileContent };
      }
      const secondPlusPlusPlusIndex = content.indexOf('+++', 3);
      if (secondPlusPlusPlusIndex === -1) {
        return { frontmatter: {}, body: fileContent };
      }
      const fmRaw = content.slice(3, secondPlusPlusPlusIndex).trim();
      let body = content.slice(secondPlusPlusPlusIndex + 3);
      if (body.startsWith('\\r\\n')) {
        body = body.slice(2);
      } else if (body.startsWith('\\n')) {
        body = body.slice(1);
      }
      const frontmatter = {};

      fmRaw.split('\\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
          if (val.startsWith('[') && val.endsWith(']')) {
            val = val.substring(1, val.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
          }
          frontmatter[key] = val;
        }
      });
      return { frontmatter, body };
    }

    function stringifyFrontmatter(frontmatter, body) {
      let fmRaw = "+++\\n";
      let taxRaw = "";
      for (const [key, val] of Object.entries(frontmatter)) {
        if (key === 'tags') {
          taxRaw += "[taxonomies]\\ntags = [" + val.map(v => '"' + v + '"').join(', ') + "]\\n";
        } else if (Array.isArray(val)) {
          fmRaw += key + " = [" + val.map(v => '"' + v + '"').join(', ') + "]\\n";
        } else {
          fmRaw += key + ' = "' + val + '"\\n';
        }
      }
      fmRaw += taxRaw;
      fmRaw += "+++\\n";
      return fmRaw + body;
    }

    function splitRawToMetadataAndBody() {
      const { frontmatter, body } = parseFrontmatter(rawContent);
      activePostMetadata = frontmatter;
      activePostBody = body;
    }

    function syncMetadataFieldsToRaw() {
      activePostMetadata.title = document.getElementById('typora-title').value;
      activePostMetadata.date = document.getElementById('typora-date').value;
      activePostMetadata.tags = document.getElementById('typora-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      activePostMetadata.description = document.getElementById('typora-desc').value;

      rawContent = stringifyFrontmatter(activePostMetadata, activePostBody);
    }

    // --- EasyMDE Integration ---

    function initEasyMDE() {
      const el = document.getElementById('typora-body-editor');
      if (!el) return;

      easyMde = new EasyMDE({
        element: el,
        spellChecker: false,
        autosave: {
          enabled: false
        },
        status: false,
        renderingConfig: {
          singleLineBreaks: false,
          codeSyntaxHighlighting: true
        },
        toolbar: [
          "bold", "italic", "heading", "|",
          "quote", "unordered-list", "ordered-list", "|",
          "link", "image", "table", "|",
          "preview", "side-by-side", "fullscreen", "|",
          "guide"
        ],
        placeholder: "Write markdown here...",
        minHeight: "500px",
        previewRender: function(plainText, preview) {
          setTimeout(() => {
            if (typeof renderMathInElement === 'function') {
              renderMathInElement(preview, {
                delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '$', right: '$', display: false},
                  {left: '\\\\(', right: '\\\\)', display: false},
                  {left: '\\\\[', right: '\\\\]', display: true}
                ],
                throwOnError: false
              });
            }
          }, 10);
          return marked.parse(plainText);
        }
      });

      // EasyMDE change hook
      easyMde.codemirror.on("change", onEasyMdeChange);

      // Intercept paste event in capture phase to run before EasyMDE/CodeMirror handlers
      easyMde.codemirror.getWrapperElement().addEventListener("paste", async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        if (!items) return;

        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
            imageFile = items[i].getAsFile();
            break;
          }
        }

        if (imageFile) {
          e.preventDefault();
          e.stopPropagation(); // Prevent EasyMDE from parsing text/html and pasting duplicate markdown
          await uploadPastedImageEasyMDE(imageFile, easyMde.codemirror);
        }
      }, true);
    }

    async function uploadPastedImageEasyMDE(file, cm) {
      const placeholder = "![Uploading " + file.name + "...]()";
      const doc = cm.getDoc();

      // Replace active selection directly to substitute highlighted text
      const from = doc.getCursor("from");
      const to = doc.getCursor("to");
      doc.replaceRange(placeholder, from, to);

      try {
        const res = await fetch('/api/images', {
          method: 'POST',
          headers: { 'x-filename': file.name },
          body: file
        });
        const data = await res.json();
        if (data.success) {
          const finalMarkdown = "![pasted-image](" + data.localPath + ")";

          // Locate the unique placeholder inside document lines and replace in-place
          var lineCount = doc.lineCount();
          var foundLine = -1;
          var foundCh = -1;
          for (var i = 0; i < lineCount; i++) {
            var lineText = doc.getLine(i);
            var idx = lineText.indexOf(placeholder);
            if (idx !== -1) {
              foundLine = i;
              foundCh = idx;
              break;
            }
          }

          if (foundLine !== -1) {
            doc.replaceRange(finalMarkdown, { line: foundLine, ch: foundCh }, { line: foundLine, ch: foundCh + placeholder.length });
          } else {
            // Placeholder not found (possibly overwritten). Insert at current cursor.
            const cursor = doc.getCursor();
            doc.replaceRange(finalMarkdown, cursor);
          }

          activePostBody = easyMde.value();
          if (activePost && openTabs[activePost]) {
            openTabs[activePost].body = activePostBody;
            if (!openTabs[activePost].isDirty) {
              openTabs[activePost].isDirty = true;
              renderTabs();
              loadPosts();
            }
          }
          rawContent = stringifyFrontmatter(activePostMetadata, activePostBody);
        } else {
          await showCustomAlert('Upload failed: ' + data.error);

          // Clean placeholder
          var lineCount = doc.lineCount();
          var foundLine = -1;
          var foundCh = -1;
          for (var i = 0; i < lineCount; i++) {
            var lineText = doc.getLine(i);
            var idx = lineText.indexOf(placeholder);
            if (idx !== -1) {
              foundLine = i;
              foundCh = idx;
              break;
            }
          }

          if (foundLine !== -1) {
            doc.replaceRange("", { line: foundLine, ch: foundCh }, { line: foundLine, ch: foundCh + placeholder.length });
          } else {
            const scrollInfo = cm.getScrollInfo();
            const cursor = doc.getCursor();
            const content = doc.getValue();
            doc.setValue(content.replace(placeholder, ''));
            doc.setCursor(cursor);
            cm.scrollTo(scrollInfo.left, scrollInfo.top);
          }
        }
      } catch (err) {
        await showCustomAlert('Upload connection error: ' + err.message);

        // Clean placeholder
        var lineCount = doc.lineCount();
        var foundLine = -1;
        var foundCh = -1;
        for (var i = 0; i < lineCount; i++) {
          var lineText = doc.getLine(i);
          var idx = lineText.indexOf(placeholder);
          if (idx !== -1) {
            foundLine = i;
            foundCh = idx;
            break;
          }
        }

        if (foundLine !== -1) {
          doc.replaceRange("", { line: foundLine, ch: foundCh }, { line: foundLine, ch: foundCh + placeholder.length });
        } else {
          const scrollInfo = cm.getScrollInfo();
          const cursor = doc.getCursor();
          const content = doc.getValue();
          doc.setValue(content.replace(placeholder, ''));
          doc.setCursor(cursor);
          cm.scrollTo(scrollInfo.left, scrollInfo.top);
        }
      }
    }

    function setupPasteHooks() {
      // No extra textareas to attach paste hooks since we only keep EasyMDE Typora Live view
    }

    window.addEventListener('DOMContentLoaded', () => {
      initEasyMDE();
      loadPosts();

      // Bind file import change listener
      const fileInput = document.getElementById('import-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (evt) => {
            const fileContent = evt.target.result;
            const { frontmatter, body } = parseFrontmatter(fileContent);

            const filename = file.name;
            openTabs[filename] = {
              filename: filename,
              frontmatter: frontmatter || {},
              body: body || "",
              isDirty: true
            };

            await openTab(filename);

            // Reset input
            fileInput.value = '';

            await showCustomAlert('Markdown file imported successfully! Click "Save" in the toolbar to save it to your blog directory.');
          };
          reader.readAsText(file);
        });
      }

      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          saveActivePost();
        }
      });
    });
  </script>
</body>
</html>`;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dev API Server running at http://0.0.0.0:${PORT}`);
});
