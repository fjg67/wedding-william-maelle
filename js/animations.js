/* ==============================
   Reveals au scroll via Intersection Observer
   ============================== */
document.addEventListener("DOMContentLoaded", () => {
  initScrollReveals();
  initFloatingNavigation();
  initActiveSectionTracking();
  initDayProgressLine();
  initDaySceneStagger();
  initStoryTimeline();
});

function initScrollReveals() {
  const revealElements = Array.from(document.querySelectorAll(".reveal"));
  if (!revealElements.length) {
    return;
  }

  revealElements.forEach((element, index) => {
    if (!element.style.getPropertyValue("--i")) {
      element.style.setProperty("--i", String(index % 8));
    }
  });

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px"
    }
  );

  revealElements.forEach((element) => observer.observe(element));
}

/* ==============================
   Apparition navbar apres scroll
   ============================== */
function initFloatingNavigation() {
  const nav = document.getElementById("floating-nav");
  if (!nav) {
    return;
  }

  const updateVisibility = () => {
    if (window.scrollY > 80) {
      nav.classList.add("is-visible");
      nav.classList.add("is-materialized");
    } else {
      nav.classList.remove("is-visible");
      nav.classList.remove("is-materialized");
    }
  };

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();
}

/* ==============================
   Lien actif + ligne glissante
   ============================== */
function initActiveSectionTracking() {
  const links = Array.from(document.querySelectorAll(".nav-link"));
  const sections = links
    .map((link) => {
      const id = link.getAttribute("href");
      return id ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  const indicator = document.getElementById("nav-indicator");

  const setActiveLink = (link) => {
    links.forEach((item) => item.classList.remove("is-active"));
    link.classList.add("is-active");

    if (!indicator || window.innerWidth <= 768) {
      return;
    }

    const parent = link.closest(".nav-inner");
    if (!parent) {
      return;
    }

    const parentRect = parent.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const offsetLeft = linkRect.left - parentRect.left;

    indicator.style.width = `${linkRect.width}px`;
    indicator.style.transform = `translateX(${offsetLeft}px)`;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      const activeId = `#${visible.target.id}`;
      const activeLink = links.find((link) => link.getAttribute("href") === activeId);
      if (activeLink) {
        setActiveLink(activeLink);
      }
    },
    {
      threshold: [0.35, 0.55, 0.75]
    }
  );

  sections.forEach((section) => observer.observe(section));

  const firstActive = links.find((link) => link.classList.contains("is-active"));
  if (firstActive) {
    setActiveLink(firstActive);
  }

  window.addEventListener("resize", () => {
    const current = links.find((link) => link.classList.contains("is-active"));
    if (current) {
      setActiveLink(current);
    }
  });
}

/* ==============================
   Stagger des scènes Jour J
   ============================== */
function initDaySceneStagger() {
  const scenes = Array.from(document.querySelectorAll(".day-scene"));
  if (!scenes.length) {
    return;
  }

  scenes.forEach((scene, index) => {
    scene.style.setProperty("--i", String(index));
  });

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const index = scenes.indexOf(entry.target);
        window.setTimeout(() => {
          entry.target.classList.add("is-visible");
        }, index * 90);

        currentObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  scenes.forEach((scene) => observer.observe(scene));
}

/* ==============================
   Ligne de progression du Jour J
   ============================== */
function initDayProgressLine() {
  const track = document.querySelector(".day-progress");
  if (!track) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        track.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.4
    }
  );

  observer.observe(track);
}

/* ==============================
   Timeline Notre Histoire
   ============================== */
function initStoryTimeline() {
  const timeline = document.getElementById("love-timeline");
  const progressLine = document.getElementById("love-line-progress");
  if (!timeline || !progressLine) {
    return;
  }

  const steps = Array.from(timeline.querySelectorAll(".love-step"));
  if (!steps.length) {
    return;
  }

  let maxVisibleStep = -1;

  const setProgress = (stepIndex) => {
    const ratio = steps.length > 1 ? stepIndex / (steps.length - 1) : 1;
    const value = Math.max(0, Math.min(1, ratio));
    progressLine.style.height = `${Math.round(value * 100)}%`;
  };

  const stepObserver = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const index = Number(entry.target.getAttribute("data-step-index"));
        if (Number.isFinite(index) && index > maxVisibleStep) {
          maxVisibleStep = index;
          setProgress(maxVisibleStep);
        }

        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -10% 0px"
    }
  );

  steps.forEach((step) => stepObserver.observe(step));

  const section = document.getElementById("histoire");
  if (!section) {
    return;
  }

  const sectionObserver = new IntersectionObserver(
    (entries, currentObserver) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (!visible) {
        return;
      }

      setProgress(Math.max(0, maxVisibleStep));
      currentObserver.unobserve(section);
    },
    { threshold: 0.15 }
  );

  sectionObserver.observe(section);
}
