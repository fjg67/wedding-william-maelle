/* ==============================
   Galerie cinematique + lightbox
   ============================== */
document.addEventListener("DOMContentLoaded", async () => {
  await initAutoGalleryMedia();
  initGalleryFilters();
  initGalleryUploader();
  initGalleryViewer();
  initLightbox();
  applyCurrentFilter();

  if (typeof initDynamicPhotoCounter === "function") {
    initDynamicPhotoCounter();
  }
});

const GALLERY_CATEGORIES = ["mairie", "vin-dhonneur", "soiree", "ceremonie-henne"];
const CATEGORY_LABELS = {
  mairie: "Mairie",
  "vin-dhonneur": "Vin d'honneur",
  soiree: "Soiree",
  "ceremonie-henne": "Ceremonie de l'henne"
};

const CATEGORY_ICONS = {
  mairie: '<svg viewBox="0 0 24 24"><circle cx="9.2" cy="14.2" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.3 8.7L15.8 5.2C16.8 4.2 18.4 4.2 19.4 5.2C20.4 6.2 20.4 7.8 19.4 8.8L15.9 12.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  "vin-dhonneur": '<svg viewBox="0 0 24 24"><path d="M6 4V7.2C6 9 7.4 10.4 9.2 10.4C11 10.4 12.4 9 12.4 7.2V4M9.2 10.4V20" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M17.5 4L15.7 9.2H19.3L17.5 4ZM17.5 9.2V20" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  soiree: '<svg viewBox="0 0 24 24"><path d="M6 17L10 13M10 13L15.5 18.5M10 13L8.2 7.3L13.9 9.1M15.5 5.5L18.5 8.5M16 8L18 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  "ceremonie-henne": '<svg viewBox="0 0 24 24"><path d="M7 17C7 13 10 9.8 14 9.8C15.7 9.8 17.1 10.3 18.4 11.3C16.9 14.7 13.8 17 10 17H7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 19C12.5 19 15.6 16.8 17.1 13.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  all: '<svg viewBox="0 0 24 24"><path d="M12 3L13.9 8.1L19 10L13.9 11.9L12 17L10.1 11.9L5 10L10.1 8.1Z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
};

let allMediaItems = [];
let filteredMediaItems = [];
let currentSlideIndex = 0;
let activeFilter = "all";
let isSlideAnimating = false;
let viewerState = {
  activeLayer: "a",
  currentIndex: 0,
  currentThumb: null,
  isFullScreen: false
};

const SLIDE_FADE_MS = 400;

function insertMediaAtSectionEnd(mediaItem) {
  const lastIndex = allMediaItems.map((item) => item.category).lastIndexOf(mediaItem.category);
  if (lastIndex === -1) {
    allMediaItems.push(mediaItem);
    return;
  }

  allMediaItems.splice(lastIndex + 1, 0, mediaItem);
}

async function initAutoGalleryMedia() {
  const persistedItems = await fetchPersistedMediaItems();

  let scannedItems = persistedItems;
  if (!scannedItems.length) {
    const mediaQueries = [];
    GALLERY_CATEGORIES.forEach((category) => {
      mediaQueries.push(scanDirectoryForMedia(`assets/photos/${category}/`, "image", category));
      mediaQueries.push(scanDirectoryForMedia(`assets/videos/${category}/`, "video", category));
    });

    scannedItems = (await Promise.all(mediaQueries)).flat();
  }

  allMediaItems = scannedItems
    .map((item) => ({ ...item, node: createMediaFigure(item) }))
    .filter((item) => Boolean(item.node));
}

async function fetchPersistedMediaItems() {
  const endpoints = ["/api/media", "data/media-manifest.json"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const rawItems = Array.isArray(payload) ? payload : payload?.items;
      if (!Array.isArray(rawItems)) {
        continue;
      }

      return rawItems
        .map((item) => normalizePersistedItem(item))
        .filter((item) => Boolean(item));
    } catch (_error) {
      // Try next endpoint.
    }
  }

  return [];
}

function normalizePersistedItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const type = item.type === "video" ? "video" : item.type === "image" ? "image" : null;
  if (!type) {
    return null;
  }

  if (!GALLERY_CATEGORIES.includes(item.category)) {
    return null;
  }

  const src = typeof item.src === "string" ? item.src : "";
  const filename = typeof item.filename === "string" ? item.filename : "";
  if (!src || !filename) {
    return null;
  }

  return {
    type,
    category: item.category,
    src,
    filename,
    mediaPosition: item.mediaPosition || "center"
  };
}

