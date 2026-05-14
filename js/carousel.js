/* ==============================
   Carousel automatique des temoignages
   ============================== */
document.addEventListener("DOMContentLoaded", () => {
  initTestimonialCarousel();
});

function initTestimonialCarousel() {
  const carousel = document.getElementById("testimonial-carousel");
  if (!carousel) {
    return;
  }

  const cards = Array.from(carousel.querySelectorAll(".testimonial-card"));
  const dots = Array.from(carousel.querySelectorAll(".dot"));
  if (!cards.length || !dots.length) {
    return;
  }

  let activeIndex = 0;
  let autoTimer = null;
  let touchStartX = 0;

  const setActiveSlide = (index) => {
    activeIndex = (index + cards.length) % cards.length;

    cards.forEach((card, cardIndex) => {
      card.classList.toggle("is-active", cardIndex === activeIndex);
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === activeIndex);
    });
  };

  const startAutoPlay = () => {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      setActiveSlide(activeIndex + 1);
    }, 4200);
  };

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      setActiveSlide(index);
      startAutoPlay();
    });
  });

  carousel.addEventListener("mouseenter", () => {
    clearInterval(autoTimer);
  });

  carousel.addEventListener("mouseleave", () => {
    startAutoPlay();
  });

  carousel.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  carousel.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) > 40) {
      setActiveSlide(activeIndex + (deltaX < 0 ? 1 : -1));
      startAutoPlay();
    }
  }, { passive: true });

  setActiveSlide(0);
  startAutoPlay();
}
