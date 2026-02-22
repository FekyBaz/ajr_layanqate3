(function () {
    'use strict';

    const SHARE_TEXT = 'مشروع أجر لا ينقطع 🤍\nساهم بذكر أو دعاء واجعل لك أثرًا دائمًا';
    const TRACK_ENDPOINT = '/.netlify/functions/community-share-track';
    const baseUrl = window.location.origin;

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
            await fetch(TRACK_ENDPOINT, {
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
            node.hidden = false;
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
