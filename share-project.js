(function () {
    'use strict';

    const SHARE_TEXT = 'مشروع أجر لا ينقطع 🤍\nساهم بذكر أو دعاء واجعل لك أثرًا دائمًا';
    const siteUrl = window.location.origin;
    const encodedText = encodeURIComponent(`${SHARE_TEXT}\n${siteUrl}`);

    const links = {
        whatsapp: `https://wa.me/?text=${encodedText}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodedText}`,
        x: `https://twitter.com/intent/tweet?text=${encodedText}`,
    };

    document.querySelectorAll('[data-share-platform]').forEach((node) => {
        const platform = node.dataset.sharePlatform;

        if (platform === 'native') {
            if (typeof navigator.share === 'function') {
                node.hidden = false;
                node.addEventListener('click', async () => {
                    try {
                        await navigator.share({ text: SHARE_TEXT, url: siteUrl });
                    } catch {
                        // Ignore aborts and unsupported states.
                    }
                });
            }
            return;
        }

        const href = links[platform];
        if (!href) return;
        node.setAttribute('href', href);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    });
})();
