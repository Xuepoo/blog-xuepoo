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
  const match = fileContent.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: fileContent };
  const fmRaw = match[1];
  const body = match[2];
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
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      fmRaw += `${key} = [${val.map((v) => `"${v}"`).join(", ")}]\n`;
    } else {
      fmRaw += `${key} = "${val}"\n`;
    }
  }
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
        .filter((f) => f.endsWith(".md"))
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
    const filename = req.headers["x-filename"] || `image-${Date.now()}.png`;
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

    /* Tabs select options */
    .view-tabs {
      display: flex;
      background: #fff;
      border: 1px solid #4a3e3d;
      border-radius: 4px;
      overflow: hidden;
    }
    .tab-item {
      padding: 5px 12px;
      font-size: 0.8rem;
      cursor: pointer;
      font-weight: bold;
      border: none;
      background: none;
      color: #4a3e3d;
      transition: all 0.15s ease;
      user-select: none;
    }
    .tab-item:not(:first-child) {
      border-left: 1px solid #4a3e3d;
    }
    .tab-item.active {
      background: #4a3e3d;
      color: #fff;
    }

    /* Editor workspace box */
    #workspace {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    /* View panes */
    .view-pane {
      display: none;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      box-sizing: border-box;
    }
    .view-pane.active {
      display: block;
    }

    /* Split view pane configuration */
    #view-split {
      display: none;
    }
    #view-split.active {
      display: flex;
      flex-direction: row;
    }
    .split-left {
      flex: 1;
      border-right: 1px solid #e0dcd3;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      height: 100%;
    }
    .split-right {
      flex: 1;
      padding: 2rem;
      background: #fff;
      overflow-y: auto;
      box-sizing: border-box;
      height: 100%;
    }

    /* Paper sheet layout for center content preview/typora mode */
    .paper-sheet {
      width: 92%;
      max-width: 820px;
      margin: 2rem auto;
      background: #fdfcf7;
      box-sizing: border-box;
    }

    /* Raw Text Mode Editor area */
    .raw-textarea {
      display: block;
      width: 92%;
      max-width: 820px;
      height: calc(100vh - 110px);
      margin: 1.5rem auto;
      box-sizing: border-box;
      font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 0.9rem;
      line-height: 1.6;
      border: 1px solid #e0dcd3;
      border-radius: 8px;
      padding: 1.5rem;
      background: #fff;
      resize: none;
      outline: none;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.03);
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
      min-height: 500px;
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

        <!-- Tabs selector -->
        <div class="view-tabs">
          <button class="tab-item active" onclick="switchView('typora')">Live</button>
          <button class="tab-item" onclick="switchView('split')">Split Screen</button>
          <button class="tab-item" onclick="switchView('raw')">Raw Source</button>
          <button class="tab-item" onclick="switchView('preview')">Preview</button>
        </div>

        <div class="toolbar-right">
          <div class="tip-text">Ctrl+V to paste image</div>
          <button class="btn btn-primary" onclick="saveActivePost()">Save</button>
          <button class="btn btn-danger" onclick="deleteActivePost()">Delete</button>
        </div>
      </div>

      <!-- Workspace views -->
      <div id="workspace">

        <!-- View: Typora (Interactive WYSIWYG) -->
        <div id="view-typora" class="view-pane active">
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
                  <input type="text" id="typora-title" class="meta-input" oninput="syncMetadataFieldsToRaw()">
                </div>
                <div class="meta-row">
                  <label>Date</label>
                  <input type="date" id="typora-date" class="meta-input" oninput="syncMetadataFieldsToRaw()">
                </div>
                <div class="meta-row">
                  <label>Tags</label>
                  <input type="text" id="typora-tags" class="meta-input" placeholder="e.g. Rust, DevOps" oninput="syncMetadataFieldsToRaw()">
                </div>
                <div class="meta-row">
                  <label>Description</label>
                  <input type="text" id="typora-desc" class="meta-input" oninput="syncMetadataFieldsToRaw()">
                </div>
              </div>
            </div>

            <!-- Body area -->
            <div id="typora-body-container" style="position:relative;">
              <div id="typora-body-view" class="typora-body-view zen-article-body" onclick="enterTyporaBodyEdit()">
                Click to write content here...
              </div>
              <textarea id="typora-body-editor" class="typora-body-editor" placeholder="Write markdown here..."></textarea>
              <button id="btn-typora-done" class="btn" style="display:none; position:absolute; bottom:15px; right:15px; z-index:20; opacity:0.85; box-shadow:0 2px 8px rgba(0,0,0,0.15);" onclick="exitTyporaBodyEdit()">✔ Done Editing</button>
            </div>

          </div>
        </div>

        <!-- View: Split Screen -->
        <div id="view-split" class="view-pane">
          <div class="split-left">
            <textarea id="split-editor-textarea" class="raw-textarea" style="width:100%; height:100%; margin:0;" oninput="syncRawToSplitAndPreview()"></textarea>
          </div>
          <div class="split-right zen-article-body" id="split-preview-element">
            <!-- Preview rendered HTML -->
          </div>
        </div>

        <!-- View: Raw Source -->
        <div id="view-raw" class="view-pane">
          <textarea id="raw-editor-textarea" class="raw-textarea" oninput="syncRawToSplitAndPreview()"></textarea>
        </div>

        <!-- View: Preview -->
        <div id="view-preview" class="view-pane">
          <div class="paper-sheet zen-article-body" id="preview-element" style="padding: 2.5rem; background:#fff; border: 1px solid #e0dcd3; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <!-- Preview rendered HTML -->
          </div>
        </div>

      </div>

    </main>

  </div>

  <script>
    let activePost = null;
    let rawContent = "";
    let activePostMetadata = {};
    let activePostBody = "";
    let isSidebarCollapsed = false;
    let activeView = "typora";

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

    // Tab pane switching logic
    function switchView(viewName) {
      activeView = viewName;

      const tabs = document.querySelectorAll('.tab-item');
      tabs.forEach(tab => tab.classList.remove('active'));

      let tabIdx = 0;
      if (viewName === 'typora') tabIdx = 0;
      else if (viewName === 'split') tabIdx = 1;
      else if (viewName === 'raw') tabIdx = 2;
      else if (viewName === 'preview') tabIdx = 3;
      tabs[tabIdx].classList.add('active');

      if (document.getElementById('typora-body-editor').style.display === 'block') {
        exitTyporaBodyEdit();
      }

      const panes = document.querySelectorAll('.view-pane');
      panes.forEach(pane => pane.classList.remove('active'));
      document.getElementById('view-' + viewName).classList.add('active');

      if (viewName === 'typora') {
        splitRawToMetadataAndBody();
        document.getElementById('typora-title').value = activePostMetadata.title || "";
        document.getElementById('typora-date').value = activePostMetadata.date || "";
        document.getElementById('typora-tags').value = (activePostMetadata.tags || []).join(", ");
        document.getElementById('typora-desc').value = activePostMetadata.description || "";

        renderTyporaBodyHtml(activePostBody);
        document.getElementById('typora-body-editor').value = activePostBody;
      } else if (viewName === 'split') {
        document.getElementById('split-editor-textarea').value = rawContent;
        renderHtmlPreview();
      } else if (viewName === 'raw') {
        document.getElementById('raw-editor-textarea').value = rawContent;
      } else if (viewName === 'preview') {
        renderHtmlPreview();
      }
    }

    // Load articles from backend API
    async function loadPosts() {
      try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        const container = document.getElementById('post-list');
        container.innerHTML = posts.map(p => \`
          <div class="post-item \${activePost === p.filename ? 'active' : ''}" onclick="selectPost('\${p.filename}')">
            <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${p.title}</strong>
            <div style="font-size:0.75rem;color:#857a70;margin-top:0.25rem;">📅 \${p.date}</div>
          </div>
        \`).join('');
      } catch (err) {
        console.error("Failed to load posts", err);
      }
    }

    // Select article post
    async function selectPost(filename) {
      activePost = filename;
      document.getElementById('active-filename-display').innerText = filename;

      const res = await fetch('/api/posts/' + encodeURIComponent(filename));
      const post = await res.json();

      rawContent = stringifyFrontmatter(post.frontmatter, post.body);
      activePostMetadata = post.frontmatter;
      activePostBody = post.body;

      switchView(activeView);
      loadPosts();
    }

    // Create a new file
    function createNewPost() {
      const filename = prompt('Enter filename (e.g. hello-world.md):');
      if (!filename) return;
      const cleanName = filename.endsWith('.md') ? filename : filename + '.md';
      activePost = cleanName;

      activePostMetadata = {
        title: "New Post Title",
        date: new Date().toISOString().split('T')[0],
        tags: ["draft"],
        description: "This is a new article draft."
      };
      activePostBody = "## New Section\\n\\nStart writing your content here...";
      rawContent = stringifyFrontmatter(activePostMetadata, activePostBody);

      saveActivePost();
    }

    // Import a local Markdown file
    async function importLocalPost() {
      const filePath = prompt('Enter absolute path to local Markdown file (e.g., /home/fuyu/Documents/my-doc.md):');
      if (!filePath) return;

      try {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath })
        });
        const data = await res.json();
        if (data.success) {
          activePost = data.filename;
          document.getElementById('active-filename-display').innerText = activePost;
          activePostMetadata = data.frontmatter;
          activePostBody = data.body;
          rawContent = stringifyFrontmatter(activePostMetadata, activePostBody);

          switchView(activeView);
          alert('Markdown file and its relative images imported successfully! Note: Imported content is kept in editor memory cache, click "Save" in the toolbar to save it to your blog directory.');
        } else {
          alert('Import failed: ' + data.error);
        }
      } catch (err) {
        alert('Import error: ' + err.message);
      }
    }

    // Save active post
    async function saveActivePost() {
      if (!activePost) return alert('No active article selected.');

      if (activeView === 'typora') {
        if (document.getElementById('typora-body-editor').style.display === 'block') {
          exitTyporaBodyEdit();
        }
        syncMetadataFieldsToRaw();
      } else if (activeView === 'split') {
        rawContent = document.getElementById('split-editor-textarea').value;
        splitRawToMetadataAndBody();
      } else if (activeView === 'raw') {
        rawContent = document.getElementById('raw-editor-textarea').value;
        splitRawToMetadataAndBody();
      }

      try {
        const payload = {
          frontmatter: activePostMetadata,
          body: activePostBody
        };
        const res = await fetch('/api/posts/' + encodeURIComponent(activePost), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          loadPosts();
          alert('Post saved successfully!');
        } else {
          alert('Save failed: ' + data.error);
        }
      } catch (err) {
        alert('Save error: ' + err.message);
      }
    }

    // Permanent delete post
    async function deleteActivePost() {
      if (!activePost) return alert('Please select a post to delete.');
      if (!confirm(\`Are you sure you want to permanently delete this post? This action cannot be undone!\\n\\nFile: \${activePost}\`)) return;

      try {
        const res = await fetch('/api/posts/' + encodeURIComponent(activePost), {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          activePost = null;
          rawContent = "";
          activePostBody = "";
          activePostMetadata = {};
          document.getElementById('active-filename-display').innerText = "No article selected";
          loadPosts();
          alert('Post deleted successfully!');
          switchView(activeView);
        } else {
          alert('Delete failed: ' + data.error);
        }
      } catch (err) {
        alert('Delete error: ' + err.message);
      }
    }

    // --- Parser & Sync Helpers ---

    function parseFrontmatter(fileContent) {
      const match = fileContent.match(/^\\+\\+\\+\\r?\\n([\\s\\S]*?)\\r?\\n\\+\\+\\+\\r?\\n([\\s\\S]*)$/);
      if (!match) return { frontmatter: {}, body: fileContent };
      const fmRaw = match[1];
      const body = match[2];
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
      for (const [key, val] of Object.entries(frontmatter)) {
        if (Array.isArray(val)) {
          fmRaw += \`\${key} = [\${val.map(v => \`"\${v}"\`).join(', ')}]\\n\`;
        } else {
          fmRaw += \`\${key} = "\${val}"\\n\`;
        }
      }
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

    function syncRawToSplitAndPreview() {
      if (activeView === 'split') {
        rawContent = document.getElementById('split-editor-textarea').value;
        renderHtmlPreview();
      } else if (activeView === 'raw') {
        rawContent = document.getElementById('raw-editor-textarea').value;
      }
      splitRawToMetadataAndBody();
    }

    function renderHtmlPreview() {
      const { frontmatter, body } = parseFrontmatter(rawContent);
      const htmlBody = marked.parse(body || "");

      const content = \`
        <h1>\${frontmatter.title || "Untitled Post"}</h1>
        <div style="font-size:0.85rem;color:#857a70;margin-bottom:1.5rem;border-bottom:1px solid #e0dcd3;padding-bottom:0.5rem;">
          📅 \${frontmatter.date || ""} &middot; 🏷️ \${(frontmatter.tags || []).join(', ')}
        </div>
        <div>\${htmlBody}</div>
      \`;

      if (activeView === 'split') {
        const el = document.getElementById('split-preview-element');
        el.innerHTML = content;
        if (window.renderMathInElement) {
          renderMathInElement(el, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\\\(', right: '\\\\)', display: false},
              {left: '\\\\[', right: '\\\\]', display: true}
            ],
            throwOnError: false
          });
        }
      } else if (activeView === 'preview') {
        const el = document.getElementById('preview-element');
        el.innerHTML = content;
        if (window.renderMathInElement) {
          renderMathInElement(el, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\\\(', right: '\\\\)', display: false},
              {left: '\\\\[', right: '\\\\]', display: true}
            ],
            throwOnError: false
          });
        }
      }
    }

    // --- Typora Mode Interactions ---

    function renderTyporaBodyHtml(bodyText) {
      const bodyView = document.getElementById('typora-body-view');
      if (!bodyText || bodyText.trim() === "") {
        bodyView.innerHTML = '<div style="color:#857a70;font-style:italic;text-align:center;padding:3rem 0;">No content. Click here to write markdown...</div>';
      } else {
        bodyView.innerHTML = marked.parse(bodyText);
      }
      if (window.renderMathInElement) {
        renderMathInElement(bodyView, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '\\\\[', right: '\\\\]', display: true}
          ],
          throwOnError: false
        });
      }
    }

    function autoResizeTextarea(textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight + 50) + 'px';
    }

    function enterTyporaBodyEdit() {
      const viewEl = document.getElementById('typora-body-view');
      const editorEl = document.getElementById('typora-body-editor');
      const doneBtn = document.getElementById('btn-typora-done');

      viewEl.style.display = 'none';
      editorEl.style.display = 'block';
      if (doneBtn) doneBtn.style.display = 'inline-flex';
      editorEl.value = activePostBody;
      autoResizeTextarea(editorEl);
      editorEl.focus();
    }

    function exitTyporaBodyEdit() {
      const viewEl = document.getElementById('typora-body-view');
      const editorEl = document.getElementById('typora-body-editor');
      const doneBtn = document.getElementById('btn-typora-done');

      activePostBody = editorEl.value;
      rawContent = stringifyFrontmatter(activePostMetadata, activePostBody);

      renderTyporaBodyHtml(activePostBody);

      editorEl.style.display = 'none';
      if (doneBtn) doneBtn.style.display = 'none';
      viewEl.style.display = 'block';
    }

    // --- Image pasting handle ---

    async function uploadPastedImage(file, textareaEl) {
      const placeholder = \`\\n![Uploading \${file.name}...]()\\n\`;
      const originalVal = textareaEl.value;
      const startPos = textareaEl.selectionStart;
      const endPos = textareaEl.selectionEnd;

      textareaEl.value = originalVal.substring(0, startPos) + placeholder + originalVal.substring(endPos);

      try {
        const res = await fetch('/api/images', {
          method: 'POST',
          headers: { 'x-filename': file.name },
          body: file
        });
        const data = await res.json();
        if (data.success) {
          const finalMarkdown = \`\\n![pasted-image](\${data.localPath})\\n\`;
          textareaEl.value = textareaEl.value.replace(placeholder, finalMarkdown);

          if (textareaEl.id === 'typora-body-editor') {
            activePostBody = textareaEl.value;
            rawContent = stringifyFrontmatter(activePostMetadata, activePostBody);
          } else if (textareaEl.id === 'split-editor-textarea' || textareaEl.id === 'raw-editor-textarea') {
            rawContent = textareaEl.value;
            splitRawToMetadataAndBody();
          }

          autoResizeTextarea(textareaEl);
        } else {
          alert('Upload failed: ' + data.error);
          textareaEl.value = textareaEl.value.replace(placeholder, '');
        }
      } catch (err) {
        alert('Upload connection error: ' + err.message);
        textareaEl.value = textareaEl.value.replace(placeholder, '');
      }
    }

    function setupPasteHooks() {
      const textareas = ['typora-body-editor', 'split-editor-textarea', 'raw-editor-textarea'];
      textareas.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('paste', async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
              if (item.kind === 'file' && item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                await uploadPastedImage(file, e.target);
              }
            }
          });

          if (id === 'typora-body-editor') {
            el.addEventListener('input', (e) => {
              autoResizeTextarea(e.target);
            });
          }
        }
      });
    }

    window.addEventListener('DOMContentLoaded', () => {
      loadPosts();
      setupPasteHooks();

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