function initGalleryUploader() {
  const sectionSelect = document.getElementById("upload-category");
  const fromFilesButton = document.getElementById("upload-from-files");
  const fromGalleryButton = document.getElementById("upload-from-gallery");
  const filesInput = document.getElementById("upload-input-files");
  const galleryInput = document.getElementById("upload-input-gallery");
  const feedback = document.getElementById("gallery-upload-feedback");
  const pills = document.querySelectorAll(".pill");
  const emptyCta = document.getElementById("gallery-empty-cta");
  const uploadFab = document.getElementById("upload-fab");

  if (!sectionSelect || !fromFilesButton || !fromGalleryButton || !filesInput || !galleryInput || !feedback) {
    return;
  }

  const syncSelectWithActiveFilter = () => {
    if (activeFilter !== "all" && GALLERY_CATEGORIES.includes(activeFilter)) {
      sectionSelect.value = activeFilter;
    }
  };

  syncSelectWithActiveFilter();

  pills.forEach((pill) => {
    pill.addEventListener("click", syncSelectWithActiveFilter);
  });

  const detectMediaType = (file) => {
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("image/")) {
      return "image";
    }
    if (mime.startsWith("video/")) {
      return "video";
    }

    const extension = (file.name.split(".").pop() || "").toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) {
      return "image";
    }
    if (["mp4", "webm", "mov", "m4v"].includes(extension)) {
      return "video";
    }
    return null;
  };

  const setFeedback = (message) => {
    feedback.textContent = message;
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    const targetCategory = sectionSelect.value;
    if (!GALLERY_CATEGORIES.includes(targetCategory)) {
      setFeedback("Choisissez d'abord une section valide.");
      return;
    }

    const compatibleFiles = files.filter((file) => Boolean(detectMediaType(file)));
    if (!compatibleFiles.length) {
      setFeedback("Aucun media compatible ajoute.");
      return;
    }

    fromFilesButton.disabled = true;
    fromGalleryButton.disabled = true;
    setFeedback("Envoi en cours...");

    let added = 0;
    let skipped = Math.max(0, files.length - compatibleFiles.length);

    try {
      const payload = new FormData();
      payload.append("category", targetCategory);
      compatibleFiles.forEach((file) => {
        payload.append("media", file, file.name);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: payload
      });

      if (!response.ok) {
        throw new Error(`upload-error-${response.status}`);
      }

      const result = await response.json();
      const persistedItems = Array.isArray(result?.items) ? result.items : [];

      persistedItems.forEach((item) => {
        const normalized = normalizePersistedItem(item);
        if (!normalized) {
          return;
        }

        const node = createMediaFigure(normalized);
        if (!node) {
          return;
        }

        insertMediaAtSectionEnd({ ...normalized, node });
        added += 1;
      });

      skipped += Number(result?.skipped || 0);
    } catch (_error) {
      setFeedback("Impossible de sauvegarder pour le moment. Lancez le serveur Node (npm start) pour activer la sauvegarde en ligne.");
      fromFilesButton.disabled = false;
      fromGalleryButton.disabled = false;
      return;
    }

    if (!added) {
      setFeedback("Aucun media compatible ajoute.");
      fromFilesButton.disabled = false;
      fromGalleryButton.disabled = false;
      return;
    }

    activeFilter = targetCategory;
    currentSlideIndex = 0;
    applyCurrentFilter();
    window.dispatchEvent(new Event("gallery:media-updated"));

    const sectionLabel = CATEGORY_LABELS[targetCategory] || targetCategory;
    setFeedback(`${added} media(s) ajoute(s) dans ${sectionLabel}.${skipped ? ` ${skipped} fichier(s) ignore(s).` : ""}`);

    fromFilesButton.disabled = false;
    fromGalleryButton.disabled = false;
  };

  fromFilesButton.addEventListener("click", () => {
    filesInput.click();
  });

  fromGalleryButton.addEventListener("click", () => {
    galleryInput.click();
  });

  emptyCta?.addEventListener("click", () => {
    uploadFab?.click();
  });

  uploadFab?.addEventListener("click", () => {
    filesInput.click();
  });

  filesInput.addEventListener("change", async () => {
    await handleFiles(filesInput.files);
    filesInput.value = "";
  });

  galleryInput.addEventListener("change", async () => {
    await handleFiles(galleryInput.files);
    galleryInput.value = "";
  });
}

