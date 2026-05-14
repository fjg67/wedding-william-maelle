/* ==============================
   Initialisation globale
   ============================== */
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("page-loader");

  window.setTimeout(() => {
    loader?.classList.add("hidden");
  }, window.matchMedia("(max-width: 767px)").matches ? 1000 : 1200);

  initHeroCinematic();
  initCustomCursor();
  // initDynamicPhotoCounter is called from gallery.js after media loads
  initCounters();
  initFarewellWaxSeal();
  initFarewellPolaroids();
  initMobileNavigation();
  initHeroReveal();

  document.addEventListener("click", skipIntro, { once: true });
});

/* ==============================
   Intro cinematique courte
   ============================== */
function initCinematicIntro() {
  const intro = document.getElementById("cinematic-intro");
  const skipButton = document.getElementById("skip-intro");
  const slides = Array.from(document.querySelectorAll(".cinematic-slide"));

  if (!intro || !slides.length) {
    return;
  }

  let slideIndex = 0;
  let slideTimer = null;
  let endTimer = null;
  let isStopped = false;

  const setSlide = (index) => {
    slideIndex = index % slides.length;
    slides.forEach((slide, currentIndex) => {
      slide.classList.toggle("is-active", currentIndex === slideIndex);
    });
  };

  const stopIntro = () => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    window.clearInterval(slideTimer);
    window.clearTimeout(endTimer);
    intro.classList.add("is-hidden");
    intro.classList.remove("is-active");

    window.setTimeout(() => {
      intro.remove();
    }, 650);
  };

  const startIntro = () => {
    intro.hidden = false;
    intro.classList.add("is-active");
    setSlide(0);

    slideTimer = window.setInterval(() => {
      setSlide(slideIndex + 1);
    }, 1700);

    endTimer = window.setTimeout(stopIntro, 5600);
  };

  skipButton?.addEventListener("click", stopIntro);

  window.setTimeout(startIntro, 1200);
}

/* ==============================
   Curseur premium (point + follower)
   ============================== */
function initCustomCursor() {
  const cursor = document.getElementById("custom-cursor");
  const follower = document.getElementById("custom-cursor-follower");

  if (!cursor || !follower) {
    return;
  }

  const isFinePointer = window.matchMedia("(pointer: fine)").matches;
  if (!isFinePointer) {
    return;
  }

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let followerX = pointerX;
  let followerY = pointerY;

  const animate = () => {
    followerX += (pointerX - followerX) * 0.1;
    followerY += (pointerY - followerY) * 0.1;

    cursor.style.transform = `translate(${pointerX - 6}px, ${pointerY - 6}px)`;
    follower.style.transform = `translate(${followerX - 20}px, ${followerY - 20}px)`;

    requestAnimationFrame(animate);
  };

  document.addEventListener("mousemove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    cursor.style.opacity = "1";
    follower.style.opacity = "1";
  });

  document.addEventListener("mouseleave", () => {
    cursor.style.opacity = "0";
    follower.style.opacity = "0";
  });

  const interactiveNodes = document.querySelectorAll("a, button, .gallery-item, .chapter-card");
  interactiveNodes.forEach((node) => {
    node.addEventListener("mouseenter", () => {
      document.body.classList.add("is-hovering-link");
    });

    node.addEventListener("mouseleave", () => {
      document.body.classList.remove("is-hovering-link");
    });
  });

  animate();
}

let heroIntroSkipped = false;
let heroParallaxState = null;
let heroParallaxFrame = null;

function skipIntro() {
  if (heroIntroSkipped) {
    return;
  }

  heroIntroSkipped = true;

  const loader = document.getElementById("page-loader");
  loader?.classList.add("hidden");

  const hero = document.querySelector(".hero");
  hero?.classList.add("is-loaded");

  document.querySelectorAll(".hero .reveal").forEach((node) => {
    node.classList.add("is-visible");
  });
}

