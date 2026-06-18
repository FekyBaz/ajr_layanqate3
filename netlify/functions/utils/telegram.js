import { logger } from './shared.js';

const typeLabels = {
    dhikr: 'ذكر 📿',
    dua: 'دعاء 🤲',
    ayah: 'آية قرآنيّة 📖',
    hadith: 'حديث شريف 💬',
    benefit: 'فائدة روحانيّة ✨'
};

/**
 * Sends an approved submission text to the Telegram Channel
 * @param {Object} submission - The submission row object containing message, content_type, and optional name
 */
export async function sendTelegramNotification(submission) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID; // Can be @channel_username or channel id (e.g., -100xxxxxxx)

    if (!token || !chatId) {
        logger.warn('[Telegram] Skip sending. TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.');
        return;
    }

    try {
        const text = submission.corrected_message || submission.message;
        const typeLabel = typeLabels[submission.content_type] || submission.content_type;
        const author = submission.name ? submission.name.trim() : 'فاعل خير';

        // Format a beautiful spiritual post matching the Telegram channel style
        const messageText = 
`✨ *مشاركة جديدة من المجتمع* ✨

*النوع:* ${typeLabel}

« ${text} »

✍️ *بواسطة:* ${author}
💚 *بنية الأجر والصدقة الجارية*

---
🔗 للمشاركة وإضافة الأذكار:
[ajr-la-yanqati.com](https://ajr-la-yanqati.com/)
📱 تابعنا على تيليجرام: ${chatId.startsWith('@') ? chatId : ''}`;

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[Telegram] Send failed with status ${response.status}:`, errorText);
        } else {
            logger.info('[Telegram] Successfully sent approved submission to Telegram channel.');
        }
    } catch (err) {
        logger.error('[Telegram] Error sending message to Telegram:', err.message);
    }
}
