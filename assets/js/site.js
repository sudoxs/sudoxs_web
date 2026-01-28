// =========================
// sudoxs_web - site.js
// - English-only comments by request
// - No innerHTML for untrusted strings (safe DOM updates)
// =========================

// =========================
// Base Path Helpers
// =========================
function getBasePath() {
  const meta = document.querySelector('meta[name="site-base"]');
  const base = meta ? meta.getAttribute("content") : "";
  return base || ""; // "" or "/repo"
}

function withBase(urlPath) {
  const base = getBasePath();
  // urlPath expected like "/content/x" or "/index.html"
  if (!urlPath.startsWith("/")) return (base ? base + "/" : "/") + urlPath;
  return (base || "") + urlPath;
}

// =========================
// Drawer UI
// =========================
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const btnOpen = document.getElementById("drawerOpen");
const btnClose = document.getElementById("drawerClose");

function openDrawer() {
  if (!drawer || !overlay) return;
  drawer.classList.add("isOpen");
  drawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
}

function closeDrawer() {
  if (!drawer || !overlay) return;
  drawer.classList.remove("isOpen");
  drawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
}

btnOpen?.addEventListener("click", openDrawer);
btnClose?.addEventListener("click", closeDrawer);
overlay?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// =========================
// Data Load
// =========================
let INDEX = null;

async function loadIndex() {
  const res = await fetch(withBase("/assets/search_index.json"), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load search_index.json");
  return res.json();
}

// =========================
// Build Tree from paths
// =========================
function splitPath(p) {
  // Normalize: "/content/a/b.txt" -> ["content","a","b.txt"]
  return p.replace(/^\/+/, "").split("/").filter(Boolean);
}

function isUnderContent(pathArr) {
  return pathArr.length > 0 && pathArr[0] === "content";
}

function buildTree(items) {
  // Tree node structure: { name, children: Map, items: [] }
  const root = { name: "/", children: new Map(), items: [] };

  for (const it of items) {
    const parts = splitPath(it.path || it.url || "");
    if (!isUnderContent(parts)) continue;

    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        // file/page node stored as an item (not as folder)
        node.items.push({
          kind: it.type, // "file" or "page"
          name: it.type === "page" ? (it.title || seg) : (it.name || seg),
          url: it.url,
          fullPath: "/" + parts.slice(0, i + 1).join("/")
        });
      } else {
        if (!node.children.has(seg)) {
          node.children.set(seg, { name: seg, children: new Map(), items: [] });
        }
        node = node.children.get(seg);
      }
    }
  }

  return root;
}

// =========================
// Render Nav (Folders only)
// =========================
function el(tag, className) {
  const x = document.createElement(tag);
  if (className) x.className = className;
  return x;
}

function renderNavFolders(treeRoot) {
  const nav = document.getElementById("navTree");
  if (!nav) return;

  nav.textContent = "";

  // We show only first-level folders under /content
  const contentNode = treeRoot.children.get("content");
  if (!contentNode) {
    const msg = el("div", "muted small");
    msg.textContent = "No content/ directory found.";
    nav.appendChild(msg);
    return;
  }

  const folders = [...contentNode.children.values()].sort((a,b) => a.name.localeCompare(b.name));
  if (folders.length === 0) {
    const msg = el("div", "muted small");
    msg.textContent = "content/ is empty.";
    nav.appendChild(msg);
    return;
  }

  for (const folder of folders) {
    const item = el("button", "navItem");
    item.type = "button";

    const left = el("div", "navItem__name");
    left.textContent = folder.name;

    const meta = el("div", "navItem__meta");
    const childCount = folder.children.size;
    meta.textContent = childCount > 0 ? `${childCount} folders` : "folder";

    item.appendChild(left);
    item.appendChild(meta);

    item.addEventListener("click", () => {
      closeDrawer();
      browseFolder(`/content/${folder.name}`);
    });

    nav.appendChild(item);
  }
}

// =========================
// Browser (List view)
// =========================
function findNodeByPath(treeRoot, folderPath) {
  const parts = splitPath(folderPath);
  let node = treeRoot;

  for (const seg of parts) {
    if (!node.children.has(seg)) return null;
    node = node.children.get(seg);
  }
  return node;
}

function setBreadcrumb(path) {
  const bc = document.getElementById("breadcrumb");
  if (!bc) return;
  bc.textContent = path;
}

