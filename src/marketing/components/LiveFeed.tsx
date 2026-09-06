export interface FeedItem {
  label: string;
}

export const DEFAULT_FEED_ITEMS: FeedItem[] = [
  { label: "research_keywords → seo.keyword_opportunity · search_index · 0.75" },
  { label: "audit_site → audit.site_health · crawl · 0.95" },
  { label: "get_search_performance → webmaster_console · 1.0" },
  { label: "inspect_serp → live_serp · 0.85" },
  { label: "inspect_backlinks → backlink_index · 0.7" }
];

const FEED_SCRIPT = `
(function () {
  var root = document.querySelector('[data-live-feed]');
  if (!root) return;
  var items = Array.prototype.slice.call(root.querySelectorAll('[data-feed-item]'));
  if (!items.length) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var i = 0;
  var timer = null;
  var waiting = null;
  var paused = false;
  var typing = false;

  function paint(el, n) {
    var full = el.getAttribute('data-full') || '';
    var text = el.querySelector('[data-feed-text]');
    if (text) text.textContent = full.slice(0, n);
  }

  function layout() {
    items.forEach(function (el, idx) {
      var dist = (idx - i + items.length) % items.length;
      el.style.order = String(items.length - dist);
      el.style.setProperty('--rise', String(dist));
      el.classList.toggle('is-typing', dist === 0 && !reduced);
      el.classList.toggle('is-done', dist !== 0 || reduced);
      el.classList.toggle('is-stale', dist >= 2);
      if (dist !== 0 || reduced) paint(el, (el.getAttribute('data-full') || '').length);
    });
  }

  function stopTimers() {
    if (timer) { clearInterval(timer); timer = null; }
    if (waiting) { clearTimeout(waiting); waiting = null; }
    typing = false;
  }

  function typeActive() {
    if (paused || reduced) return;
    stopTimers();
    layout();
    var el = items[i];
    var full = el.getAttribute('data-full') || '';
    var n = 0;
    paint(el, 0);
    typing = true;
    timer = setInterval(function () {
      if (paused) return;
      n += 1;
      paint(el, n);
      if (n >= full.length) {
        clearInterval(timer);
        timer = null;
        typing = false;
        el.classList.remove('is-typing');
        el.classList.add('is-done');
        waiting = setTimeout(function () {
          i = (i + 1) % items.length;
          typeActive();
        }, 950);
      }
    }, 16);
  }

  if (reduced) {
    layout();
    return;
  }

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      var vis = entries.some(function (e) { return e.isIntersecting; });
      if (vis) {
        if (paused) {
          paused = false;
          if (!typing && !waiting) typeActive();
        }
      } else {
        paused = true;
        stopTimers();
      }
    }, { threshold: 0.2 });
    io.observe(root);
  }

  typeActive();
})();
`;

export function LiveFeed({ items = DEFAULT_FEED_ITEMS }: { items?: FeedItem[] }) {
  return (
    <div class="live-feed" data-live-feed>
      <p class="live-feed-title">
        <span class="live-dot" aria-hidden="true" />
        What an agent can vouch for
      </p>
      <ul class="live-feed-list">
        {items.map((item) => (
          <li class="live-feed-item is-done" data-feed-item data-full={item.label}>
            <span class="live-feed-mark" aria-hidden="true" />
            <span class="live-feed-text" data-feed-text>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <script dangerouslySetInnerHTML={{ __html: FEED_SCRIPT }} />
    </div>
  );
}