async function scanDirectoryForMedia(directoryUrl, type, category) {
  try {
    const response = await fetch(directoryUrl, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const links = Array.from(doc.querySelectorAll("a[href]"));

    const allowedExtensions = {
      image: ["jpg", "jpeg", "png", "webp", "gif", "avif"],
      video: ["mp4", "webm", "mov", "m4v"]
    };

    const entries = [];

    links.forEach((link) => {
      const rawHref = (link.getAttribute("href") || "").trim();
      if (!rawHref || rawHref === "../") {
        return;
      }

      const fileUrl = new URL(rawHref, response.url);
      if (fileUrl.pathname.endsWith("/")) {
        return;
      }

      const filename = decodeURIComponent(fileUrl.pathname.split("/").pop() || "");
      if (!filename || filename.startsWith(".")) {
        return;
      }

      const extension = (filename.split(".").pop() || "").toLowerCase();
      if (!allowedExtensions[type].includes(extension)) {
        return;
      }

      entries.push({
        type,
        category,
        src: `${fileUrl.pathname}${fileUrl.search}`,
        filename,
        mediaPosition: "center"
      });
    });

    return entries.sort((a, b) => a.filename.localeCompare(b.filename, "fr"));
  } catch (_error) {
    return []; 
  }
}

function createMediaFigure(item) {
  const figure = document.createElement("figure");
  figure.className = "gallery-item";
  figure.dataset.category = item.category;
  figure.dataset.mediaType = item.type;
  figure.dataset.caption = readableCaption(item.filename, item.category);
  figure.dataset.mediaPosition = item.mediaPosition || "center";

  if (item.type === "video") {
    figure.classList.add("media-video");
  }

  const image = document.createElement("img");
  image.className = "tinted-photo";
  image.loading = "eager";
  image.decoding = "async";
  image.alt = figure.dataset.caption;
  image.src = item.type === "image" ? item.src : getVideoPosterPath(item);
  image.dataset.fullsrc = item.src;
  image.dataset.caption = figure.dataset.caption;
  image.dataset.position = figure.dataset.mediaPosition;
  image.style.objectPosition = figure.dataset.mediaPosition;

  figure.appendChild(image);

  if (item.type === "video") {
    const play = document.createElement("span");
    play.className = "gallery-thumb-play gallery-video-badge";
    play.setAttribute("aria-hidden", "true");
    play.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>';
    figure.appendChild(play);
  }

  return figure;
}

function readableCaption(filename, category) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim() || (CATEGORY_LABELS[category] || category);
}

function guessVideoMimeType(filename) {
  const extension = (filename.split(".").pop() || "").toLowerCase();
  if (extension === "webm") {
    return "video/webm";
  }
  return "video/mp4";
}

function getVideoPosterPath(item) {
  const encodedFilename = encodeURIComponent(item.filename);
  return `assets/posters/${item.category}/${encodedFilename}.png`;
}

function getVideoPlaybackSource(item, video) {
  const extension = (item.filename.split(".").pop() || "").toLowerCase();
  const encodedFilename = encodeURIComponent(item.filename.replace(/\.[^.]+$/, ""));

  if (extension === "mov") {
    if (video.canPlayType("video/quicktime")) {
      return {
        src: item.src,
        type: "video/quicktime"
      };
    }

    return {
      src: `assets/videos-web/${item.category}/${encodedFilename}.m4v`,
      type: "video/mp4"
    };
  }

  return {
    src: item.src,
    type: guessVideoMimeType(item.filename)
  };
}

function initGalleryFilters() {
  const pills = document.querySelectorAll(".pill");
  if (!pills.length) {
    return;
  }

  const activeButton = document.querySelector(".pill.is-active");
  activeFilter = activeButton?.dataset.filter || "all";

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      activeFilter = pill.dataset.filter || "all";
      pills.forEach((button) => {
        button.classList.toggle("is-active", button === pill);
      });
      currentSlideIndex = 0;
      applyCurrentFilter();
    });
  });
}

