import { logger } from './shared.js';
import https from 'https';
import { Buffer } from 'buffer';

const typeLabels = {
    dhikr: 'ذكر 📿',
    dua: 'دعاء 🤲',
    ayah: 'آية قرآنيّة 📖',
    hadith: 'حديث شريف 💬',
    benefit: 'فائدة روحانيّة ✨'
};

/**
 * Escapes text for Telegram HTML parse mode
 */
function escapeHtml(text) {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Sends an approved submission text to the Telegram Channel
 * @param {Object} submission - The submission row object containing message, content_type, and optional author_name
 */
export async function sendTelegramNotification(submission) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID; // Can be @channel_username or channel id (e.g., -100xxxxxxx)

    if (!token || !chatId) {
        logger.warn('[Telegram] Skip sending. TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.');
        return;
    }

    return new Promise((resolve) => {
        try {
            const text = submission.corrected_message || submission.message;
            const typeLabel = typeLabels[submission.content_type] || submission.content_type;
            const author = submission.author_name ? submission.author_name.trim() : 'فاعل خير';

            // Escape HTML characters to prevent Telegram API parsing errors
            const escapedText = escapeHtml(text);
            const escapedAuthor = escapeHtml(author);

            // Format a beautiful spiritual HTML post matching the Telegram channel style
            const messageText = 
`✨ <b>مشاركة جديدة من المجتمع</b> ✨

<b>النوع:</b> ${typeLabel}

« <i>${escapedText}</i> »

✍️ <b>بواسطة:</b> ${escapedAuthor}
💚 <b>بنية الأجر والصدقة الجارية</b>

---
🔗 للمشاركة وإضافة الأذكار:
<a href="https://ajr-la-yanqati.com/">ajr-la-yanqati.com</a>
📱 تابعنا على تيليجرام: ${chatId.startsWith('@') ? chatId : ''}`;

            const postData = JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });

            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        logger.info('[Telegram] Successfully sent approved submission to Telegram channel.');
                    } else {
                        logger.error(`[Telegram] Send failed with status ${res.statusCode}:`, data);
                    }
                    resolve();
                });
            });

            req.on('error', (err) => {
                logger.error('[Telegram] Request error:', err.message);
                resolve();
            });

            req.write(postData);
            req.end();

        } catch (err) {
            logger.error('[Telegram] Error sending message to Telegram:', err.message);
            resolve();
        }
    });
}