function renderList(treeRoot, folderPath) {
  const list = document.getElementById("list");
  if (!list) return;

  list.textContent = "";

  const node = findNodeByPath(treeRoot, folderPath);
  if (!node) {
    const msg = el("div", "muted small");
    msg.textContent = "Folder not found in index.";
    list.appendChild(msg);
    return;
  }

  // Folders
  const folders = [...node.children.values()].sort((a,b) => a.name.localeCompare(b.name));
  for (const f of folders) {
    const row = el("div", "row");

    const left = el("div", "row__left");
    const icon = el("div", "icon");
    icon.textContent = "📁";
    const name = el("div", "row__name");
    name.textContent = f.name;

    left.appendChild(icon);
    left.appendChild(name);

    const right = el("div", "row__right");
    const open = el("button", "iconBtn");
    open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", () => browseFolder(`${folderPath}/${f.name}`));

    right.appendChild(open);
    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }

  // Files/pages
  const items = [...node.items].sort((a,b) => a.name.localeCompare(b.name));
  for (const it of items) {
    const row = el("div", "row");

    const left = el("div", "row__left");
    const icon = el("div", "icon");
    icon.textContent = it.kind === "page" ? "📝" : "📄";
    const name = el("div", "row__name");
    name.textContent = it.name;

    left.appendChild(icon);
    left.appendChild(name);

    const right = el("div", "row__right");
    const a = el("a", "link");
    a.href = withBase(it.url);
    a.textContent = "Open";
    a.rel = "noopener";

    right.appendChild(a);
    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }

  if (folders.length === 0 && items.length === 0) {
    const msg = el("div", "muted small");
    msg.textContent = "This folder is empty.";
    list.appendChild(msg);
  }
}

function browseFolder(path) {
  setBreadcrumb(path);
  const tree = window.__TREE__;
  if (!tree) return;
  renderList(tree, path);
}

// =========================
// Secure Search (simple substring match)
// =========================
function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function attachSearch(allItems, treeRoot) {
  const input = document.getElementById("searchInput");
  const meta = document.getElementById("searchMeta");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = normalize(input.value);
    if (!meta) return;

    if (!q) {
      meta.textContent = "";
      return;
    }

    // Only search under content/
    const matches = allItems
      .filter(x => (x.path || x.url || "").includes("/content/"))
      .filter(x => {
        const title = x.type === "page" ? x.title : x.name;
        const hay = normalize(`${title} ${(x.path || x.url || "")}`);
        return hay.includes(q);
      })
      .slice(0, 20);

    meta.textContent = `${matches.length} result(s)`;

    // If we have a list view on homepage, show results there too
    const list = document.getElementById("list");
    if (!list) return;

    list.textContent = "";

    for (const m of matches) {
      const row = el("div", "row");

      const left = el("div", "row__left");
      const icon = el("div", "icon");
      icon.textContent = m.type === "page" ? "📝" : "📄";

      const name = el("div", "row__name");
      name.textContent = (m.type === "page" ? m.title : m.name) || "Untitled";

      left.appendChild(icon);
      left.appendChild(name);

      const right = el("div", "row__right");
      const a = el("a", "link");
      a.href = withBase(m.url);
      a.textContent = "Open";
      a.rel = "noopener";

      right.appendChild(a);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    }

    if (matches.length === 0) {
      const msg = el("div", "muted small");
      msg.textContent = "No results.";
      list.appendChild(msg);
    }

    setBreadcrumb(`/search: ${q}`);
  });
}

// =========================
// Boot
// =========================
(async function boot() {
  try {
    INDEX = await loadIndex();

    // Merge pages + files into one list for tree + search
    const all = [
      ...(INDEX.pages || []).map(p => ({
        type: "page",
        title: p.title,
        url: p.url,
        path: p.path
      })),
      ...(INDEX.files || []).map(f => ({
        type: "file",
        name: f.name,
        url: f.url,
        path: f.path
      }))
    ];

    const tree = buildTree(all);
    window.__TREE__ = tree;

    renderNavFolders(tree);
    attachSearch(all, tree);

    // Default view
    browseFolder("/content");
  } catch (e) {
    console.error(e);
    const nav = document.getElementById("navTree");
    if (nav) nav.textContent = "Failed to load index.";
    const list = document.getElementById("list");
    if (list) list.textContent = "Failed to load index.";
  }
})();
