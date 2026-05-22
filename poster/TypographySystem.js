/**
 * أجر لا ينقطع - TypographySystem
 * The Smart Arabic Typography Layout Engine.
 * Automatically wraps, balances, and downscales text to fit beautifully.
 */

export class TypographySystem {
    /**
     * Wraps and balances Arabic text to keep lines uniform and visually pleasant.
     * Prevents single conjunctions (like "و") from becoming orphaned.
     */
    static balanceArabicText(ctx, text, maxWidth) {
        // Clean up redundant whitespaces
        const cleanedText = text.replace(/\s+/g, ' ').trim();
        if (!cleanedText) return [];

        const rawWords = cleanedText.split(' ');
        const words = [];

        // Pre-processing: Merge standalone conjunctions "و" with the following word
        for (let i = 0; i < rawWords.length; i++) {
            const word = rawWords[i];
            if (word === 'و' && i < rawWords.length - 1) {
                rawWords[i + 1] = 'و ' + rawWords[i + 1];
            } else {
                words.push(word);
            }
        }

        if (words.length === 0) return [];

        // 1. Obtain greedy line breaks at max width to find the natural number of lines (N)
        const naturalLines = this.wrapTextGreedy(ctx, words, maxWidth);
        const N = naturalLines.length;

        if (N <= 1) {
            return naturalLines; // No balancing needed for a single line
        }

        // 2. Squeeze the lines to distribute words evenly by searching for a smaller target width (L)
        // L resides between the widest single word and the maximum container width.
        let maxSingleWordWidth = 0;
        for (const w of words) {
            const width = ctx.measureText(w).width;
            if (width > maxSingleWordWidth) maxSingleWordWidth = width;
        }

        let minL = maxSingleWordWidth + 15; // Safe padding
        let maxL = maxWidth;
        let bestLines = naturalLines;
        let searchCount = 0;

        // Binary search to find the optimal width boundary that keeps the text on exactly N lines
        while (minL <= maxL && searchCount < 15) {
            const midL = (minL + maxL) / 2;
            const testLines = this.wrapTextGreedy(ctx, words, midL);

            if (testLines.length <= N) {
                // If it still fits on N lines, try squeezing more (smaller width target)
                bestLines = testLines;
                maxL = midL - 1;
            } else {
                // Squeezed too much (creates more lines), expand the width target
                minL = midL + 1;
            }
            searchCount++;
        }

        return bestLines;
    }

    /**
     * Standard greedy wrapping algorithm.
     */
    static wrapTextGreedy(ctx, words, maxW) {
        const lines = [];
        let currentLine = [];

        for (const word of words) {
            const testLine = currentLine.length ? currentLine.join(' ') + ' ' + word : word;
            const width = ctx.measureText(testLine).width;

            if (width > maxW && currentLine.length) {
                lines.push(currentLine.join(' '));
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }

        if (currentLine.length) {
            lines.push(currentLine.join(' '));
        }

        return lines;
    }

    /**
     * Determines optimal font size and balanced line arrays relative to canvas bounds.
     * Prevents clipping by downscaling recursively by 8% increments.
     */
    static computeOptimalLayout(ctx, text, width, height, theme, baseFontSlider) {
        const scale = height / 1000;
        
        // Base size mapped to height scale
        let initialFontSize = theme.defaultFontSize * scale * (baseFontSlider / 38);

        // Adjust default scale relative to character length for elegant balance
        const length = text.length;
        if (length < 35) {
            initialFontSize *= 1.35; // Large majestic typography for short dhikrs
        } else if (length > 150) {
            initialFontSize *= 0.85; // Elegant smaller font for long duas
        }

        let fontSize = initialFontSize;
        let lines = [];
        
        const maxTextWidth = width * 0.72; // 14% horizontal margins
        const maxTextHeight = height * 0.48; // 26% vertical margins reserved for atmosphere
        
        let attempts = 0;
        
        while (attempts < 12) {
            // Apply font configuration based on family aesthetics
            let fontStyle = `500 ${fontSize}px "${theme.fontFamily}", Amiri, Tajawal, sans-serif`;
            
            if (theme.fontFamily === 'Amiri') {
                fontStyle = `700 ${fontSize}px "Amiri", serif`;
            } else if (theme.fontFamily === 'Cairo') {
                fontStyle = `800 ${fontSize}px "Cairo", sans-serif`;
            } else if (theme.fontFamily === 'Reem Kufi') {
                fontStyle = `600 ${fontSize}px "Reem Kufi", sans-serif`;
            } else if (theme.fontFamily === 'IBM Plex Sans Arabic') {
                fontStyle = `500 ${fontSize}px "IBM Plex Sans Arabic", sans-serif`;
            } else if (theme.fontFamily === 'Tajawal') {
                fontStyle = `700 ${fontSize}px "Tajawal", sans-serif`;
            }

            ctx.font = fontStyle;
            
            // Wrap and balance text with this specific font context
            lines = this.balanceArabicText(ctx, text, maxTextWidth);
            
            const totalHeight = lines.length * fontSize * theme.lineHeight;
            
            // Validate that no single line exceeds horizontal boundaries
            let hasHorizontalOverflow = false;
            for (const line of lines) {
                if (ctx.measureText(line).width > maxTextWidth) {
                    hasHorizontalOverflow = true;
                    break;
                }
            }

            if (totalHeight <= maxTextHeight && !hasHorizontalOverflow) {
                break; // Text fits perfectly!
            }

            // Downscale size by 8% and recompute layout
            fontSize *= 0.92;
            attempts++;
        }

        return {
            lines,
            fontSize,
            lineHeight: fontSize * theme.lineHeight,
            fontFamily: theme.fontFamily
        };
    }
}
