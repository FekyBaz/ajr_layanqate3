/**
 * أجر لا ينقطع - ThemeManager
 * Coordinates aesthetic properties for the Dhikr Poster presets.
 */

export const THEMES = {
    'night-spiritual': {
        id: 'night-spiritual',
        name: 'سكون الليل',
        fontColor: '#F4EFE6',
        accentColor: '#C8A673',
        secondaryColor: '#9A866B',
        shadowColor: 'rgba(0, 0, 0, 0.65)',
        particleColor: 'rgba(255, 237, 194, 0.45)',
        particleCount: 30,
        fontFamily: 'Amiri',
        lineHeight: 1.6,
        glowIntensity: 0.15,
        defaultFontSize: 40
    },
    'nature-serenity': {
        id: 'nature-serenity',
        name: 'صفاء الطبيعة',
        fontColor: '#EAF7EE',
        accentColor: '#A8D3B4',
        secondaryColor: '#7C9A84',
        shadowColor: 'rgba(0, 0, 0, 0.55)',
        particleColor: 'rgba(180, 240, 200, 0.35)',
        particleCount: 25,
        fontFamily: 'Tajawal',
        lineHeight: 1.5,
        glowIntensity: 0.12,
        defaultFontSize: 36
    },
    'minimal-noor': {
        id: 'minimal-noor',
        name: 'نور هادئ',
        fontColor: '#2C2823',
        accentColor: '#BCA374',
        secondaryColor: '#8C7A5B',
        shadowColor: 'rgba(0, 0, 0, 0.04)',
        particleColor: 'rgba(200, 166, 115, 0.15)',
        particleCount: 10,
        fontFamily: 'IBM Plex Sans Arabic',
        lineHeight: 1.55,
        glowIntensity: 0.08,
        defaultFontSize: 35
    },
    'premium-gold': {
        id: 'premium-gold',
        name: 'مذهب راقٍ',
        fontColor: '#FFFBF0',
        accentColor: '#D4AF37',
        secondaryColor: '#B5942B',
        shadowColor: 'rgba(0, 0, 0, 0.85)',
        particleColor: 'rgba(212, 175, 55, 0.4)',
        particleCount: 35,
        fontFamily: 'Amiri',
        lineHeight: 1.6,
        glowIntensity: 0.22,
        defaultFontSize: 42
    }
};

export class ThemeManager {
    static getTheme(themeId) {
        return THEMES[themeId] || THEMES['night-spiritual'];
    }

    static getAvailableThemes() {
        return Object.values(THEMES);
    }
}