function initHeroCinematic() {
  const hero = document.querySelector(".hero");
  const heroContent = document.querySelector(".hero-content");
  const heroTitle = document.querySelector(".hero-title");
  const heroIndicator = document.querySelector(".hero-scroll-indicator");
  const heroParticles = document.querySelector(".hero-particles");
  const petalContainer = document.querySelector(".petals");
  const dustContainer = document.querySelector(".hero-dust");

  if (!hero || !heroContent || !heroTitle || !heroIndicator || !heroParticles || !petalContainer || !dustContainer) {
    return;
  }

  heroTitle.dataset.text = heroTitle.textContent.replace(/\s+/g, " ").trim();
  hero.classList.add("is-loading");

  createHeroParticles(heroParticles);
  createHeroPetals(petalContainer);
  createHeroDust(dustContainer);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  const state = {
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    enabled: !reduceMotion,
    hero,
    heroContent,
    heroTitle,
    heroIndicator,
    halo: hero.querySelector(".hero-halo"),
    fogLeft: hero.querySelector(".hero-fog-left"),
    fogRight: hero.querySelector(".hero-fog-right"),
    flares: Array.from(hero.querySelectorAll(".hero-flare")),
    petalNodes: Array.from(petalContainer.querySelectorAll(".petal")),
    dustNodes: Array.from(dustContainer.querySelectorAll(".dust"))
  };

  heroParallaxState = state;

  const setVisible = () => {
    hero.classList.add("is-loaded");
    hero.classList.remove("is-loading");
    requestAnimationFrame(() => {
      hero.querySelectorAll(".reveal").forEach((node) => node.classList.add("is-visible"));
    });
  };

  const startParallax = () => {
    if (!state.enabled) {
      return;
    }

    const tick = () => {
      state.currentX += (state.targetX - state.currentX) * 0.08;
      state.currentY += (state.targetY - state.currentY) * 0.08;

      heroContent.style.setProperty("--hero-parallax-x", `${state.currentX}px`);
      heroContent.style.setProperty("--hero-parallax-y", `${state.currentY}px`);

      if (state.halo) {
        const pulse = 1 + Math.sin(performance.now() / 1200) * 0.035;
        state.halo.style.transform = `translate(calc(-50% + ${state.currentX * 0.25}px), calc(-50% + ${state.currentY * 0.25}px)) scale(${pulse + Math.abs(state.currentX) * 0.001})`;
      }

      if (state.fogLeft) {
        state.fogLeft.style.transform = `translate3d(${state.currentX * 0.1}px, ${state.currentY * 0.1}px, 0)`;
      }

      if (state.fogRight) {
        state.fogRight.style.transform = `translate3d(${-state.currentX * 0.1}px, ${state.currentY * 0.1}px, 0)`;
      }

      state.flares.forEach((flare, index) => {
        const multiplier = 0.2 + index * 0.06;
        flare.style.transform = `translate3d(${state.currentX * multiplier}px, ${state.currentY * multiplier}px, 0)`;
      });

      heroParallaxFrame = requestAnimationFrame(tick);
    };

    if (!heroParallaxFrame) {
      heroParallaxFrame = requestAnimationFrame(tick);
    }
  };

  const updateTarget = (clientX, clientY) => {
    const rect = hero.getBoundingClientRect();
    const offsetX = ((clientX - rect.left) / rect.width - 0.5) * 2;
    const offsetY = ((clientY - rect.top) / rect.height - 0.5) * 2;
    state.targetX = Math.max(-1, Math.min(1, offsetX));
    state.targetY = Math.max(-1, Math.min(1, offsetY));
  };

  if (!isTouch) {
    hero.addEventListener("mousemove", (event) => {
      updateTarget(event.clientX, event.clientY);
    });
    hero.addEventListener("mouseleave", () => {
      state.targetX = 0;
      state.targetY = 0;
    });
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", (event) => {
      if (event.beta == null || event.gamma == null) {
        return;
      }

      state.targetX = Math.max(-1, Math.min(1, (event.gamma / 45) * 0.5));
      state.targetY = Math.max(-1, Math.min(1, (event.beta / 45) * 0.5));
    }, { passive: true });
  }

  hero.addEventListener("click", (event) => {
    const target = event.target.closest("a, button");
    if (!target) {
      return;
    }

    const ripple = document.createElement("span");
    ripple.className = "hero-ripple";
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    target.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 650);
  });

  heroContent.querySelectorAll("a, button").forEach((node) => {
    node.addEventListener("mouseenter", () => {
      document.body.classList.add("is-hovering-link");
    });
    node.addEventListener("mouseleave", () => {
      document.body.classList.remove("is-hovering-link");
    });
  });

  window.addEventListener("scroll", () => {
    heroIndicator.classList.toggle("is-hidden", window.scrollY > 50);
  }, { passive: true });

  window.setTimeout(() => {
    setVisible();
    startParallax();
  }, 80);
}

