const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 8086;
const POSTS_DIR = path.join(__dirname, "../content/posts");
const RAW_IMG_DIR = path.join(__dirname, "../static/tmp/raw/images");

// Ensure directories exist
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!fs.existsSync(RAW_IMG_DIR)) fs.mkdirSync(RAW_IMG_DIR, { recursive: true });

// Programmatically spawn zola serve as a child process to prevent background port leaks
const zola = spawn("zola", ["serve", "-p", "8085"], {
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
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val
          .substring(1, val.length - 1)
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""));
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Router
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
  } else if (req.url === "/api/images" && req.method === "POST") {
    // Save image binary upload
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
      res.end(JSON.stringify({ success: true, localPath: `/tmp/raw/images/${filename}` }));
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
<html>
<head>
  <meta charset="utf-8">
  <title>Blog Editor Mode</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #f0eee6; display: flex; height: 100vh; overflow: hidden; }
    #sidebar { width: 260px; border-right: 1px solid #d1d1d6; background: #fff; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; flex-shrink: 0; }
    #sidebar h3 { margin: 0; font-size: 1rem; color: #86868b; text-transform: uppercase; }
    .post-item { padding: 0.5rem; border: 1px solid #d1d1d6; border-radius: 6px; cursor: pointer; background: #f5f5f7; font-size: 0.85rem; }
    .post-item.active { border-color: #0071e3; background: #e8f4fd; }
    #editor-area { flex: 1.2; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; border-right: 1px solid #d1d1d6; }
    #preview-area { flex: 1; padding: 1.5rem; background: #fff; overflow-y: auto; }
    .mock-input { width: 100%; padding: 0.5rem; box-sizing: border-box; border: 1px solid #d1d1d6; border-radius: 6px; }
    textarea { flex: 1; font-family: monospace; resize: none; font-size: 0.9rem; }
    .toolbar { display: flex; gap: 0.5rem; }
    .btn { cursor: pointer; padding: 0.5rem 1rem; border: 1px solid #333; border-radius: 4px; font-weight: bold; background: #fff; }
    .btn-save { background: #34c759; color: white; border: none; }
  </style>
</head>
<body>
  <div id="sidebar">
    <h3>Posts</h3>
    <button class="btn" onclick="createNewPost()">+ New Post</button>
    <div id="post-list" style="display:flex;flex-direction:column;gap:0.5rem;overflow-y:auto;flex:1;">Loading...</div>
  </div>
  <div id="editor-area">
    <div class="toolbar">
      <button class="btn btn-save" onclick="saveActivePost()">Save</button>
      <input type="file" id="file-input" style="display:none;" onchange="uploadImage(this)">
      <button class="btn" onclick="document.getElementById('file-input').click()">Insert Image</button>
    </div>
    <input type="text" id="post-title" class="mock-input" placeholder="Title">
    <input type="text" id="post-tags" class="mock-input" placeholder="Tags (comma separated)">
    <input type="text" id="post-desc" class="mock-input" placeholder="Description">
    <input type="date" id="post-date" class="mock-input">
    <textarea id="post-body" class="mock-input" placeholder="Markdown content..." oninput="updatePreview()"></textarea>
  </div>
  <div id="preview-area">
    <h1 id="preview-title"></h1>
    <div id="preview-body" style="line-height:1.6;"></div>
  </div>

  <script>
    let activePost = null;

    async function loadPosts() {
      const res = await fetch('/api/posts');
      const posts = await res.json();
      const container = document.getElementById('post-list');
      container.innerHTML = posts.map(p => \`
        <div class="post-item \${activePost === p.filename ? 'active' : ''}" onclick="selectPost('\${p.filename}')">
          <strong>\${p.title}</strong>
          <div style="font-size:0.75rem;color:#86868b;">\${p.date}</div>
        </div>
      \`).join('');
    }

    async function selectPost(filename) {
      activePost = filename;
      const res = await fetch('/api/posts/' + encodeURIComponent(filename));
      const post = await res.json();
      document.getElementById('post-title').value = post.frontmatter.title || '';
      document.getElementById('post-tags').value = (post.frontmatter.tags || []).join(', ');
      document.getElementById('post-desc').value = post.frontmatter.description || '';
      document.getElementById('post-date').value = post.frontmatter.date || '';
      document.getElementById('post-body').value = post.body || '';
      loadPosts();
      updatePreview();
    }

    function createNewPost() {
      const filename = prompt('Enter filename (e.g. hello.md):');
      if (!filename) return;
      activePost = filename.endsWith('.md') ? filename : filename + '.md';
      document.getElementById('post-title').value = 'New Post';
      document.getElementById('post-tags').value = '';
      document.getElementById('post-desc').value = '';
      document.getElementById('post-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('post-body').value = '';
      saveActivePost();
    }

    async function saveActivePost() {
      if (!activePost) return alert('No active post');
      const payload = {
        frontmatter: {
          title: document.getElementById('post-title').value,
          description: document.getElementById('post-desc').value,
          date: document.getElementById('post-date').value,
          tags: document.getElementById('post-tags').value.split(',').map(s => s.trim()).filter(Boolean)
        },
        body: document.getElementById('post-body').value
      };
      await fetch('/api/posts/' + encodeURIComponent(activePost), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      loadPosts();
      alert('Saved successfully!');
    }

    async function uploadImage(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'x-filename': file.name },
        body: file
      });
      const data = await res.json();
      if (data.success) {
        const tag = '![image](' + data.localPath + ')';
        const txt = document.getElementById('post-body');
        txt.value += '\\n' + tag;
        updatePreview();
      }
    }

    function updatePreview() {
      document.getElementById('preview-title').innerText = document.getElementById('post-title').value;
      document.getElementById('preview-body').innerText = document.getElementById('post-body').value;
    }

    loadPosts();
  </script>
</body>
</html>`;
}

server.listen(PORT, () => {
  console.log(`Dev API Server running at http://localhost:${PORT}`);
});
