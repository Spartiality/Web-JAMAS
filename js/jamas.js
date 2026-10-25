/* =========================================================
   JAMAS MATSANEWA · interaction & motion
   GSAP ScrollTrigger + Lenis, with accessible fallbacks
   ========================================================= */
(function () {
  "use strict";

  const doc = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const hasLenis = typeof window.Lenis !== "undefined";

  /* -------------------------------------------------------
     Smooth scrolling
     ------------------------------------------------------- */
  let lenis = null;

  if (hasLenis && !reduceMotion) {
    lenis = new Lenis({
      duration: 1.12,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.15
    });

    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  /* -------------------------------------------------------
     Small helpers
     ------------------------------------------------------- */
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* Exposed only for local testing / debugging. */
  window.__jamas = { lenis, refresh: () => window.ScrollTrigger && ScrollTrigger.refresh() };

  function scrollToTarget(target) {
    if (!target) return;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 96);
    if (lenis) {
      lenis.scrollTo(top, { duration: 1.1 });
    } else {
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function syncDialogLock() {
    const open = document.querySelector("dialog[open]");
    document.body.classList.toggle("dialog-open", Boolean(open));
    if (!lenis) return;
    if (open) lenis.stop();
    else lenis.start();
  }

  /* -------------------------------------------------------
     Navigation state
     ------------------------------------------------------- */
  const nav = $("#nav");
  const navLinks = $$(".nav__links a");
  const menu = $("#menu");
  const menuOpenBtn = $("[data-menu-open]");
  const menuCloseBtn = $("[data-menu-close]");
  let lastMenuFocus = null;

  function updateNavState() {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 30);
  }
  window.addEventListener("scroll", updateNavState, { passive: true });
  updateNavState();

  function setActiveSection(id) {
    navLinks.forEach((link) => {
      const on = link.getAttribute("href") === "#" + id;
      link.classList.toggle("is-active", on);
      if (on) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  /* -------------------------------------------------------
     Mobile menu
     ------------------------------------------------------- */
  function menuIsOpen() {
    return menu && menu.classList.contains("is-open");
  }

  function openMenu() {
    if (!menu || !menuOpenBtn) return;
    lastMenuFocus = document.activeElement;
    menu.hidden = false;
    document.body.classList.add("menu-open");
    menuOpenBtn.setAttribute("aria-expanded", "true");
    if (lenis) lenis.stop();
    requestAnimationFrame(() => {
      menu.classList.add("is-open");
      if (menuCloseBtn) menuCloseBtn.focus();
    });
  }

  function closeMenu(restoreFocus = true) {
    if (!menu || !menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    if (menuOpenBtn) menuOpenBtn.setAttribute("aria-expanded", "false");
    if (lenis) lenis.start();
    window.setTimeout(() => {
      menu.hidden = true;
      if (restoreFocus && lastMenuFocus) lastMenuFocus.focus();
    }, 460);
  }

  if (menuOpenBtn) menuOpenBtn.addEventListener("click", openMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener("click", () => closeMenu());

  $$(".menu__links a").forEach((link) => {
    link.addEventListener("click", () => closeMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuIsOpen()) closeMenu();
    if (event.key !== "Tab" || !menuIsOpen()) return;

    const focusables = $$(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      menu
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* -------------------------------------------------------
     Anchor navigation
     ------------------------------------------------------- */
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    closeMenu(false);

    if (href === "#form") {
      openFormDialog();
      return;
    }

    scrollToTarget(target);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", href);
    }

    const heading = target.querySelector("h1, h2, h3");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      window.setTimeout(() => heading.focus({ preventScroll: true }), 520);
    }
  });

  /* -------------------------------------------------------
     Active section
     ------------------------------------------------------- */
  const sections = $$("main section[id]");
  let activeTicking = false;

  function updateActiveSection() {
    if (!sections.length) return;
    const marker = window.scrollY + window.innerHeight * 0.38;
    let current = sections[0].id;
    sections.forEach((section) => {
      const top = section.getBoundingClientRect().top + window.scrollY;
      if (top <= marker) current = section.id;
    });
    setActiveSection(current);
  }

  function requestActiveUpdate() {
    if (activeTicking) return;
    activeTicking = true;
    requestAnimationFrame(() => {
      updateActiveSection();
      activeTicking = false;
    });
  }

  window.addEventListener("scroll", requestActiveUpdate, { passive: true });
  window.addEventListener("resize", requestActiveUpdate);
  if (lenis) lenis.on("scroll", requestActiveUpdate);
  updateActiveSection();

  /* -------------------------------------------------------
     Lightbox
     ------------------------------------------------------- */
  const lightbox = $("#lightbox");
  const lightboxImg = $(".lightbox__img", lightbox || document);
  const lightboxCaption = $("#lightbox-caption");
  const lightboxCount = $("[data-lightbox-count]", lightbox || document);
  const lightboxItems = $$("[data-lightbox]");
  let lightboxIndex = 0;

  function renderLightbox(index) {
    if (!lightboxItems.length || !lightbox) return;
    lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
    const item = lightboxItems[lightboxIndex];
    const src = item.getAttribute("data-full") || item.querySelector("img")?.src || "";
    const caption = item.getAttribute("data-caption") || "";
    const alt = item.querySelector("img")?.getAttribute("alt") || caption;

    if (lightboxImg) {
      lightboxImg.src = src;
      lightboxImg.alt = alt;
    }
    if (lightboxCaption) lightboxCaption.textContent = caption;
    if (lightboxCount) {
      lightboxCount.textContent =
        String(lightboxIndex + 1).padStart(2, "0") +
        " / " +
        String(lightboxItems.length).padStart(2, "0");
    }
  }

  function openLightbox(index) {
    if (!lightbox || lightbox.open) return;
    renderLightbox(index);
    lightbox.showModal();
    syncDialogLock();
  }

  lightboxItems.forEach((item, index) => {
    item.addEventListener("click", () => openLightbox(index));
  });

  if (lightbox) {
    $("[data-lightbox-close]", lightbox)?.addEventListener("click", () => lightbox.close());
    $("[data-lightbox-prev]", lightbox)?.addEventListener("click", () => renderLightbox(lightboxIndex - 1));
    $("[data-lightbox-next]", lightbox)?.addEventListener("click", () => renderLightbox(lightboxIndex + 1));

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });

    lightbox.addEventListener("close", () => {
      syncDialogLock();
      lightboxItems[lightboxIndex]?.focus({ preventScroll: true });
    });

    document.addEventListener("keydown", (event) => {
      if (!lightbox.open) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        renderLightbox(lightboxIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        renderLightbox(lightboxIndex + 1);
      }
    });
  }

  /* -------------------------------------------------------
     Form dialog
     ------------------------------------------------------- */
  const formDialog = $("#form-dialog");
  const formFrame = formDialog ? $("iframe", formDialog) : null;

  function openFormDialog() {
    if (!formDialog) {
      window.open("https://form.jotform.com/253012160367447", "_blank", "noopener");
      return;
    }
    if (formDialog.open) return;
    if (formFrame && !formFrame.getAttribute("src")) {
      formFrame.src = formFrame.getAttribute("data-src");
    }
    formDialog.showModal();
    syncDialogLock();
    $("[data-form-close]", formDialog)?.focus();
  }

  function closeFormDialog() {
    if (formDialog && formDialog.open) formDialog.close();
  }

  $$("[data-form-open]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openFormDialog();
    });
  });

  if (formDialog) {
    $("[data-form-close]", formDialog)?.addEventListener("click", closeFormDialog);
    formDialog.addEventListener("click", (event) => {
      if (event.target === formDialog) formDialog.close();
    });
    formDialog.addEventListener("close", syncDialogLock);
  }

  if (window.location.hash === "#form") {
    window.setTimeout(openFormDialog, 650);
  }

  /* -------------------------------------------------------
     Year
     ------------------------------------------------------- */
  $$("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* -------------------------------------------------------
     Motion system: no GSAP = complete static experience
     ------------------------------------------------------- */
  if (!hasGSAP || reduceMotion) {
    document.body.classList.add("motion-off");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  /* Hero entrance */
  const heroLetters = $$(".hero__letter > span");
  const heroFade = $$("[data-hero-fade]");
  const heroPhotos = $$("[data-hero-photo]");
  const heroCopyItems = $$("[data-hero-copy] > *");
  const heroMain = $(".hero__photo--main");
  const heroSmall = $(".hero__photo--small");
  const heroSeal = $(".hero__seal");

  gsap.set(heroLetters, { yPercent: 118 });
  gsap.set(heroFade, { y: 14, opacity: 0 });
  if (heroMain) gsap.set(heroMain, { clipPath: "inset(100% 0 0 0)" });
  if (heroSmall) gsap.set(heroSmall, { opacity: 0, y: 30 });
  if (heroSeal) gsap.set(heroSeal, { opacity: 0, scale: 0.8 });
  gsap.set(heroCopyItems, { y: 22, opacity: 0 });

  const heroTl = gsap.timeline({
    defaults: { ease: "power4.out" },
    delay: 0.15
  });

  heroTl
    .to(heroFade, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 })
    .to(heroLetters, { yPercent: 0, duration: 1.1, stagger: 0.065 }, "-=0.45")
    .to(heroMain, { clipPath: "inset(0% 0 0 0)", duration: 1.25, ease: "power3.inOut" }, "-=0.95")
    .to(heroSmall, { opacity: 1, y: 0, duration: 0.9 }, "-=0.65")
    .to(heroSeal, { opacity: 1, scale: 1, duration: 0.8 }, "-=0.7")
    .to(heroCopyItems, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, "-=0.65");

  /* Hero parallax */
  gsap.to(".hero__title", {
    yPercent: -9,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  if (heroMain) {
    gsap.to(heroMain, {
      y: -74,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }
  if (heroSmall) {
    gsap.to(heroSmall, {
      y: 58,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }
  gsap.to(".hero__star", {
    rotate: 24,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  /* Section heading line reveals */
  $$("[data-lines]").forEach((heading) => {
    const lines = $$(".line > span", heading);
    gsap.from(lines, {
      yPercent: 112,
      duration: 1.05,
      ease: "power4.out",
      stagger: 0.09,
      scrollTrigger: { trigger: heading, start: "top 88%", once: true }
    });
  });

  /* Generic reveals */
  $$("[data-reveal]").forEach((el) => {
    if (el.matches('[data-reveal="photo"]')) {
      gsap.fromTo(
        el,
        { clipPath: "inset(0 0 100% 0)", opacity: 0.001 },
        {
          clipPath: "inset(0 0 0% 0)",
          opacity: 1,
          duration: 1.1,
          ease: "power3.inOut",
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        }
      );
      const img = el.querySelector("img");
      if (img) {
        gsap.fromTo(
          img,
          { scale: 1.12 },
          {
            scale: 1,
            duration: 1.35,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true }
          }
        );
      }
    } else {
      gsap.from(el, {
        y: 34,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    }
  });

  /* Staggered grids */
  const batchTargets = [
    [".pillar", ".about__pillars"],
    [".role", ".members__roles"]
  ];
  batchTargets.forEach(([item, parent]) => {
    const parentEl = $(parent);
    if (!parentEl) return;
    gsap.from($$(item, parentEl), {
      y: 40,
      opacity: 0,
      duration: 0.85,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: parentEl, start: "top 82%", once: true }
    });
  });

  /* Collage parallax */
  $$("[data-parallax]").forEach((el) => {
    const speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
    gsap.to(el, {
      y: -120 * speed,
      ease: "none",
      scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* Counters */
  $$("[data-count]").forEach((el) => {
    const end = Number(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const state = { value: 0 };
    const render = () => {
      const value = Math.round(state.value);
      el.textContent = value >= 1000
        ? (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(".", ",") + "K" + suffix
        : value + suffix;
    };
    ScrollTrigger.create({
      trigger: el,
      start: "top 92%",
      once: true,
      onEnter: () => {
        gsap.to(state, {
          value: end,
          duration: 1.5,
          ease: "power2.out",
          onUpdate: render
        });
      }
    });
  });

  /* Horizontal pinned scenes */
  function pinHorizontal(selector, options) {
    const section = $(selector);
    if (!section) return null;
    const viewport = $(options.viewport, section);
    const track = $(options.track, section);
    const bar = options.bar ? $(options.bar, section) : null;
    if (!viewport || !track) return null;

    const getDistance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    if (getDistance() < 40) return null;

    const tween = gsap.to(track, {
      x: () => -getDistance(),
      ease: "none",
      scrollTrigger: {
        trigger: viewport,
        start: options.start || "top 10%",
        end: () => "+=" + Math.max(getDistance(), window.innerHeight * 0.65),
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (bar) bar.style.transform = "scaleX(" + self.progress.toFixed(4) + ")";
        }
      }
    });

    return tween;
  }

  mm.add("(min-width: 901px)", () => {
    const tweens = [
      pinHorizontal(".members", {
        viewport: ".members__viewport",
        track: ".members__track",
        bar: ".h-scroll span",
        start: "top 9%"
      }),
      pinHorizontal(".program", {
        viewport: ".program__viewport",
        track: ".program__track",
        bar: ".h-scroll span",
        start: "top 7%"
      }),
      pinHorizontal(".gallery", {
        viewport: ".gallery__viewport",
        track: ".gallery__track",
        bar: ".h-scroll span",
        start: "top 9%"
      })
    ].filter(Boolean);

    return () => {
      tweens.forEach((tween) => {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
      });
    };
  });

  /* Footer wordmark */
  gsap.from(".footer__word", {
    yPercent: 26,
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: ".footer", start: "top 78%", end: "bottom bottom", scrub: true }
  });

  /* Progress line */
  gsap.to(".progress__bar", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: {
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.3
    }
  });

  /* Refresh after images and fonts settle */
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener("load", refresh, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.setTimeout(refresh, 1200);

  /* Deep links: the browser can land before pin spacers settle. Correct once,
     natively, then let Lenis sync from the real scroll position. */
  let hashUserInteracted = false;
  ["wheel", "touchstart", "pointerdown", "keydown"].forEach((type) => {
    window.addEventListener(type, () => { hashUserInteracted = true; }, { passive: true, once: true });
  });

  function goToInitialHash() {
    const hash = window.location.hash;
    if (!hash || hash === "#form" || hashUserInteracted) return;
    const target = document.querySelector(hash);
    if (!target) return;
    const rectTop = target.getBoundingClientRect().top;
    if (Math.abs(rectTop - 96) <= 4) return;
    const top = Math.max(0, rectTop + window.scrollY - 96);
    window.scrollTo({ top, behavior: "auto" });
  }

  window.addEventListener("load", () => {
    window.setTimeout(goToInitialHash, 150);
  }, { once: true });
  window.setTimeout(goToInitialHash, 1500);

})();