function createHeroPetals(container) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = window.matchMedia("(max-width: 767px)").matches ? 8 : 12;
  const sizes = [
    [6, 14], [10, 22], [8, 18], [12, 26], [7, 16]
  ];

  container.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const petal = document.createElement("span");
    petal.className = "petal";
    const [width, height] = sizes[index % sizes.length];
    petal.style.setProperty("--left", `${Math.random() * 100}%`);
    petal.style.setProperty("--w", `${width}px`);
    petal.style.setProperty("--h", `${height}px`);
    petal.style.setProperty("--alpha", String((0.15 + Math.random() * 0.3).toFixed(2)));
    petal.style.setProperty("--drift", `${Math.round(Math.random() * 120 - 60)}px`);
    petal.style.setProperty("--rotation", `${Math.round(180 + Math.random() * 360)}deg`);
    petal.style.animationDuration = `${(12 + Math.random() * 16).toFixed(2)}s`;
    petal.style.animationDelay = `${(-8 + Math.random() * 8).toFixed(2)}s`;
    if (reduceMotion) {
      petal.style.animation = "none";
      petal.style.opacity = "0.25";
    }
    container.appendChild(petal);
  }
}

function createHeroParticles(container) {
  container.innerHTML = "";
  const points = [
    { top: 16, left: 16, delay: 0 },
    { top: 30, left: 74, delay: 1 },
    { top: 66, left: 18, delay: 1.6 },
    { top: 58, left: 84, delay: 2.2 },
    { top: 38, left: 52, delay: 2.7 }
  ];

  points.forEach((point) => {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.style.top = `${point.top}%`;
    sparkle.style.left = `${point.left}%`;
    sparkle.style.animationDelay = `${point.delay}s`;
    container.appendChild(sparkle);
  });
}

function createHeroDust(container) {
  container.innerHTML = "";
  for (let index = 0; index < 20; index += 1) {
    const dust = document.createElement("span");
    dust.className = "dust";
    dust.style.left = `${Math.random() * 100}%`;
    dust.style.top = `${20 + Math.random() * 75}%`;
    dust.style.animationDuration = `${(6 + Math.random() * 6).toFixed(2)}s`;
    dust.style.animationDelay = `${(Math.random() * 8).toFixed(2)}s`;
    container.appendChild(dust);
  }
}

/* ==============================
   Compteurs animes (count-up)
   ============================== */
function initCounters() {
  const section = document.querySelector(".counters-section");
  const counters = document.querySelectorAll(".counter-number[data-target]");

  if (section) {
    const canvas = section.querySelector(".counters-constellation");
    if (canvas) {
      initConstellationBackground(canvas);
    }

    const progressSegments = section.querySelectorAll(".stat-pb__seg");
    if (progressSegments.length) {
      const progressObserver = new IntersectionObserver(
        (entries, currentObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            progressSegments.forEach((seg) => seg.classList.add("is-animated"));
            currentObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.4 }
      );

      progressObserver.observe(section);
    }
  }

  if (!counters.length) {
    return;
  }

  const easeOutExpo = (value) => (value === 1 ? 1 : 1 - Math.pow(2, -10 * value));

  const animateCounter = (counter) => {
    if (counter.dataset.hasAnimated === "true") {
      return;
    }

    const target = Number(counter.getAttribute("data-target")) || 0;
    const duration = Number(counter.getAttribute("data-duration")) || 1800;
    const delay = Number(counter.getAttribute("data-delay")) || 0;

    counter.dataset.hasAnimated = "true";

    window.setTimeout(() => {
      const startTime = performance.now();

      const update = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = easeOutExpo(progress);
        counter.textContent = String(Math.round(eased * target));

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          counter.textContent = String(target);
          counter.dataset.counted = "true";
        }
      };

      requestAnimationFrame(update);
    }, delay);
  };

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        animateCounter(entry.target);
        currentObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.35, rootMargin: "0px 0px -10% 0px" }
  );

  counters.forEach((counter) => observer.observe(counter));
}

function initConstellationBackground(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  let dots = [];

  const createDots = (count, width, height) => {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14
      });
    }
    return list;
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = createDots(30, rect.width, rect.height);
  };

  const draw = () => {
    const width = canvas.getBoundingClientRect().width;
    const height = canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < dots.length; i += 1) {
      const a = dots[i];
      a.x += a.vx;
      a.y += a.vy;

      if (a.x < 0 || a.x > width) {
        a.vx *= -1;
      }
      if (a.y < 0 || a.y > height) {
        a.vy *= -1;
      }

      ctx.beginPath();
      ctx.fillStyle = "rgba(212, 175, 122, 0.5)";
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < dots.length; j += 1) {
        const b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.16;
          ctx.beginPath();
          ctx.strokeStyle = "rgba(212, 175, 122, " + alpha.toFixed(3) + ")";
          ctx.lineWidth = 0.6;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener("resize", resize, { passive: true });
}

