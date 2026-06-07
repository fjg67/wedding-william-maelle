const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const MANIFEST_PATH = path.join(DATA_DIR, "media-manifest.json");
const TMP_UPLOAD_DIR = path.join(ROOT_DIR, ".tmp", "uploads");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_MEDIA_TABLE = process.env.SUPABASE_MEDIA_TABLE || "media";

const SUPABASE_BUCKETS = {
  photos: process.env.SUPABASE_PHOTOS_BUCKET || "photos",
  videos: process.env.SUPABASE_VIDEOS_BUCKET || "videos",
  posters: process.env.SUPABASE_POSTERS_BUCKET || "posters",
  videosWeb: process.env.SUPABASE_VIDEOS_WEB_BUCKET || "videos-web"
};

const CATEGORIES = ["mairie", "vin-dhonneur", "salle-des-fetes", "ceremonie-henne", "gateaux"];
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = SUPABASE_ENABLED ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

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

function buildSupabasePublicUrl(bucket, storagePath) {
  if (!supabase) {
    return "";
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data?.publicUrl || "";
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

function normalizePublicSrc(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .split("?")[0]
    .split("#")[0]
    .replace(/^\/+/, "");
}

function isValidMediaPublicPath(publicPath) {
  const match = publicPath.match(/^assets\/(photos|videos)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return false;
  }

  return CATEGORIES.includes(match[2]);
}

function resolveMediaAbsolutePath(publicPath) {
  const absolutePath = path.resolve(ROOT_DIR, publicPath);
  const rootWithSep = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;
  if (!absolutePath.startsWith(rootWithSep)) {
    return null;
  }

  return absolutePath;
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

async function readManifestFromSupabase() {
  if (!supabase) {
    return null;
  }

  let data = null;
  let error = null;

  ({ data, error } = await supabase
    .from(SUPABASE_MEDIA_TABLE)
    .select("type, category, filename, src, poster_src, web_src, media_position, created_at")
    .order("created_at", { ascending: true })
    .order("filename", { ascending: true }));

  if (error) {
    ({ data, error } = await supabase
      .from(SUPABASE_MEDIA_TABLE)
      .select("type, category, filename, src, poster_src, web_src, media_position")
      .order("filename", { ascending: true }));
  }

  if (error) {
    throw error;
  }

  const items = (data || [])
    .filter((item) => CATEGORIES.includes(item.category))
    .map((item) => ({
      type: item.type,
      category: item.category,
      filename: item.filename,
      src: item.src,
      posterSrc: item.poster_src || null,
      webSrc: item.web_src || null,
      mediaPosition: item.media_position || "center"
    }));

  return {
    updatedAt: new Date().toISOString(),
    items
  };
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
  let manifest = null;

  if (SUPABASE_ENABLED) {
    try {
      manifest = await readManifestFromSupabase();
    } catch (error) {
      console.error("Unable to read media from Supabase", error);
    }
  }

  if (!manifest) {
    manifest = await buildManifestFromDisk();
  }

  res.json(manifest);
});

async function uploadToSupabaseWithUniqueName({ file, type, category }) {
  const ext = path.extname(file.originalname || "").slice(1).toLowerCase();
  const base = sanitizeBaseName(path.basename(file.originalname || "media", path.extname(file.originalname || ""))) || `${type}-${Date.now()}`;
  const bucket = type === "image" ? SUPABASE_BUCKETS.photos : SUPABASE_BUCKETS.videos;
  const buffer = await fsp.readFile(file.path);

  let counter = 0;
  while (counter < 2000) {
    const filename = counter === 0 ? `${base}.${ext}` : `${base}-${counter}.${ext}`;
    const storagePath = `${category}/${filename}`;

    const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      upsert: false,
      contentType: file.mimetype || undefined
    });

    if (!error) {
      return {
        filename,
        storagePath,
        bucket,
        src: buildSupabasePublicUrl(bucket, storagePath)
      };
    }

    const isConflict = error?.statusCode === "409" || /already exists/i.test(error?.message || "");
    if (!isConflict) {
      throw error;
    }

    counter += 1;
  }

  throw new Error("unable-to-find-unique-filename");
}

