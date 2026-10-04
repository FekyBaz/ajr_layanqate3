(function () {
    'use strict';

    const SHARE_TEXT = 'مشروع أجر لا ينقطع\nساهم بذكر أو دعاء واجعل لك أثرًا دائمًا ✨';
    const TRACK_ENDPOINT = '/.netlify/functions/community-share-track';
    const baseUrl = window.location.origin;

    // Single source for the project-share buttons (see issue #73).
    // Pages render `<div class="project-share__actions" data-project-share></div>`
    // and this hydrates it, replacing the previously duplicated ~30-line blocks.
    // Buttons are inert without JS (href="#"), so hydration loses nothing.
    const PROJECT_SHARE_ACTIONS_HTML = `
        <a class="btn btn-share project-share__btn project-share__btn--whatsapp" data-share-platform="whatsapp"
            href="#" target="_blank" rel="noopener noreferrer">
            <svg class="share-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.456 3.48 1.332 5.004L2 22l5.124-1.344c1.476.804 3.144 1.224 4.884 1.224C17.532 21.88 22 17.4 22 11.88 22 6.48 17.532 2 12.012 2zm6.156 13.92c-.252.708-1.464 1.38-2.016 1.464-.492.084-.96.3-3.132-.6a11.16 11.16 0 0 1-5.112-4.5c-.936-1.248-1.476-2.928-1.476-4.644 0-1.776.924-2.628 1.26-2.976.336-.348.732-.432.972-.432.24 0 .48 0 .684.012.216.012.504-.084.792.6.288.696.984 2.4.1068 2.58-.12.18-.192.3-.384.528-.18.216-.384.456-.156.852.228.396 1.02 1.68 2.184 2.724 1.488 1.344 2.748 1.764 3.144 1.956.396.192.624.156.852-.108.228-.264.984-1.14 1.248-1.536.264-.396.528-.324.888-.192.36.132 2.292 1.08 2.688 1.284.396.192.66.288.756.456.096.156.096.9-.156 1.608z"/></svg>
            <span>واتساب</span>
        </a>
        <a class="btn btn-share project-share__btn project-share__btn--telegram" data-share-platform="telegram"
            href="#" target="_blank" rel="noopener noreferrer">
            <svg class="share-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.16 1.56-.86 5.68-1.22 7.62-.16.82-.46 1.1-.76 1.12-.64.06-1.14-.42-1.76-.82-.96-.64-1.5-1.04-2.44-1.66-1.08-.7-3.8-2.38-4.22-2.56-.1-.04-.18-.1-.26-.18-.08-.08-.12-.18-.12-.28s.06-.2.16-.26c.4-.3 3.66-3.48 5.62-5.34.08-.08.18-.12.28-.12.2 0 .3.12.3.26v.02c-.04.42-.48 2.16-.86 3.9-.14.64-.42 1.22-.84 1.7-.12.12-.12.3 0 .42.44.42.92.86 1.36 1.28.42.4.82.78 1.3 1.1.28.18.52.22.7.2.22-.02.48-.16.64-.4.44-.7 1.18-2.84 1.54-5 .04-.32.02-.62-.12-.76-.14-.14-.4-.14-.84-.04z"/></svg>
            <span>تيليجرام</span>
        </a>
        <a class="btn btn-share project-share__btn project-share__btn--x" data-share-platform="x" href="#"
            target="_blank" rel="noopener noreferrer">
            <svg class="share-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>منصة X</span>
        </a>
        <button type="button" class="btn btn-share project-share__btn project-share__btn--native"
            data-share-platform="native" hidden>
            <svg class="share-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>مشاركة الجهاز</span>
        </button>`;

    document.querySelectorAll('[data-project-share]').forEach((container) => {
        container.innerHTML = PROJECT_SHARE_ACTIONS_HTML;
    });

    function buildShareUrl(platform) {
        const shareUrl = new URL(baseUrl);
        shareUrl.searchParams.set('ref', `${platform}_share`);
        return shareUrl.toString();
    }

    function getPlatformLink(platform) {
        const url = buildShareUrl(platform);
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(`${SHARE_TEXT}\n${url}`);

        if (platform === 'whatsapp') return `https://wa.me/?text=${encodedText}`;
        if (platform === 'telegram') return `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(SHARE_TEXT)}`;
        if (platform === 'x') return `https://twitter.com/intent/tweet?text=${encodedText}`;
        return url;
    }

    async function trackShare(platform) {
        try {
            // Timeout-bounded (lib/fetch-utils.js when loaded, see #145).
            const doFetch = globalThis.FetchUtils
                ? globalThis.FetchUtils.fetchWithTimeout
                : fetch;
            await doFetch(TRACK_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform }),
            });
        } catch {
            // intentionally ignored
        }
    }

    function openPlatform(platform) {
        window.open(getPlatformLink(platform), '_blank', 'noopener,noreferrer');
    }

    async function smartShare(platform) {
        const shareUrl = buildShareUrl(platform);

        try {
            if (typeof navigator.share === 'function') {
                await navigator.share({ text: SHARE_TEXT, url: shareUrl });
                await trackShare('native');
                return;
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
        }

        openPlatform(platform);
        await trackShare(platform);
    }

    document.querySelectorAll('[data-share-platform]').forEach((node) => {
        const platform = node.dataset.sharePlatform;

        if (platform === 'native') {
            node.hidden = typeof navigator.share !== 'function';
            node.addEventListener('click', async (event) => {
                event.preventDefault();
                await smartShare('whatsapp');
            });
            return;
        }

        node.setAttribute('href', getPlatformLink(platform));
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
        node.addEventListener('click', async (event) => {
            event.preventDefault();
            await smartShare(platform);
        });
    });
})();