/* ==============================
   Compteurs photos/vidéos/total dynamiques
   ============================== */
function initDynamicPhotoCounter() {
  const photosCounter = document.getElementById("counter-photos");
  const videosCounter = document.getElementById("counter-videos");
  const totalCounter = document.getElementById("counter-total");

  const syncMediaCounts = () => {
    // Count from allMediaItems if available (gallery.js variable), otherwise count from DOM
    let totalPhotos = 0;
    let totalVideos = 0;

    if (typeof allMediaItems !== 'undefined' && allMediaItems.length > 0) {
      totalPhotos = allMediaItems.filter(item => item.type === 'image').length;
      totalVideos = allMediaItems.filter(item => item.type === 'video').length;
    } else {
      // Fallback to DOM counting
      const galleryGrid = document.getElementById("gallery-grid");
      if (galleryGrid) {
        totalPhotos = galleryGrid.querySelectorAll('.gallery-item img.tinted-photo').length;
        totalVideos = galleryGrid.querySelectorAll('.gallery-item video').length;
      }
    }

    const total = totalPhotos + totalVideos;

    if (photosCounter) {
      photosCounter.setAttribute("data-target", String(totalPhotos));
      if (photosCounter.dataset.counted === "true") {
        photosCounter.textContent = String(totalPhotos);
      }
    }

    if (videosCounter) {
      videosCounter.setAttribute("data-target", String(totalVideos));
      if (videosCounter.dataset.counted === "true") {
        videosCounter.textContent = String(totalVideos);
      }
    }

    if (totalCounter) {
      totalCounter.setAttribute("data-target", String(total));
      if (totalCounter.dataset.counted === "true") {
        totalCounter.textContent = String(total);
      }
    }
  };

  syncMediaCounts();

  // Re-sync after gallery loads (with a small delay to ensure allMediaItems is populated)
  window.setTimeout(syncMediaCounts, 500);
  window.addEventListener("gallery:media-updated", syncMediaCounts);
}

/* ==============================
   Finitions lettre et polaroids
   ============================== */
function initFarewellWaxSeal() {
  const seal = document.getElementById("letter-wax-seal");
  if (!seal) {
    return;
  }

  const edge = seal.querySelector(".letter-seal__edge");
  if (!edge) {
    return;
  }

  const cx = 60;
  const cy = 60;
  const points = 24;
  const outerRadius = 50;
  const innerRadius = 47;
  let path = "";

  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI * i) / points;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    path += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }

  edge.setAttribute("d", `${path}Z`);
}

function initFarewellPolaroids() {
  const slots = Array.from(document.querySelectorAll(".polaroid-media[data-polaroid-slot]"));
  if (!slots.length) {
    return;
  }

  const applyImages = () => {
    let imageUrls = [];

    if (typeof allMediaItems !== "undefined" && Array.isArray(allMediaItems) && allMediaItems.length > 0) {
      imageUrls = allMediaItems.filter((item) => item.type === "image").map((item) => item.src).slice(0, 2);
    }

    if (!imageUrls.length) {
      const galleryImages = Array.from(document.querySelectorAll("#gallery-grid .gallery-item img"));
      imageUrls = galleryImages.map((img) => img.src).slice(0, 2);
    }

    slots.forEach((slot, index) => {
      const src = imageUrls[index];
      if (!src) {
        return;
      }

      slot.style.backgroundImage = `linear-gradient(145deg, rgba(122,157,190,0.3), rgba(212,175,122,0.25)), url('${src}')`;
      slot.classList.add("has-image");
      slot.textContent = "";
    });
  };

  applyImages();
  window.setTimeout(applyImages, 700);
  window.addEventListener("gallery:media-updated", applyImages);
}

/* ==============================
   Navigation mobile
   ============================== */
function initMobileNavigation() {
  const toggleButton = document.getElementById("mobile-nav-toggle");
  const navLinks = document.getElementById("nav-links");

  if (!toggleButton || !navLinks) {
    return;
  }

  toggleButton.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((anchor) => {
    anchor.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      toggleButton.setAttribute("aria-expanded", "false");
    });
  });
}

/* ==============================
   Hero reveals immediats
   ============================== */
function initHeroReveal() {
  const hero = document.querySelector(".hero");
  if (!hero) {
    return;
  }
}
