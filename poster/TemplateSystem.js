/**
 * أجر لا ينقطع - TemplateSystem
 * Manages the presets catalog and registers creative elements for the Dhikr Poster templates.
 */

import { ThemeManager } from './ThemeManager.js';

export class TemplateSystem {
    /**
     * Returns metadata for all available templates used in the picker grid.
     */
    static getTemplates() {
        return [
            {
                id: 'night-spiritual',
                name: '🌌 سكون الليل',
                subtitle: 'خلفية سماوية هادئة وهالة دافئة',
                theme: ThemeManager.getTheme('night-spiritual')
            },
            {
                id: 'nature-serenity',
                name: '🍃 صفاء الطبيعة',
                subtitle: 'ضباب غابات زمردي وسلسلة جبلية صامتة',
                theme: ThemeManager.getTheme('nature-serenity')
            },
            {
                id: 'minimal-noor',
                name: '✨ نور هادئ',
                subtitle: 'بساطة فاخرة، درجات رملية عاجية وإطار ذهبي رقيق',
                theme: ThemeManager.getTheme('minimal-noor')
            },
            {
                id: 'premium-gold',
                name: '⚜️ مذهب راقٍ',
                subtitle: 'مخمل أسود فحمي وإطارات مذهبة ثنائية فائقة النقاء',
                theme: ThemeManager.getTheme('premium-gold')
            }
        ];
    }

    /**
     * Gets a single template by its identifier.
     */
    static getTemplateById(id) {
        const templates = this.getTemplates();
        return templates.find(t => t.id === id) || templates[0];
    }
}