function initGalleryViewer() {
  const prevButton = document.getElementById("gallery-prev");
  const nextButton = document.getElementById("gallery-next");
  const viewer = document.getElementById("gallery-viewer");
  const viewerMain = document.getElementById("gallery-main-media");
  const layerA = document.getElementById("gallery-layer-a");
  const layerB = document.getElementById("gallery-layer-b");
  const thumbs = document.getElementById("gallery-thumbs");
  const counter = document.getElementById("gallery-counter");
  const categoryLabel = document.getElementById("gallery-current-category-label");
  const download = document.getElementById("gallery-download");
  const expandButton = document.getElementById("gallery-expand");
  const emptyState = document.getElementById("gallery-empty");
  const galleryGrid = document.getElementById("gallery-grid");
  const emptyCta = document.getElementById("gallery-empty-cta");

  if (!viewer || !viewerMain || !layerA || !layerB || !thumbs || !galleryGrid) {
    return;
  }

  const layers = { a: layerA, b: layerB };

  const getNextLayerKey = () => (viewerState.activeLayer === "a" ? "b" : "a");

  const setCounter = (index, total) => {
    if (!counter) {
      return;
    }

    const currentEl = counter.querySelector(".current");
    const totalEl = counter.querySelector(".total");
    if (currentEl) {
      currentEl.textContent = String(index + 1).padStart(2, "0");
    }
    if (totalEl) {
      totalEl.textContent = String(total).padStart(2, "0");
    }

    counter.classList.remove("is-flipping");
    requestAnimationFrame(() => counter.classList.add("is-flipping"));
    window.setTimeout(() => counter.classList.remove("is-flipping"), 220);
  };

  const updateCategoryInfo = (item) => {
    if (categoryLabel) {
      categoryLabel.textContent = (CATEGORY_LABELS[item.category] || "Souvenirs").toUpperCase();
    }

    if (download) {
      download.href = item.src;
      const filename = item.filename || item.src.split("/").pop() || "media";
      download.setAttribute("download", filename);
    }

    if (expandButton) {
      expandButton.dataset.src = item.src;
      expandButton.dataset.type = item.type;
      expandButton.dataset.title = readableCaption(item.filename, item.category);
    }
  };

  const setThumbActive = (index) => {
    const thumbNodes = Array.from(thumbs.querySelectorAll(".gallery-thumb"));
    thumbNodes.forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === index);
    });

    const activeThumb = thumbNodes[index];
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  const syncLayerContent = (layer, item) => {
    const image = layer.querySelector("img.layer-image");
    const video = layer.querySelector("video.layer-video");
    const play = layer.querySelector(".viewer-play");
    layer.classList.toggle("is-video", item.type === "video");

    if (item.type === "image") {
      if (image) {
        image.src = item.src;
        image.alt = readableCaption(item.filename, item.category);
        image.style.objectPosition = item.mediaPosition || "center";
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        while (video.firstChild) {
          video.removeChild(video.firstChild);
        }
      }
      if (play) {
        play.hidden = true;
      }
      layer.classList.remove("is-playing-video");
      return;
    }

    const poster = getVideoPosterPath(item);
    const source = getVideoPlaybackSource(item, video);

    if (image) {
      image.src = poster;
      image.alt = readableCaption(item.filename, item.category);
      image.style.objectPosition = "center";
    }

    if (video) {
      video.poster = poster;
      video.hidden = false;
      video.pause();
      video.currentTime = 0;
      while (video.firstChild) {
        video.removeChild(video.firstChild);
      }
      const sourceEl = document.createElement("source");
      sourceEl.src = source.src;
      sourceEl.type = source.type;
      video.appendChild(sourceEl);
      video.load();
      video.hidden = false;
    }

    if (play) {
      play.hidden = false;
      play.onclick = () => {
        layer.classList.add("is-playing-video");
        video.hidden = false;
        video.play().catch(() => {});
      };
    }

    layer.classList.add("is-video");
  };

  const renderThumbs = (items) => {
    thumbs.innerHTML = "";
    items.forEach((item, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "gallery-thumb";
      thumb.dataset.index = String(index);
      thumb.dataset.category = item.category;
      thumb.dataset.type = item.type;
      thumb.dataset.caption = readableCaption(item.filename, item.category);
      thumb.setAttribute("aria-label", item.type === "video" ? `Video ${thumb.dataset.caption}` : `Photo ${thumb.dataset.caption}`);
      thumb.innerHTML = item.type === "video"
        ? `<img src="${getVideoPosterPath(item)}" alt="${thumb.dataset.caption}"><span class="gallery-thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg></span>`
        : `<img src="${item.src}" alt="${thumb.dataset.caption}">`;

      thumb.addEventListener("click", () => {
        currentSlideIndex = index;
        renderCurrentSlide();
      });

      thumbs.appendChild(thumb);
    });
  };

  const showEmptyState = () => {
    viewerMain.classList.add("is-hidden");
    thumbs.innerHTML = "";
    if (emptyState) {
      emptyState.classList.remove("is-hidden");
    }
  };

  const showViewer = () => {
    viewerMain.classList.remove("is-hidden");
    if (emptyState) {
      emptyState.classList.add("is-hidden");
    }
  };

  const goToSlide = (nextIndex) => {
    if (!filteredMediaItems.length || isSlideAnimating) {
      return;
    }

    isSlideAnimating = true;
    viewer.classList.add("is-switching");

    const nextLayerKey = getNextLayerKey();
    const activeLayerKey = viewerState.activeLayer;
    const incomingLayer = layers[nextLayerKey];
    const outgoingLayer = layers[activeLayerKey];
    const item = filteredMediaItems[nextIndex];

    syncLayerContent(incomingLayer, item);
    incomingLayer.classList.add("is-active");
    outgoingLayer.classList.remove("is-active");

    window.setTimeout(() => {
      viewerState.activeLayer = nextLayerKey;
      viewerState.currentIndex = nextIndex;
      viewerState.currentThumb = thumbs.querySelector(`.gallery-thumb[data-index="${nextIndex}"]`);
      currentSlideIndex = nextIndex;
      viewer.classList.remove("is-switching");
      setCounter(nextIndex, filteredMediaItems.length);
      updateCategoryInfo(item);
      setThumbActive(nextIndex);
      isSlideAnimating = false;
    }, SLIDE_FADE_MS);
  };

  prevButton?.addEventListener("click", () => {
    if (!filteredMediaItems.length) {
      return;
    }

    prevButton.classList.add("is-pressed");
    window.setTimeout(() => prevButton.classList.remove("is-pressed"), 120);
    const nextIndex = (currentSlideIndex - 1 + filteredMediaItems.length) % filteredMediaItems.length;
    goToSlide(nextIndex);
  });

  nextButton?.addEventListener("click", () => {
    if (!filteredMediaItems.length) {
      return;
    }

    nextButton.classList.add("is-pressed");
    window.setTimeout(() => nextButton.classList.remove("is-pressed"), 120);
    const nextIndex = (currentSlideIndex + 1) % filteredMediaItems.length;
    goToSlide(nextIndex);
  });

  viewerMain.addEventListener("dblclick", () => {
    openLightboxFromIndex(currentSlideIndex);
  });

  expandButton?.addEventListener("click", () => {
    openLightboxFromIndex(currentSlideIndex);
  });

  viewerMain.addEventListener("click", (event) => {
    const playButton = event.target.closest(".viewer-play");
    if (playButton) {
      const activeLayer = layers[viewerState.activeLayer];
      const video = activeLayer.querySelector("video.layer-video");
      if (video) {
        activeLayer.classList.add("is-playing-video");
        video.hidden = false;
        video.play().catch(() => {});
      }
      return;
    }

    if (event.target.closest(".viewer-nav")) {
      return;
    }

    openLightboxFromIndex(currentSlideIndex);
  });

  window.addEventListener("keydown", (event) => {
    if (!filteredMediaItems.length) {
      return;
    }

    if (event.key === "ArrowLeft") {
      goToSlide((currentSlideIndex - 1 + filteredMediaItems.length) % filteredMediaItems.length);
    } else if (event.key === "ArrowRight") {
      goToSlide((currentSlideIndex + 1) % filteredMediaItems.length);
    }
  });

  const openLightboxFromIndex = (index) => {
    const lightbox = document.getElementById("lightbox");
    if (!lightbox) {
      return;
    }

    const image = filteredMediaItems[index];
    if (!image) {
      return;
    }

    openLightbox(index);
  };

  const renderCurrentSlide = () => {
    if (!filteredMediaItems.length) {
      showEmptyState();
      return;
    }

    showViewer();

    const item = filteredMediaItems[currentSlideIndex];
    const activeLayer = layers[viewerState.activeLayer];
    syncLayerContent(activeLayer, item);
    setCounter(currentSlideIndex, filteredMediaItems.length);
    updateCategoryInfo(item);
    renderThumbs(filteredMediaItems);
    setThumbActive(currentSlideIndex);
  };

  window.renderCurrentGallerySlide = renderCurrentSlide;
  window.galleryGoToSlide = goToSlide;
  window.openLightboxFromIndex = openLightboxFromIndex;

  renderCurrentSlide();
}

