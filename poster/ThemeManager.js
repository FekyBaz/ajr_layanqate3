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
        name: 'فجر المدينة',
        fontColor: '#FFFFFF',
        accentColor: '#FFE8A3',
        secondaryColor: '#C8E8A0',
        shadowColor: 'rgba(0, 0, 0, 0.72)',
        particleColor: 'rgba(255, 240, 180, 0.35)',
        particleCount: 25,
        fontFamily: 'Amiri',
        lineHeight: 1.6,
        glowIntensity: 0.14,
        defaultFontSize: 36
    },
    'minimal-noor': {
        id: 'minimal-noor',
        name: 'ضباب السحر',
        fontColor: '#FFFFFF',
        accentColor: '#FFE9AA',
        secondaryColor: '#D4C8AA',
        shadowColor: 'rgba(0, 0, 0, 0.68)',
        particleColor: 'rgba(255, 240, 200, 0.28)',
        particleCount: 18,
        fontFamily: 'Amiri',
        lineHeight: 1.6,
        glowIntensity: 0.16,
        defaultFontSize: 38
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
    },
    'paradise-spring': {
        id: 'paradise-spring',
        name: 'أصيل المغيب',
        fontColor: '#FFFFFF',
        accentColor: '#FFD580',
        secondaryColor: '#E8C87A',
        shadowColor: 'rgba(0, 0, 0, 0.70)',
        particleColor: 'rgba(255, 220, 120, 0.30)',
        particleCount: 22,
        fontFamily: 'Cairo',
        lineHeight: 1.5,
        glowIntensity: 0.16,
        defaultFontSize: 38
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
