// Smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// Button interactions
document
  .querySelectorAll(".btn-primary, .btn-secondary, .btn-started, .cta-button")
  .forEach((btn) => {
    btn.addEventListener("click", function () {
      console.log("Button clicked:", this.textContent);
      // Add your action here
    });
  });

// Terminal animation
const terminalLines = document.querySelectorAll(".terminal-line");
terminalLines.forEach((line, index) => {
  line.style.animationDelay = `${index * 0.15}s`;
});

// Fade in elements on scroll
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("fade-in");
      }
    });
  },
  { threshold: 0.1 },
);

document
  .querySelectorAll(".feature-card, .benefit-item, .section-title")
  .forEach((el) => {
    observer.observe(el);
  });
