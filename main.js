/* =========================================
   Site-wide interactions: theme, navigation, scroll effects,
   auto-numbering, news, publication filters, lightbox.
========================================= */
(() => {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1. Light / dark theme ---------- */
    function initTheme() {
        const btn = $('#theme-toggle');
        if (!btn) return;
        const root = document.documentElement;
        const apply = (theme) => {
            root.setAttribute('data-theme', theme);
            btn.querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        };
        apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        btn.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            apply(next);
            try {
                localStorage.setItem('theme', next);
            } catch (error) {
                console.warn('Theme preference not saved (storage unavailable):', error);
            }
        });
    }

    /* ---------- 2. Mobile navigation ---------- */
    function initNav() {
        const toggle = $('#nav-toggle');
        const menu = $('#nav-menu');
        if (!toggle || !menu) return;
        const setOpen = (open) => {
            menu.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        };
        toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
        });
    }

    /* ---------- 3. Header shadow, reading progress, back-to-top ---------- */
    function initScrollEffects() {
        const header = $('.site-header');
        const bar = $('#progress-bar');
        const topBtn = document.createElement('button');
        topBtn.className = 'icon-btn back-to-top';
        topBtn.setAttribute('aria-label', 'Back to top');
        topBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
        document.body.appendChild(topBtn);

        let ticking = false;
        const update = () => {
            const y = window.scrollY;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            header?.classList.toggle('is-scrolled', y > 8);
            if (bar) bar.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
            topBtn.classList.toggle('is-visible', y > 600);
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        }, { passive: true });
        update();
    }

    /* ---------- 4. Scroll reveal ---------- */
    const REVEAL_SELECTOR = [
        '.section-title', '.bio-heading', '.intro-container', '.research-intro', '.page-intro',
        '.edu-item', '.pub-item-modern', '.award-item', '.research-project', '.teaching-item',
        '.gallery-item', '.cv-frame', '.book-list li', '.news-list'
    ].join(',');
    let revealObserver = null;

    function initReveal(root = document) {
        if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
        revealObserver ??= new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
        $$(REVEAL_SELECTOR, root)
            .filter((el) => !el.classList.contains('reveal'))
            .forEach((el) => {
                el.classList.add('reveal');
                revealObserver.observe(el);
            });
    }

    /* ---------- 5. Auto-numbering of list items ---------- */
    function initAutoNumber() {
        $$('[data-autonumber]').forEach((list) => {
            $$('.pub-number-box, .award-number-box', list).forEach((box, index) => {
                box.textContent = String(index + 1);
            });
        });
    }

    /* ---------- 6. News (loaded from news.html) ---------- */
    const NEWS_PREVIEW_COUNT = 8;

    async function initNews() {
        const box = $('#news-container');
        if (!box) return;
        try {
            const response = await fetch('news.html');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            box.innerHTML = await response.text();
            enhanceNews(box);
            initReveal(box);
        } catch (error) {
            box.innerHTML = '<p>Error loading news.</p>';
            console.error('Error fetching news:', error);
        }
    }

    function enhanceNews(box) {
        const list = $('.news-list', box);
        if (!list) return;
        const items = $$(':scope > li', list);
        items.forEach((li) => {
            const strong = li.firstElementChild;
            if (!strong || strong.tagName !== 'STRONG') return;
            const date = document.createElement('span');
            date.className = 'news-date';
            date.textContent = strong.textContent.replace(/:\s*$/, '');
            strong.remove();
            const body = document.createElement('span');
            body.className = 'news-body';
            body.append(...li.childNodes);
            li.append(date, body);
        });
        list.classList.add('is-enhanced');
        if (items.length > NEWS_PREVIEW_COUNT) addNewsToggle(box, items.slice(NEWS_PREVIEW_COUNT), items.length);
    }

    function addNewsToggle(box, extraItems, total) {
        const btn = document.createElement('button');
        btn.className = 'btn news-toggle';
        const render = (expanded) => {
            btn.setAttribute('aria-expanded', String(expanded));
            btn.innerHTML = expanded
                ? '<i class="fa-solid fa-chevron-up"></i> Show less'
                : `<i class="fa-solid fa-chevron-down"></i> Show all news (${total})`;
            extraItems.forEach((li) => li.classList.toggle('is-collapsed', !expanded));
        };
        btn.addEventListener('click', () => render(btn.getAttribute('aria-expanded') !== 'true'));
        render(false);
        box.appendChild(btn);
    }

    /* ---------- 7. Publications: type badges, filters, search ---------- */
    const PUB_BADGES = { journal: 'Journal', conference: 'Conference', competition: 'Competition' };

    function initPubBadges() {
        $$('.pub-item-modern[data-type]').forEach((item) => {
            const label = PUB_BADGES[item.dataset.type];
            const content = $('.pub-content-box', item);
            if (!label || !content) return;
            let group = $('.pub-buttons-group', content);
            if (!group) {
                group = document.createElement('div');
                group.className = 'pub-buttons-group';
                content.appendChild(group);
            }
            const badge = document.createElement('span');
            badge.className = `pub-badge pub-badge--${item.dataset.type}`;
            badge.textContent = label;
            group.prepend(badge);
        });
    }

    function initPubFilter() {
        const toolbar = $('#pub-toolbar');
        if (!toolbar) return;
        const items = $$('.pub-item-modern[data-type]');
        const chips = $$('.chip', toolbar);
        const search = $('#pub-search');
        const empty = $('#pub-empty');
        const matchesFilter = (item, filter) =>
            filter === 'all' || item.dataset.type === filter || item.dataset.status === filter;

        chips.forEach((chip) => {
            const count = document.createElement('span');
            count.className = 'count';
            count.textContent = String(items.filter((item) => matchesFilter(item, chip.dataset.filter)).length);
            chip.appendChild(count);
        });

        let activeFilter = 'all';
        const apply = () => {
            const query = search.value.trim().toLowerCase();
            const visible = items.filter((item) => {
                const show = matchesFilter(item, activeFilter) && (!query || item.textContent.toLowerCase().includes(query));
                item.classList.toggle('is-hidden', !show);
                return show;
            });
            $$('.pub-section').forEach((section) => {
                section.classList.toggle('is-hidden', !$('.pub-item-modern:not(.is-hidden)', section));
            });
            empty.hidden = visible.length > 0;
        };

        chips.forEach((chip) => chip.addEventListener('click', () => {
            activeFilter = chip.dataset.filter;
            chips.forEach((c) => {
                c.classList.toggle('is-active', c === chip);
                c.setAttribute('aria-pressed', String(c === chip));
            });
            apply();
        }));
        search.addEventListener('input', apply);
    }

    /* ---------- 8. Image lightbox (gallery + research figures) ---------- */
    function captionOf(img) {
        return img.closest('.gallery-item')?.querySelector('.gallery-caption')?.textContent.trim() || img.alt || '';
    }

    function buildLightbox() {
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Image viewer');
        box.innerHTML = `
            <span class="lightbox-counter"></span>
            <button class="lightbox-btn lightbox-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            <button class="lightbox-btn lightbox-prev" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
            <figure class="lightbox-figure"><img alt=""><figcaption class="lightbox-caption"></figcaption></figure>
            <button class="lightbox-btn lightbox-next" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>`;
        document.body.appendChild(box);
        return box;
    }

    function initLightbox() {
        const sets = [$$('.gallery-img'), $$('.research-project-img img')].filter((set) => set.length);
        if (!sets.length) return;
        const box = buildLightbox();
        const img = $('img', box);
        const caption = $('.lightbox-caption', box);
        const counter = $('.lightbox-counter', box);
        const prevBtn = $('.lightbox-prev', box);
        const nextBtn = $('.lightbox-next', box);
        let current = [];
        let index = 0;
        let lastFocus = null;

        const show = (i) => {
            index = (i + current.length) % current.length;
            const source = current[index];
            img.src = source.currentSrc || source.src;
            img.alt = source.alt;
            caption.textContent = captionOf(source);
            counter.textContent = `${index + 1} / ${current.length}`;
            prevBtn.hidden = nextBtn.hidden = current.length < 2;
        };
        const open = (set, i) => {
            current = set;
            lastFocus = document.activeElement;
            show(i);
            box.classList.add('is-open');
            document.body.classList.add('no-scroll');
            $('.lightbox-close', box).focus();
        };
        const close = () => {
            box.classList.remove('is-open');
            document.body.classList.remove('no-scroll');
            lastFocus?.focus();
        };

        sets.forEach((set) => set.forEach((source, i) => {
            if (!source.alt) source.alt = captionOf(source);
            const trigger = source.closest('.gallery-item') || source;
            trigger.tabIndex = 0;
            trigger.setAttribute('role', 'button');
            trigger.addEventListener('click', () => open(set, i));
            trigger.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                open(set, i);
            });
        }));

        $('.lightbox-close', box).addEventListener('click', close);
        prevBtn.addEventListener('click', () => show(index - 1));
        nextBtn.addEventListener('click', () => show(index + 1));
        box.addEventListener('click', (e) => { if (e.target === box) close(); });
        document.addEventListener('keydown', (e) => {
            if (!box.classList.contains('is-open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') show(index - 1);
            if (e.key === 'ArrowRight') show(index + 1);
        });
    }

    /* ---------- 9. Copy-to-clipboard buttons ---------- */
    function flashIcon(btn, iconClass) {
        const icon = btn.querySelector('i');
        const original = icon.className;
        icon.className = iconClass;
        btn.classList.add('is-done');
        setTimeout(() => {
            icon.className = original;
            btn.classList.remove('is-done');
        }, 1500);
    }

    function initCopyButtons() {
        $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.copy);
                flashIcon(btn, 'fa-solid fa-check');
            } catch (error) {
                console.error('Copy failed:', error);
                flashIcon(btn, 'fa-solid fa-xmark');
            }
        }));
    }

    /* Kept for backward compatibility: open/close Abstract or BibTeX blocks by id */
    window.toggleContent = (id) => {
        const element = document.getElementById(id);
        if (element) element.style.display = element.style.display === 'block' ? 'none' : 'block';
    };

    initTheme();
    initNav();
    initScrollEffects();
    initAutoNumber();
    initPubBadges();
    initPubFilter();
    initLightbox();
    initCopyButtons();
    initReveal();
    initNews();
})();