function applyCurrentFilter() {
  filteredMediaItems = allMediaItems.filter((item) => activeFilter === "all" || item.category === activeFilter);
  if (currentSlideIndex >= filteredMediaItems.length) {
    currentSlideIndex = 0;
  }
  renderCurrentGallerySlide?.();
}

function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxCounter = document.getElementById("lightbox-counter");
  const lightboxCategory = document.getElementById("lightbox-category");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxDownload = document.getElementById("lightbox-download");
  const closeButton = document.getElementById("lightbox-close");
  const closeInline = document.getElementById("lightbox-close-inline");
  const prevButton = document.getElementById("lightbox-prev");
  const nextButton = document.getElementById("lightbox-next");
  const galleryGrid = document.getElementById("gallery-grid");

  if (!lightbox || !lightboxImage || !galleryGrid) {
    return;
  }

  let currentIndex = 0;
  let touchStartX = 0;
  let lightboxPhotos = [];

  const buildPhotoList = () => filteredMediaItems.map((item) => ({
    src: item.src,
    alt: item.filename,
    title: readableCaption(item.filename, item.category),
    category: item.category,
    type: item.type
  }));

  const updateLightbox = () => {
    const media = lightboxPhotos[currentIndex];
    if (!media) {
      return;
    }

    lightboxImage.src = media.type === "video" ? getVideoPosterPath(media) : media.src;
    lightboxImage.alt = media.alt || "Media agrandi";

    if (lightboxCounter) {
      const left = String(currentIndex + 1).padStart(2, "0");
      const right = String(lightboxPhotos.length).padStart(2, "0");
      lightboxCounter.textContent = `${left} / ${right}`;
    }

    if (lightboxCategory) {
      lightboxCategory.textContent = (CATEGORY_LABELS[media.category] || media.category || "Souvenir").toUpperCase();
    }

    if (lightboxTitle) {
      lightboxTitle.textContent = media.title || "Souvenir";
    }

    if (lightboxDownload) {
      lightboxDownload.href = media.src;
      const filename = media.src.split("/").pop() || "media";
      lightboxDownload.setAttribute("download", filename);
    }
  };

  const openLightbox = (index) => {
    lightboxPhotos = buildPhotoList();
    if (!lightboxPhotos.length) {
      return;
    }

    currentIndex = Math.max(0, Math.min(index, lightboxPhotos.length - 1));
    updateLightbox();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const showNext = () => {
    if (!lightboxPhotos.length) {
      return;
    }

    currentIndex = (currentIndex + 1) % lightboxPhotos.length;
    updateLightbox();
  };

  const showPrev = () => {
    if (!lightboxPhotos.length) {
      return;
    }

    currentIndex = (currentIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightbox();
  };

  galleryGrid.addEventListener("click", (event) => {
    if (event.target.closest(".viewer-nav") || event.target.closest(".viewer-play") || event.target.closest(".viewer-action")) {
      return;
    }

    const clickedThumb = event.target.closest(".gallery-thumb");
    if (clickedThumb) {
      const index = Number(clickedThumb.dataset.index || "0");
      openLightbox(index);
      return;
    }

    const activeSlide = Number.isFinite(currentSlideIndex) ? currentSlideIndex : 0;
    openLightbox(activeSlide);
  });

  closeButton?.addEventListener("click", closeLightbox);
  closeInline?.addEventListener("click", closeLightbox);
  prevButton?.addEventListener("click", showPrev);
  nextButton?.addEventListener("click", showNext);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("is-open")) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    } else if (event.key === "ArrowRight") {
      showNext();
    } else if (event.key === "ArrowLeft") {
      showPrev();
    }
  });

  lightbox.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  lightbox.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) < 60) {
      return;
    }

    if (deltaX < 0) {
      showNext();
    } else {
      showPrev();
    }
  }, { passive: true });

  window.openLightbox = openLightbox;
}
