const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const app = express();

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const MANIFEST_PATH = path.join(DATA_DIR, "media-manifest.json");
const TMP_UPLOAD_DIR = path.join(ROOT_DIR, ".tmp", "uploads");

const CATEGORIES = ["mairie", "vin-dhonneur", "salle-des-fetes", "ceremonie-henne", "gateaux"];
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);

const upload = multer({
  dest: TMP_UPLOAD_DIR,
  limits: {
    fileSize: 1024 * 1024 * 500,
    files: 80
  }
});

function sanitizeBaseName(value) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function toPublicPath(absolutePath) {
  const rel = path.relative(ROOT_DIR, absolutePath).split(path.sep).join("/");
  return rel;
}

async function ensureFolders() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(TMP_UPLOAD_DIR, { recursive: true });

  for (const category of CATEGORIES) {
    await fsp.mkdir(path.join(ROOT_DIR, "assets", "photos", category), { recursive: true });
    await fsp.mkdir(path.join(ROOT_DIR, "assets", "videos", category), { recursive: true });
  }
}

function detectTypeFromExt(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  return null;
}

async function buildManifestFromDisk() {
  const items = [];

  for (const category of CATEGORIES) {
    const photoDir = path.join(ROOT_DIR, "assets", "photos", category);
    const videoDir = path.join(ROOT_DIR, "assets", "videos", category);

    for (const [dirPath, type] of [[photoDir, "image"], [videoDir, "video"]]) {
      let entries = [];
      try {
        entries = await fsp.readdir(dirPath, { withFileTypes: true });
      } catch (_error) {
        entries = [];
      }

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
          continue;
        }

        const detected = detectTypeFromExt(entry.name);
        if (detected !== type) {
          continue;
        }

        const absolute = path.join(dirPath, entry.name);
        items.push({
          type,
          category,
          filename: entry.name,
          src: toPublicPath(absolute)
        });
      }
    }
  }

  items.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "image" ? -1 : 1;
    }

    if (left.category !== right.category) {
      return left.category.localeCompare(right.category, "fr");
    }

    return left.filename.localeCompare(right.filename, "fr");
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    items
  };

  await fsp.writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function readManifest() {
  try {
    const raw = await fsp.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) {
      return buildManifestFromDisk();
    }
    return parsed;
  } catch (_error) {
    return buildManifestFromDisk();
  }
}

async function writeManifest(items) {
  const payload = {
    updatedAt: new Date().toISOString(),
    items
  };

  await fsp.writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function appendAtSectionEnd(items, newItem) {
  const lastIndex = items.map((item) => item.category).lastIndexOf(newItem.category);
  if (lastIndex === -1) {
    items.push(newItem);
    return;
  }

  items.splice(lastIndex + 1, 0, newItem);
}

app.use(express.json());
app.use(express.static(ROOT_DIR));

app.get("/api/media", async (_req, res) => {
  const manifest = await buildManifestFromDisk();
  res.json(manifest);
});

app.post("/api/upload", upload.array("media", 80), async (req, res) => {
  const category = typeof req.body?.category === "string" ? req.body.category : "";
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "invalid-category" });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ error: "no-files" });
  }

  let skipped = 0;
  const savedNames = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const original = file.originalname || `media-${Date.now()}-${index}`;
    const ext = path.extname(original).slice(1).toLowerCase();
    const type = detectTypeFromExt(original);

    if (!type || !ext) {
      skipped += 1;
      if (file.path) {
        await fsp.unlink(file.path).catch(() => {});
      }
      continue;
    }

    const targetDir = path.join(ROOT_DIR, "assets", type === "image" ? "photos" : "videos", category);
    await fsp.mkdir(targetDir, { recursive: true });

    const base = sanitizeBaseName(path.basename(original, path.extname(original))) || `${type}-${Date.now()}`;
    let candidate = `${base}.${ext}`;
    let counter = 1;

    while (fs.existsSync(path.join(targetDir, candidate))) {
      candidate = `${base}-${counter}.${ext}`;
      counter += 1;
    }

    const targetPath = path.join(targetDir, candidate);
    await fsp.rename(file.path, targetPath);
    savedNames.push({ filename: candidate, type, category });
  }

  const manifest = await readManifest();
  const items = Array.isArray(manifest.items) ? [...manifest.items] : [];
  const persistedItems = [];

  savedNames.forEach((saved) => {
    const src = `assets/${saved.type === "image" ? "photos" : "videos"}/${saved.category}/${saved.filename}`;
    const newItem = {
      type: saved.type,
      category: saved.category,
      filename: saved.filename,
      src
    };

    appendAtSectionEnd(items, newItem);
    persistedItems.push(newItem);
  });

  await writeManifest(items);

  return res.json({
    added: persistedItems.length,
    skipped,
    items: persistedItems
  });
});

async function start() {
  await ensureFolders();
  await readManifest();

  const port = Number(process.env.PORT || 8000);
  app.listen(port, () => {
    console.log(`Wedding gallery server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
