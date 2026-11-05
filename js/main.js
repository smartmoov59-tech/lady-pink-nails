/* ==========================================================================
   LADY PINK NAILS MONIA — animations (GSAP + ScrollTrigger + Lenis) & réservation
   Site 100 % statique : aucun serveur, aucune base de données, aucun service tiers.
   La réservation génère un SMS pré-rempli (sms:), un appel (tel:) et un fichier .ics.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  CONFIGURATION — à modifier ici si les infos de Monia changent
   * ------------------------------------------------------------------ */
  const PHONE = '+33782961384';
  const PHONE_LABEL = '07 82 96 13 84';
  const ADDRESS = 'Impasse des Chenevières, Chemin des Basses Sieyès, 04000 Digne-les-Bains';
  // Horaires par jour (0 = dimanche … 6 = samedi) : [ouverture, fermeture] | null = fermé | 'ask' = sur demande
  const HOURS = { 0: null, 1: [9, 19], 2: [9, 19], 3: 'ask', 4: [9, 19], 5: [9, 17], 6: [9, 16] };
  const LAST_START_BEFORE_CLOSE = 2;   // dernier créneau proposé = fermeture - 2 h
  const DAYS_AHEAD = 28;               // nombre de jours proposés dans le formulaire

  /* ------------------------------------------------------------------ *
   *  Helpers
   * ------------------------------------------------------------------ */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const root = document.documentElement;
  const body = document.body;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const fmtEUR = n => `${n} €`;
  const pad = n => String(n).padStart(2, '0');

  let lenis = null;
  let menuOpen = false;

  function toast(msg, ms = 3800) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-on'), ms);
  }

  /* Découpe un titre en mots (masque qui monte), en conservant <em> */
  function splitWords(el) {
    const words = [];
    const walk = (node, parent) => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) {
          ch.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { parent.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'sw'; w.setAttribute('aria-hidden', 'true');
            const i = document.createElement('span'); i.className = 'swi'; i.textContent = p;
            w.appendChild(i); parent.appendChild(w); words.push(i);
          });
        } else if (ch.nodeType === 1) {
          const clone = ch.cloneNode(false); parent.appendChild(clone); walk(ch, clone);
        }
      });
    };
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    const frag = document.createDocumentFragment();
    walk(el, frag);
    el.textContent = '';
    el.appendChild(frag);
    el.setAttribute('aria-label', label);
    return words;
  }

  /* Gouttes de vernis (séparateurs) générées aléatoirement */
  function buildDrips() {
    $$('.drips svg').forEach((svg, k) => {
      const W = 1200, base = 24;
      let x = 0, seed = k * 11 + 5, d = `M0 0V${base}`;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      while (x < W) {
        x += 26 + rnd() * 80;
        if (x > W - 40) break;
        const w = 12 + rnd() * 22, L = 20 + rnd() * 70;
        d += `H${x.toFixed(1)}V${(base + L - w / 2).toFixed(1)}a${(w / 2).toFixed(1)} ${(w / 2).toFixed(1)} 0 0 0 ${w.toFixed(1)} 0V${base}`;
        x += w;
      }
      d += `H${W}V0Z`;
      svg.querySelector('path').setAttribute('d', d);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Smooth scroll (Lenis) + ancres
   * ------------------------------------------------------------------ */
  function initScroll() {
    if (hasGSAP) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
    }
    if (!reduced && typeof window.Lenis !== 'undefined' && hasGSAP) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }
    $$('textarea, .dates').forEach(el => el.setAttribute('data-lenis-prevent', ''));

    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      scrollToEl(target);
    });
  }

  function scrollToEl(target, offset = 0) {
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------ *
   *  Loader : un ongle amande qui se remplit de vernis
   * ------------------------------------------------------------------ */
  function finishLoader() {
    const loader = $('#loader');
    if (loader) loader.style.display = 'none';
    body.classList.remove('is-loading');
    if (lenis) lenis.start();
    if (hasGSAP) ScrollTrigger.refresh();
  }

  function runLoader(onOpen) {
    const loader = $('#loader');
    if (!loader) { onOpen(); return; }
    if (reduced || !hasGSAP) { onOpen(); finishLoader(); return; }

    const len = $('#almondPath').getTotalLength();
    const count = { v: 0 };
    const cEl = $('#loaderCount');
    gsap.set('.loader__fill', { y: 160 });
    gsap.set('.loader__stroke', { strokeDasharray: len, strokeDashoffset: len });
    gsap.set('.loader__word, .loader__sub, .loader__count', { opacity: 0, y: 18 });

    const tl = gsap.timeline({ onComplete: finishLoader });
    tl.to('.loader__stroke', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0)
      .to('.loader__word, .loader__sub, .loader__count', { opacity: 1, y: 0, duration: .8, stagger: .12, ease: 'power3.out' }, .2)
      .to('.loader__fill', { y: 0, duration: 1.7, ease: 'power2.inOut' }, .3)
      .to(count, { v: 100, duration: 1.8, ease: 'power2.inOut', onUpdate: () => { cEl.textContent = Math.round(count.v); } }, .3)
      .to('.loader__center', { scale: 1.35, opacity: 0, duration: .8, ease: 'power3.in' }, '+=.15')
      .to('.loader__panel--top', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '<.1')
      .to('.loader__panel--bottom', { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
      .add(onOpen, '<.35');
    // sécurité : le loader ne doit jamais bloquer le site
    setTimeout(() => { if (body.classList.contains('is-loading')) { tl.progress(1); } }, 7000);
  }

  /* ------------------------------------------------------------------ *
   *  Hero : intro + parallax multicouche
   * ------------------------------------------------------------------ */
  function prepHero() {
    if (reduced || !hasGSAP) return;
    gsap.set('[data-hero="line"]', { yPercent: 115 });
    gsap.set('[data-hero="in"]', { y: 36, opacity: 0 });
    gsap.set('[data-hero="badge"]', { scale: .4, opacity: 0, rotate: -40 });
    gsap.set('.hero__photos .almond-frame', { opacity: 0, scale: .9 });
    gsap.set('.hero__photos img', { scale: 1.45 });
    gsap.set('.hero__float, .hero__spark', { opacity: 0, scale: .4 });
    gsap.set('#heroEdge', { yPercent: 100 });
  }

  function heroIntro() {
    if (reduced || !hasGSAP) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('[data-hero="line"]', { yPercent: 0, duration: 1.5, stagger: .12 }, 0)
      .to('[data-hero="in"]', { y: 0, opacity: 1, duration: 1.1, stagger: .1, ease: 'power3.out' }, .45)
      .to('.hero__photos .almond-frame', { opacity: 1, scale: 1, duration: 1.6, stagger: .18 }, .3)
      .to('.hero__photos img', { scale: 1, duration: 2.2, stagger: .18 }, .3)
      .to('[data-hero="badge"]', { scale: 1, opacity: 1, rotate: 0, duration: 1.4, ease: 'back.out(1.6)' }, .9)
      .to('.hero__float, .hero__spark', { opacity: (i, el) => el.classList.contains('hero__float') ? .9 : .9, scale: 1, duration: 1.4, stagger: .08, ease: 'back.out(2)' }, .6)
      .to('#heroEdge', { yPercent: 0, duration: 1.4 }, .5);
    gsap.fromTo('#heroVideo', { scale: 1.18 }, { scale: 1.02, duration: 3.2, ease: 'power2.out' });
  }

  function initHeroScroll() {
    const hero = $('#top');
    const video = $('#heroVideo');
    if (reduced) { video.removeAttribute('autoplay'); video.pause(); return; }
    video.play().catch(() => { /* le poster reste affiché */ });
    if (!hasGSAP) return;

    const scrub = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('#heroMedia', { yPercent: 14, ease: 'none', scrollTrigger: scrub });
    gsap.to('#heroGiant', { xPercent: -14, yPercent: 20, ease: 'none', scrollTrigger: scrub });
    gsap.to('.hero__content', { yPercent: -10, opacity: .0, ease: 'none', scrollTrigger: { ...scrub, start: '35% top' } });
    $$('[data-depth]', hero).forEach(el => {
      const depth = parseFloat(el.dataset.depth);
      gsap.to(el, { yPercent: depth * 0.9, ease: 'none', scrollTrigger: scrub });
    });

    // Parallax souris (bureau)
    if (finePointer) {
      const items = $$('[data-depth]', hero).map(el => ({
        depth: parseFloat(el.dataset.depth),
        x: gsap.quickTo(el, 'x', { duration: 1.1, ease: 'power3.out' }),
        y: gsap.quickTo(el, 'y', { duration: 1.1, ease: 'power3.out' })
      }));
      hero.addEventListener('pointermove', e => {
        const nx = (e.clientX / window.innerWidth - .5) * 2;
        const ny = (e.clientY / window.innerHeight - .5) * 2;
        items.forEach(it => { it.x(nx * it.depth * .45); it.y(ny * it.depth * .3); });
      });
    }
    // Flottement doux des ongles décoratifs
    $$('.hero__float').forEach((el, i) => {
      gsap.to(el.firstElementChild, { rotate: i % 2 ? 14 : -14, duration: 3.2 + i, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
  }

  /* ------------------------------------------------------------------ *
   *  Navigation (masquée en descendant), progression, menu plein écran
   * ------------------------------------------------------------------ */
  function openMenu() {
    menuOpen = true;
    const nav = $('#nav'), menu = $('#menuFull'), burger = $('#burger');
    nav.classList.add('is-open'); nav.classList.remove('is-hidden');
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu');
    menu.setAttribute('aria-hidden', 'false');
    menu.style.visibility = 'visible';
    if (lenis) lenis.stop(); else body.style.overflow = 'hidden';
    if (hasGSAP && !reduced) {
      gsap.to(menu, { clipPath: 'circle(150% at calc(100% - 3rem) 2.7rem)', duration: 1.1, ease: 'expo.inOut' });
      gsap.fromTo('#menuFull .big', { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: .06, ease: 'expo.out', delay: .35 });
      gsap.fromTo('.menu-full__foot', { opacity: 0 }, { opacity: 1, duration: .8, delay: .8 });
    } else { menu.style.clipPath = 'none'; }
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    const nav = $('#nav'), menu = $('#menuFull'), burger = $('#burger');
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start(); else body.style.overflow = '';
    if (hasGSAP && !reduced) {
      gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 3rem) 2.7rem)', duration: .8, ease: 'expo.inOut', onComplete: () => { menu.style.visibility = 'hidden'; } });
    } else { menu.style.visibility = 'hidden'; }
  }

  function initNav() {
    const nav = $('#nav');
    $('#burger').addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    $('#toTop').addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 2 }) : window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })));

    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      nav.classList.toggle('is-solid', y > 60);
      if (!menuOpen) {
        if (y > 220 && y > lastY + 4) nav.classList.add('is-hidden');
        else if (y < lastY - 4 || y < 220) nav.classList.remove('is-hidden');
      }
      lastY = y;
      const p = Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
      $('#progress').style.transform = `scaleX(${p})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // barre d'action mobile (affichée après le hero)
    const dock = $('#dock');
    if ('IntersectionObserver' in window) {
      let pastHero = false, inBooking = false;
      const sync = () => dock.classList.toggle('is-on', pastHero && !inBooking);
      new IntersectionObserver(([en]) => { pastHero = !en.isIntersecting; sync(); }, { threshold: 0.05 }).observe($('#top'));
      new IntersectionObserver(([en]) => { inBooking = en.isIntersecting; sync(); }, { threshold: 0.12 }).observe($('#reserver'));
    }
  }

  /* ------------------------------------------------------------------ *
   *  Curseur, boutons magnétiques
   * ------------------------------------------------------------------ */
  function initCursor() {
    if (!finePointer || reduced || !hasGSAP) return;
    root.classList.add('has-cursor');
    const c = $('#cursor');
    const ring = $('.cursor__ring', c), dot = $('.cursor__dot', c);
    const rx = gsap.quickTo(ring, 'x', { duration: .45, ease: 'power3.out' });
    const ry = gsap.quickTo(ring, 'y', { duration: .45, ease: 'power3.out' });
    const dx = gsap.quickTo(dot, 'x', { duration: .08 });
    const dy = gsap.quickTo(dot, 'y', { duration: .08 });
    window.addEventListener('pointermove', e => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', e => {
      const t = e.target;
      c.classList.toggle('is-view', !!t.closest('.gitem'));
      c.classList.toggle('is-hover', !!t.closest('a, button, input, textarea, label, [data-tilt]') && !t.closest('.gitem'));
    });
  }

  function initMagnetic() {
    if (!finePointer || reduced || !hasGSAP) return;
    $$('[data-magnetic]').forEach(el => {
      const mx = gsap.quickTo(el, 'x', { duration: .9, ease: 'elastic.out(1, .45)' });
      const my = gsap.quickTo(el, 'y', { duration: .9, ease: 'elastic.out(1, .45)' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * .32);
        my((e.clientY - (r.top + r.height / 2)) * .42);
      });
      el.addEventListener('pointerleave', () => { mx(0); my(0); });
    });
  }

  function initTilt() {
    if (!finePointer || reduced || !hasGSAP) return;
    const bind = (el, max, glareEl) => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - .5) * max * 2); rx(-(py - .5) * max * 2);
        el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    };
    $$('[data-tilt]').forEach(c => bind(c, 9));
    $$('.gitem').forEach(c => bind(c, 5));
  }

  /* ------------------------------------------------------------------ *
   *  Révélations génériques, titres, manifeste, rubans, compteurs
   * ------------------------------------------------------------------ */
  function initReveals() {
    if (reduced || !hasGSAP) return;
    $$('[data-split]').forEach(el => {
      const words = splitWords(el);
      gsap.from(words, { yPercent: 118, duration: 1.2, ease: 'expo.out', stagger: .055, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-reveal]').forEach(el => {
      gsap.from(el, { y: 44, opacity: 0, duration: 1.1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });

    // Manifeste : les mots s'allument au fil du scroll
    const m = $('[data-manifesto]');
    if (m) {
      const words = splitWords(m);
      words.forEach(w => { w.style.opacity = .14; });
      gsap.to(words, { opacity: 1, ease: 'none', stagger: .12, scrollTrigger: { trigger: m, start: 'top 82%', end: 'bottom 52%', scrub: .5 } });
    }

    // Gouttes de vernis
    $$('.drips').forEach(d => {
      gsap.fromTo(d, { scaleY: .1 }, { scaleY: 1, duration: 2, ease: 'elastic.out(1, .6)', scrollTrigger: { trigger: d.parentElement, start: 'top 85%', once: true } });
    });

    // Compteurs
    $$('[data-count]').forEach(el => {
      const to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.decimals || '0', 10);
      const o = { v: 0 };
      el.textContent = (0).toFixed(dec).replace('.', ',');
      gsap.to(o, {
        v: to, duration: 2.4, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: () => { el.textContent = o.v.toFixed(dec).replace('.', ','); }
      });
    });

    // Pied de page : lettres géantes
    const giant = $('#footerGiant');
    if (giant) {
      const txt = giant.textContent; giant.textContent = '';
      const chars = Array.from(txt).map(ch => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch === ' ' ? '\u00A0' : ch; giant.appendChild(s); return s; });
      gsap.from(chars, { yPercent: 115, duration: 1.5, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: giant, start: 'top 95%', once: true } });
    }
  }

  function initRibbons() {
    if (reduced || !hasGSAP) return;
    const tweens = [];
    let boost = 1, dir = 1;
    const build = () => {
      tweens.splice(0).forEach(t => t.kill());
      $$('[data-ribbon]').forEach(r => {
        $$('.item', r).slice(1).forEach(n => n.remove());
        const base = r.firstElementChild;
        const w = base.offsetWidth;
        const copies = Math.ceil((window.innerWidth * 1.3) / w) + 1;
        for (let i = 0; i < copies; i++) r.appendChild(base.cloneNode(true));
        const d = parseInt(r.dataset.ribbon, 10);
        tweens.push(gsap.fromTo(r, { x: d < 0 ? 0 : -w }, { x: d < 0 ? -w : 0, duration: w / 90, ease: 'none', repeat: -1 }));
      });
    };
    build();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 300); });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: self => { boost = Math.min(1 + Math.abs(self.getVelocity()) / 220, 7); dir = self.direction || dir; } });
    gsap.ticker.add(() => { boost += (1 - boost) * .06; tweens.forEach(t => t.timeScale(boost * dir)); });
  }

  /* ------------------------------------------------------------------ *
   *  Sections épinglées & défilement horizontal (bureau uniquement)
   * ------------------------------------------------------------------ */
  function initPinned() {
    if (reduced || !hasGSAP) return;
    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      /* --- Le geste : storytelling pas à pas --- */
      const steps = $$('.step');
      const dots = $$('#storyDots li');
      const video = $('#stepVideo');
      const n = steps.length;
      gsap.set(steps.slice(1), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: '#storyPin', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 3.4),
          pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: self => {
            const idx = Math.min(n - 1, Math.floor(self.progress * n * .999));
            dots.forEach((d, i) => d.classList.toggle('is-on', i === idx));
            if (video) { if (idx === 2) video.play().catch(() => {}); else video.pause(); }
          }
        }
      });
      steps.forEach((s, i) => {
        const media = s.querySelector('.step__media > *');
        const num = s.querySelector('.step__num');
        const t0 = i === 0 ? 0 : i - .2;
        if (i > 0) {
          tl.to(steps[i - 1], { autoAlpha: 0, yPercent: -7, duration: .4 }, i - .4);
          tl.fromTo(s, { autoAlpha: 0, yPercent: 8 }, { autoAlpha: 1, yPercent: 0, duration: .45 }, t0);
          tl.fromTo(num, { xPercent: -18 }, { xPercent: 0, duration: .6 }, t0);
        }
        tl.fromTo(media, { scale: 1.3 }, { scale: 1, duration: 1.05, ease: 'none' }, i === 0 ? 0 : t0);
      });
      tl.to({}, { duration: .5 });
      tl.fromTo('#storyBar', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);

      /* --- La carte : défilement horizontal piloté par le scroll --- */
      const track = $('#menuTrack');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tw = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '#menuPin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: s => { $('#menuBar').style.transform = `scaleX(${s.progress})`; }
        }
      });
      $$('.card').forEach(c => {
        gsap.from(c, { y: 90, rotate: 4, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: c, containerAnimation: tw, start: 'left 96%', toggleActions: 'play none none reverse' } });
      });
      return () => { if (video) video.pause(); };
    });

    mm.add('(max-width: 899px)', () => {
      // Mobile : pas d'épinglage, simples apparitions
      $$('.step').forEach(s => gsap.from(s, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } }));
      const v = $('#stepVideo');
      if (v && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => { en.isIntersecting ? v.play().catch(() => {}) : v.pause(); }, { threshold: .3 }).observe(v);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Carte du nail art : survol = photo, clic = ajout à la demande
   * ------------------------------------------------------------------ */
  const booking = { service: null, extras: new Set(), date: null, time: null, flex: false };
  let SERVICES = [], EXTRAS = [];
  const NO_NAILART = ['depose', 'russe', 'atelier'];   // prestations sans supplément nail art
  const wiz = { step: 1 };
  const LAST_STEP = 5;
  const skipNailArt = () => NO_NAILART.includes(booking.service);
  const isAtelier = () => booking.service === 'atelier';

  function initNailArt() {
    const imgs = $$('#artFrame img');
    const cap = $('#artCap');
    const show = btn => {
      const i = parseInt(btn.dataset.img, 10);
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
      cap.textContent = btn.dataset.cap.replace(/&amp;/g, '&');
    };
    $$('.art__item').forEach(btn => {
      btn.addEventListener('pointerenter', () => show(btn));
      btn.addEventListener('focus', () => show(btn));
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') !== 'true';
        setExtra(btn.dataset.extra, on);
        show(btn);
      });
    });
    if (!reduced && hasGSAP) {
      gsap.from('.art__item', { y: 30, opacity: 0, duration: .9, ease: 'power3.out', stagger: .05, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.art__list', start: 'top 80%', once: true } });
    }
  }

  function setExtra(id, on) {
    if (on && skipNailArt()) toast('Le nail art s’ajoute à une pose : première pose, remplissage ou pose pieds.');
    if (on) booking.extras.add(id); else booking.extras.delete(id);
    const item = $(`.art__item[data-extra="${id}"]`);
    if (item) item.setAttribute('aria-pressed', on ? 'true' : 'false');
    const chip = $(`#optsExtra input[value="${id}"]`);
    if (chip) chip.checked = on;
    updateRecap();
  }

  /* Choix d'une prestation (formulaire ou bouton « Choisir » d'une carte) */
  function selectService(id, jump) {
    const wasAtelier = isAtelier();
    booking.service = id;
    const input = $(`#optsService input[value="${id}"]`);
    if (input) input.checked = true;
    if (wasAtelier !== isAtelier()) { booking.time = null; booking.flex = false; }   // les créneaux ne sont pas les mêmes
    applyServiceMode();
    updateRecap();
    if (jump) {
      setStep(skipNailArt() ? 3 : 2, { focus: false });
      scrollToEl($('#bframe'), -92);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Réservation guidée en 5 étapes -> SMS pré-rempli / .ics / copie
   * ------------------------------------------------------------------ */
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dayShort = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const monthShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const priceText = o => (o.min === o.max ? `${o.min} €` : `${o.min} à ${o.max} €`);
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hLabel = h => `${h}h00`;

  function initBooking() {
    SERVICES = $$('[data-service]').map(c => ({
      id: c.dataset.service, label: c.dataset.label, min: +c.dataset.min, max: +c.dataset.max,
      tag: (c.querySelector('.card__tag') || {}).textContent || '',
      photo: (() => { const im = c.querySelector('.card__photo img'); return im ? im.getAttribute('src') : ''; })()
    }));
    EXTRAS = $$('.art__item[data-extra]').map(b => ({ id: b.dataset.extra, label: b.dataset.label, min: +b.dataset.min, max: +b.dataset.max }));

    // Étape 1 : prestations (avec vignette photo)
    $('#optsService').innerHTML = SERVICES.map(s => `
      <label class="opt"><input type="radio" name="service" value="${s.id}"><span class="opt__box">
        <span class="opt__thumb">${s.photo ? `<img src="${s.photo}" alt="" loading="lazy" width="64" height="64">` : ''}</span>
        <b>${s.label}<small>${s.tag}</small></b><i>${s.id === 'atelier' ? 'sur devis' : fmtEUR(s.min)}</i></span></label>`).join('');
    $('#optsService').addEventListener('change', e => { if (e.target.name === 'service') selectService(e.target.value, false); });
    $$('[data-pick]').forEach(b => b.addEventListener('click', () => selectService(b.dataset.pick, true)));

    // Étape 2 : nail art
    $('#optsExtra').innerHTML = EXTRAS.map(x => `
      <label class="chip"><input type="checkbox" value="${x.id}"><span>${x.label} <em>+${x.min === x.max ? x.min : x.min + '–' + x.max} €</em></span></label>`).join('');
    $('#optsExtra').addEventListener('change', e => { if (e.target.type === 'checkbox') setExtra(e.target.value, e.target.checked); });

    // Étape 3 : jours
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const wrap = $('#dates');
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'day'; b.dataset.date = toISO(d); b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<small>${dayShort[d.getDay()]}</small><b>${d.getDate()}</b><em>${monthShort[d.getMonth()]}</em>`;
      wrap.appendChild(b);
    }
    wrap.addEventListener('click', e => {
      const b = e.target.closest('.day'); if (!b || b.disabled) return;
      $$('.day', wrap).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      booking.date = b.dataset.date; booking.time = null; booking.flex = false;
      buildSlots();
      updateRecap();
    });
    $('#slots').addEventListener('click', e => {
      const b = e.target.closest('.slot'); if (!b) return;
      $$('.slot').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      booking.flex = b.dataset.flex === '1';
      booking.time = booking.flex ? null : parseInt(b.dataset.h, 10);
      updateRecap();
    });

    // Étape 4 : coordonnées
    ['fName', 'fPhone', 'fNote', 'fFormule', 'fKids'].forEach(id => { const el = $('#' + id); el.addEventListener('input', () => { el.removeAttribute('aria-invalid'); updateRecap(); }); el.addEventListener('change', updateRecap); });

    // Navigation entre les étapes
    const form = $('#bookForm');
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && wiz.step < LAST_STEP) { e.preventDefault(); goNext(); } });
    $('#bNext').addEventListener('click', goNext);
    $('#bBack').addEventListener('click', goBack);
    $('#bsteps').addEventListener('click', e => {
      const b = e.target.closest('.bstep'); if (!b || b.disabled) return;
      const k = parseInt(b.dataset.go, 10);
      if (k === wiz.step) return;
      if (!reachable(k)) { showStepMiss(firstInvalid(k)); return; }
      setStep(k, { focus: true });
    });

    // Étape 5 : envoi
    $('#btnSms').addEventListener('click', e => {
      const miss = missing();
      if (miss.length) { e.preventDefault(); toast(`Il manque : ${miss.join(', ')}`); return; }
      if (!isMobileUA) { copyText(buildMessage(), true); toast(`Message copié. Si aucune messagerie ne s'ouvre, collez-le dans un SMS au ${PHONE_LABEL}.`, 6500); }
      else toast('Votre messagerie s’ouvre : il ne reste qu’à appuyer sur « Envoyer ».', 5000);
    });
    $('#btnCopy').addEventListener('click', () => { copyText(buildMessage(), false); toast(`Message copié : collez-le dans un SMS au ${PHONE_LABEL}.`); });
    $('#btnIcs').addEventListener('click', downloadICS);

    // Atelier anniversaire (section dédiée)
    $('#partyBtn').addEventListener('click', e => {
      confettiBurst(e.clientX, e.clientY);
      setTimeout(() => selectService('atelier', true), 650);
    });

    applyServiceMode();
    updateRecap();
  }

  /* Adapte les jours / créneaux / champs à la prestation choisie */
  function applyServiceMode() {
    const atelier = isAtelier();
    $$('#dates .day').forEach(b => {
      const d = parseISO(b.dataset.date), h = HOURS[d.getDay()];
      const closed = h === null && !atelier;
      b.disabled = closed;
      b.classList.toggle('is-ask', h === 'ask' && !atelier);
      b.setAttribute('aria-label', `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}${closed ? ', fermé' : ''}${h === 'ask' && !atelier ? ', à confirmer' : ''}`);
      if (closed && booking.date === b.dataset.date) { booking.date = null; booking.time = null; booking.flex = false; b.setAttribute('aria-pressed', 'false'); }
    });
    if (booking.date) buildSlots(); else $('#slots').innerHTML = '<p class="slots__hint">Choisissez d’abord un jour.</p>';
    $('#bWhenHint').textContent = atelier
      ? 'Monia se déplace chez vous (Digne-les-Bains et 15 km autour). Indiquez le jour de la fête : elle vous confirme l’horaire et le tarif.'
      : 'Monia reçoit sur rendez-vous du lundi au samedi (dimanche fermé). Choisissez un jour, puis l’heure d’arrivée souhaitée.';
    $('#fAtelierWrap').hidden = !atelier;
    $('#bs3').textContent = atelier ? 'Quel jour est la fête ?' : 'Quand êtes-vous disponible ?';
  }

  function buildSlots() {
    const box = $('#slots');
    const d = parseISO(booking.date);
    const h = HOURS[d.getDay()];
    if (isAtelier()) {
      box.innerHTML = '<button type="button" class="slot slot--flex" data-flex="1" aria-pressed="false">Horaire à définir avec Monia (matin, après-midi, goûter…)</button>';
      return;
    }
    const [open, close] = h === 'ask' ? [9, 18] : h;
    let html = '';
    for (let t = open; t <= close - LAST_START_BEFORE_CLOSE; t++) html += `<button type="button" class="slot" data-h="${t}" aria-pressed="false">${hLabel(t)}</button>`;
    html += `<button type="button" class="slot slot--flex" data-flex="1" aria-pressed="false">Je suis flexible ce jour-là : Monia me propose l’horaire</button>`;
    if (h === 'ask') html = `<p class="slots__hint">Le mercredi, Monia confirme selon ses disponibilités.</p>` + html;
    box.innerHTML = html;
    // retrouve la sélection éventuelle
    const sel = booking.flex ? box.querySelector('[data-flex]') : (booking.time != null ? box.querySelector(`[data-h="${booking.time}"]`) : null);
    if (sel) sel.setAttribute('aria-pressed', 'true');
  }

  /* ---- Données dérivées ---- */
  function currentService() { return SERVICES.find(s => s.id === booking.service) || null; }
  function selectedExtras() { return skipNailArt() ? [] : EXTRAS.filter(x => booking.extras.has(x.id)); }

  function estimate() {
    const s = currentService();
    if (!s) return null;
    if (s.id === 'atelier') return { text: 'Sur devis', devis: true };
    const ex = selectedExtras();
    const min = s.min + ex.reduce((a, x) => a + x.min, 0);
    const max = s.max + ex.reduce((a, x) => a + x.max, 0);
    return { min, max, text: min === max ? fmtEUR(min) : `${min} – ${max} €` };
  }

  function whenLabel() {
    if (!booking.date) return null;
    const d = parseISO(booking.date);
    const base = `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
    if (booking.flex) return `${base} · ${isAtelier() ? 'horaire à définir ensemble' : 'horaire flexible'}`;
    if (booking.time != null) return `${base} à ${hLabel(booking.time)}`;
    return null;
  }

  function missingContact() {
    const m = [];
    if (!$('#fName').value.trim()) m.push('votre prénom');
    if ($('#fPhone').value.replace(/\D/g, '').length < 9) m.push('votre numéro');
    return m;
  }
  function missing() {
    const m = [];
    if (!booking.service) m.push('la prestation');
    if (!whenLabel()) m.push('le jour et l’heure');
    return m.concat(missingContact());
  }

  function buildMessage() {
    const s = currentService(), est = estimate(), ex = selectedExtras();
    const name = $('#fName').value.trim(), phone = $('#fPhone').value.trim(), note = $('#fNote').value.trim();
    const formule = $('#fFormule').value, kids = $('#fKids').value.trim();
    const lines = [
      `Bonjour Monia, c’est ${name}. Je souhaiterais ${isAtelier() ? 'des informations pour un atelier anniversaire' : 'prendre rendez-vous'} :`,
      `• Prestation : ${s.label}${s.id === 'atelier' ? '' : ' (' + priceText(s) + ')'}`,
      isAtelier() && formule ? `• Formule : ${formule}` : null,
      isAtelier() && kids ? `• Nombre d’enfants : ${kids}` : null,
      ex.length ? `• Nail art : ${ex.map(x => x.label).join(', ')}` : null,
      `• ${isAtelier() ? 'Jour de la fête' : 'Jour souhaité'} : ${whenLabel()}`,
      est && !est.devis ? `• Estimation : ${est.text}` : null,
      note ? `• Mon idée : ${note}` : null,
      `• Mon numéro : ${phone}`,
      isAtelier() ? 'Pouvez-vous me donner le tarif et vos disponibilités ? Merci !' : 'Pouvez-vous me confirmer le créneau ? Merci !'
    ];
    return lines.filter(Boolean).join('\n');
  }

  /* ---- Assistant : étapes ---- */
  const visibleSteps = () => [1, 2, 3, 4, 5].filter(n => !(n === 2 && skipNailArt()));
  function stepValid(n) {
    if (n === 1) return !!booking.service;
    if (n === 3) return !!whenLabel();
    if (n === 4) return missingContact().length === 0;
    return true;
  }
  function firstInvalid(upTo) { return visibleSteps().find(k => k < upTo && !stepValid(k)) || upTo; }
  function reachable(n) { return firstInvalid(n) === n || visibleSteps().filter(k => k < n).every(stepValid); }

  const STEP_MISS = {
    1: 'Choisissez une prestation pour continuer.',
    3: 'Choisissez un jour, puis une heure (ou « je suis flexible »).',
    4: ''
  };
  function showStepMiss(n) {
    let msg = STEP_MISS[n] || '';
    if (n === 4) {
      const m = missingContact(); msg = `Il manque : ${m.join(' et ')}.`;
      if (!$('#fName').value.trim()) $('#fName').setAttribute('aria-invalid', 'true');
      if ($('#fPhone').value.replace(/\D/g, '').length < 9) $('#fPhone').setAttribute('aria-invalid', 'true');
    }
    if (n !== wiz.step) { setStep(n, { focus: true }); }
    $('#rMiss').textContent = msg;
    shake($('#rMiss'));
  }

  function setStep(n, opts = {}) {
    if (n === 2 && skipNailArt()) n = wiz.step < 2 ? 3 : 1;
    if (!reachable(n)) return false;
    const prev = wiz.step;
    wiz.step = n;
    $$('.bpanel').forEach(p => {
      const on = parseInt(p.dataset.step, 10) === n;
      p.hidden = !on;
      p.classList.toggle('is-in', on && prev !== n && !reduced);
    });
    $('#rMiss').textContent = '';
    renderWizard();
    if (opts.focus) { const h = $('.bpanel:not([hidden]) h3'); if (h) h.focus({ preventScroll: true }); }
    if (prev !== n && $('#bframe').getBoundingClientRect().top < 40) scrollToEl($('#bframe'), -92);
    return true;
  }
  function goNext() {
    if (!stepValid(wiz.step)) { showStepMiss(wiz.step); return; }
    const vs = visibleSteps(), i = vs.indexOf(wiz.step);
    if (i < vs.length - 1) setStep(vs[i + 1], { focus: true });
  }
  function goBack() {
    const vs = visibleSteps(), i = vs.indexOf(wiz.step);
    if (i > 0) setStep(vs[i - 1], { focus: true });
  }

  function renderWizard() {
    const vs = visibleSteps(), idx = vs.indexOf(wiz.step);
    $$('.bstep').forEach(b => {
      const k = parseInt(b.dataset.go, 10);
      const skipped = k === 2 && skipNailArt();
      b.classList.toggle('is-current', k === wiz.step);
      b.classList.toggle('is-skip', skipped);
      b.classList.toggle('is-done', !skipped && k < wiz.step && stepValid(k));
      b.disabled = skipped || (k !== wiz.step && !reachable(k));
      if (k === wiz.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $('#bprog').style.transform = `scaleX(${vs.length > 1 ? idx / (vs.length - 1) : 1})`;
    $('#bNo').textContent = idx + 1; $('#bTotal').textContent = vs.length;
    const nxt = $('#bNext'), back = $('#bBack');
    back.hidden = idx === 0;
    nxt.hidden = wiz.step === LAST_STEP;
    nxt.firstElementChild.textContent = wiz.step === 4 ? 'Voir mon message' : (wiz.step === 2 ? 'Continuer' : 'Continuer');
    nxt.setAttribute('aria-disabled', stepValid(wiz.step) ? 'false' : 'true');
    $('#bSkipNote').hidden = !skipNailArt();
  }

  function updateRecap() {
    const s = currentService(), est = estimate(), ex = selectedExtras(), when = whenLabel();
    const set = (id, text, empty) => { const el = $(id); el.textContent = text; el.classList.toggle('is-empty', !!empty); };
    set('#rService', s ? `${s.label}${s.id === 'atelier' ? '' : ' · ' + priceText(s)}` : 'À choisir', !s);
    set('#rExtra', skipNailArt() && s ? 'Sans objet' : (ex.length ? ex.map(x => x.label).join(', ') : 'Aucun'), !ex.length);
    set('#rWhen', when || 'À choisir', !when);
    $('#rTotal').textContent = est ? est.text : '—';

    // résumé sous la carte du nail art
    const note = $('#artNoteTxt');
    const exAll = EXTRAS.filter(x => booking.extras.has(x.id));
    if (exAll.length) {
      const emin = exAll.reduce((a, x) => a + x.min, 0), emax = exAll.reduce((a, x) => a + x.max, 0);
      note.textContent = `${exAll.length} effet${exAll.length > 1 ? 's' : ''} · + ${emin === emax ? emin : emin + ' à ' + emax} €`;
    } else note.textContent = 'Aucun effet choisi';

    const miss = missing();
    const ready = miss.length === 0;
    const sms = $('#btnSms');
    sms.setAttribute('aria-disabled', ready ? 'false' : 'true');
    sms.href = ready ? `sms:${PHONE}?&body=${encodeURIComponent(buildMessage())}` : '#';
    $('#smsPreview').textContent = ready ? buildMessage() : 'Complétez les étapes précédentes pour voir votre message.';
    $('#btnCopy').disabled = !ready;
    $('#btnIcs').disabled = !(s && when);
    $('#btnIcs').hidden = isAtelier() && !when;
    $('#rMiss').textContent = '';
    renderWizard();
  }

  async function copyText(text, silent) {
    try { await navigator.clipboard.writeText(text); }
    catch (err) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } ta.remove();
    }
    return silent;
  }

  function downloadICS() {
    const s = currentService(); if (!s || !booking.date) return;
    const esc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const d = parseISO(booking.date);
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
    let start, end;
    if (booking.time != null) {
      start = `DTSTART:${ymd}T${pad(booking.time)}0000`;
      end = `DTEND:${ymd}T${pad(booking.time + 2)}0000`;
    } else {
      const n = new Date(d); n.setDate(d.getDate() + 1);
      start = `DTSTART;VALUE=DATE:${ymd}`;
      end = `DTEND;VALUE=DATE:${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}`;
    }
    const est = estimate();
    const ex = selectedExtras();
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lady Pink Nails Monia//Demande de RDV//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@ladypinknails`, `DTSTAMP:${stamp}`, start, end,
      `SUMMARY:${esc('Lady Pink Nails Monia · ' + s.label + ' (à confirmer)')}`,
      `LOCATION:${esc(ADDRESS)}`,
      `DESCRIPTION:${esc('Demande de rendez-vous à confirmer par Monia. Tél. ' + PHONE_LABEL + (ex.length ? '\nNail art : ' + ex.map(x => x.label).join(', ') : '') + (est && !est.devis ? '\nEstimation : ' + est.text : ''))}`,
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous chez Monia', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'rendez-vous-lady-pink-nails.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Fichier agenda téléchargé : pensez à attendre la confirmation de Monia.');
  }

  /* Confettis (ateliers anniversaire) */
  function confettiBurst(x, y) {
    if (reduced || !hasGSAP) return;
    const box = $('#confetti');
    const colors = ['#CF2A66', '#F4B3C3', '#E85A93', '#C08F6F', '#FFF6F2', '#2B0F1B'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      const kind = i % 3;
      p.style.background = colors[i % colors.length];
      if (kind === 0) { p.style.borderRadius = '50%'; p.style.width = p.style.height = (7 + Math.random() * 8) + 'px'; }
      else if (kind === 1) { p.style.borderRadius = '40% 40% 8% 8% / 60% 60% 8% 8%'; p.style.width = '9px'; p.style.height = '15px'; }
      else { p.style.clipPath = 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)'; p.style.width = p.style.height = (12 + Math.random() * 8) + 'px'; }
      p.style.left = x + 'px'; p.style.top = y + 'px';
      box.appendChild(p);
      const ang = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      gsap.timeline({ onComplete: () => p.remove() })
        .to(p, { x: Math.cos(ang) * v, y: Math.sin(ang) * v - 120, rotation: Math.random() * 720 - 360, duration: .9 + Math.random() * .5, ease: 'power3.out' })
        .to(p, { y: '+=' + (300 + Math.random() * 300), x: '+=' + (Math.random() * 80 - 40), opacity: 0, rotation: '+=240', duration: 1.4, ease: 'power1.in' }, '-=.15');
    }
  }

  /* ------------------------------------------------------------------ *
   *  Galerie : colonnes parallax, rideaux, lightbox
   * ------------------------------------------------------------------ */
  function initGallery() {
    const items = $$('.gitem');
    const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
    let idx = 0, lastFocus = null;
    const decode = s => s.replace(/&amp;/g, '&');
    const show = i => {
      idx = (i + items.length) % items.length;
      const it = items[idx], im = $('img', it);
      lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt; lbCap.textContent = decode(it.dataset.cap || '');
    };
    const open = i => {
      lastFocus = document.activeElement; show(i);
      lb.hidden = false; lb.classList.add('is-open');
      if (lenis) lenis.stop(); else body.style.overflow = 'hidden';
      $('#lbClose').focus();
      if (hasGSAP && !reduced) gsap.fromTo('.lightbox__fig', { scale: .92, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'expo.out' });
    };
    const close = () => {
      lb.classList.remove('is-open'); lb.hidden = true;
      if (lenis) lenis.start(); else body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    items.forEach((it, i) => it.addEventListener('click', () => open(i)));
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => show(idx - 1));
    $('#lbNext').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        const f = $$('button', lb); const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    if (reduced || !hasGSAP) { $$('.curtain').forEach(c => c.remove()); return; }

    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      $$('.gcol').forEach(col => {
        gsap.to(col, { y: parseFloat(col.dataset.speed), ease: 'none', scrollTrigger: { trigger: '#galCols', start: 'top bottom', end: 'bottom top', scrub: .6 } });
      });
    });
    items.forEach(it => {
      const inner = $('.in', it), img = $('img', it), cur = $('.curtain', it);
      gsap.fromTo(inner, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.timeline({ scrollTrigger: { trigger: it, start: 'top 90%', once: true } })
        .to(cur, { scaleY: 0, duration: 1.3, ease: 'expo.inOut' })
        .from(img, { scale: 1.35, duration: 1.8, ease: 'expo.out' }, 0);
    });
  }

  /* ------------------------------------------------------------------ *
   *  Avis : carrousel (scroll-snap + mise en avant de la carte centrale)
   * ------------------------------------------------------------------ */
  function initReviews() {
    const track = $('#revTrack'), cards = $$('.review', track), bar = $('#revBar');
    const update = () => {
      const tr = track.getBoundingClientRect(), mid = tr.left + tr.width / 2;
      cards.forEach(c => {
        const r = c.getBoundingClientRect();
        const d = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / (tr.width * .55));
        c.style.transform = reduced ? '' : `scale(${1 - d * .07})`;
        c.style.opacity = reduced ? '' : String(1 - d * .5);
      });
      const max = track.scrollWidth - track.clientWidth;
      bar.style.transform = `scaleX(${max > 0 ? Math.max(.12, track.scrollLeft / max) : 1})`;
    };
    let raf; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();

    const centerOf = c => c.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft + c.offsetWidth / 2 - track.clientWidth / 2;
    const go = dir => {
      const max = track.scrollWidth - track.clientWidth;
      const cur = track.scrollLeft;
      // carte la plus proche du centre -> on vise la suivante / précédente (boucle aux extrémités)
      let i = 0, best = Infinity;
      cards.forEach((c, k) => { const d = Math.abs(centerOf(c) - cur); if (d < best) { best = d; i = k; } });
      let k = i + dir;
      if (cur >= max - 8 && dir > 0) k = 0;
      else if (cur <= 8 && dir < 0) k = cards.length - 1;
      k = Math.max(0, Math.min(cards.length - 1, k));
      const left = Math.max(0, Math.min(max, centerOf(cards[k])));
      // la cible est une position d'accroche (centre d'une carte) : le défilement natif reste fluide
      track.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
    };
    $('#revPrev').addEventListener('click', () => go(-1));
    $('#revNext').addEventListener('click', () => go(1));
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });

    // glisser à la souris
    if (finePointer) {
      let down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener('pointerdown', e => { if (e.target.closest('a,button')) return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.style.scrollSnapType = 'none'; track.style.cursor = 'grabbing'; });
      window.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; track.scrollLeft = sl - dx; });
      window.addEventListener('pointerup', () => { if (!down) return; down = false; track.style.scrollSnapType = ''; track.style.cursor = ''; });
    }

    // lecture automatique (en pause au survol / hors écran)
    if (!reduced && 'IntersectionObserver' in window) {
      let timer = null, visible = false, hover = false;
      const tick = () => { if (visible && !hover) go(1); };
      const start = () => { clearInterval(timer); timer = setInterval(tick, 5200); };
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: .4 }).observe(track);
      track.addEventListener('pointerenter', () => { hover = true; });
      track.addEventListener('pointerleave', () => { hover = false; });
      track.addEventListener('focusin', () => { hover = true; });
      track.addEventListener('focusout', () => { hover = false; });
      start();
    }
    if (!reduced && hasGSAP) {
      gsap.from(cards, { y: 70, opacity: 0, duration: 1, ease: 'power3.out', stagger: .1, clearProps: 'transform,opacity', onComplete: update, scrollTrigger: { trigger: track, start: 'top 85%', once: true } });
    }
  }

  /* ------------------------------------------------------------------ *
   *  FAQ, horaires du jour
   * ------------------------------------------------------------------ */
  function initFaq() {
    $$('.qa').forEach(q => {
      const btn = $('button', q);
      btn.addEventListener('click', () => {
        const open = q.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 700);
      });
    });
  }

  function initHours() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = map[get('weekday')], hour = parseInt(get('hour'), 10) + parseInt(get('minute'), 10) / 60;
    $$('#hoursList li').forEach(li => li.classList.toggle('is-today', parseInt(li.dataset.d, 10) === dow));

    const st = $('#openStatus'), h = HOURS[dow];
    let text, cls;
    if (Array.isArray(h) && hour >= h[0] && hour < h[1]) { text = `Ouvert · jusqu’à ${h[1]}h`; cls = 'is-open'; }
    else if (h === 'ask') { text = 'Aujourd’hui : sur demande, appelez Monia'; cls = ''; }
    else {
      cls = 'is-closed';
      let found = null;
      for (let k = 0; k <= 7 && !found; k++) {
        const d = (dow + k) % 7, hh = HOURS[d];
        if (Array.isArray(hh) && (k > 0 || hour < hh[0])) found = { k, d, o: hh[0] };
      }
      text = found ? `Fermé · rouvre ${found.k === 0 ? 'aujourd’hui' : found.k === 1 ? 'demain' : dayNames[found.d]} à ${found.o}h` : 'Fermé';
    }
    st.textContent = text; st.classList.add(cls || 'x');
  }

  /* ------------------------------------------------------------------ *
   *  Démarrage
   * ------------------------------------------------------------------ */
  function init() {
    root.classList.remove('no-js');
    buildDrips();
    initScroll();
    initNav();
    initBooking();       // lit les données des cartes (prix) : avant tout le reste
    initNailArt();
    initFaq();
    initHours();
    prepHero();
    try {
      initHeroScroll();
      initReveals();
      initRibbons();
      initPinned();
      initGallery();
      initReviews();
      initCursor();
      initMagnetic();
      initTilt();
    } catch (err) {
      console.error('Animations désactivées :', err);
    }
    runLoader(heroIntro);

    window.addEventListener('load', () => { if (hasGSAP) ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready && hasGSAP) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  try { init(); }
  catch (err) { console.error(err); const l = $('#loader'); if (l) l.style.display = 'none'; body.classList.remove('is-loading'); }
})();