async function insertSupabaseMediaRow(row) {
  const { error } = await supabase
    .from(SUPABASE_MEDIA_TABLE)
    .upsert(row, { onConflict: "category,type,filename" });

  if (error) {
    throw error;
  }
}

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
  const persistedItems = [];

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

    try {
      if (SUPABASE_ENABLED) {
        const uploaded = await uploadToSupabaseWithUniqueName({ file, type, category });
        const row = {
          type,
          category,
          filename: uploaded.filename,
          src: uploaded.src,
          poster_src: null,
          web_src: null,
          media_position: "center",
          storage_bucket: uploaded.bucket,
          storage_path: uploaded.storagePath
        };

        await insertSupabaseMediaRow(row);
        persistedItems.push({
          type,
          category,
          filename: uploaded.filename,
          src: uploaded.src,
          posterSrc: null,
          webSrc: null,
          mediaPosition: "center"
        });

        await fsp.unlink(file.path).catch(() => {});
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
      persistedItems.push({
        type,
        category,
        filename: candidate,
        src: `assets/${type === "image" ? "photos" : "videos"}/${category}/${candidate}`,
        mediaPosition: "center"
      });
    } catch (_error) {
      skipped += 1;
      await fsp.unlink(file.path).catch(() => {});
    }
  }

  if (!SUPABASE_ENABLED) {
    const manifest = await readManifest();
    const items = Array.isArray(manifest.items) ? [...manifest.items] : [];

    persistedItems.forEach((item) => {
      appendAtSectionEnd(items, item);
    });

    await writeManifest(items);
  }

  return res.json({
    added: persistedItems.length,
    skipped,
    items: persistedItems
  });
});

app.delete("/api/media", async (req, res) => {
  const src = normalizePublicSrc(req.body?.src);
  if (!src) {
    return res.status(400).json({ error: "invalid-src" });
  }

  if (SUPABASE_ENABLED) {
    const { data: found, error: selectError } = await supabase
      .from(SUPABASE_MEDIA_TABLE)
      .select("id, storage_bucket, storage_path")
      .eq("src", src)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      return res.status(500).json({ error: "delete-failed" });
    }

    if (!found) {
      return res.status(404).json({ error: "media-not-found" });
    }

    if (found.storage_bucket && found.storage_path) {
      await supabase.storage.from(found.storage_bucket).remove([found.storage_path]);
    }

    const { error: deleteError } = await supabase
      .from(SUPABASE_MEDIA_TABLE)
      .delete()
      .eq("id", found.id);

    if (deleteError) {
      return res.status(500).json({ error: "delete-failed" });
    }

    return res.json({ removed: true, src, provider: "supabase" });
  }

  if (!isValidMediaPublicPath(src)) {
    return res.status(400).json({ error: "invalid-src" });
  }

  const absolutePath = resolveMediaAbsolutePath(src);
  if (!absolutePath) {
    return res.status(400).json({ error: "invalid-src" });
  }

  let removedFromDisk = false;
  try {
    await fsp.unlink(absolutePath);
    removedFromDisk = true;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return res.status(500).json({ error: "delete-failed" });
    }
  }

  const manifest = await readManifest();
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const updatedItems = items.filter((item) => item?.src !== src);
  const removedFromManifest = updatedItems.length !== items.length;

  if (!removedFromDisk && !removedFromManifest) {
    return res.status(404).json({ error: "media-not-found" });
  }

  await writeManifest(updatedItems);

  return res.json({
    removed: true,
    src,
    provider: "local"
  });
});

async function start() {
  await ensureFolders();

  if (!SUPABASE_ENABLED) {
    await readManifest();
  }

  const port = Number(process.env.PORT || 8000);
  app.listen(port, () => {
    console.log(`Wedding gallery server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
