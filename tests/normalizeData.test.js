import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../lib/normalizeData.js';

describe('normalizeData', () => {
    it('maps spreadsheet rows to martyr records', () => {
        const [row] = normalizeData([['id-1', 'Fallback', 'أحمد', '25', '2000-01-01', 'm']]);
        assert.equal(row.id, 'id-1');
        assert.equal(row.arabicName, 'أحمد');
        assert.equal(row.age, 25);
        assert.equal(row.gender, 'm');
        assert.equal(row.birthYear, 2000);
    });

    it('falls back to the latin name then to unknown', () => {
        const [a, b] = normalizeData([
            ['1', 'John', '', '30', '1995-05-05', 'm'],
            ['2', '', '', '', '', ''],
        ]);
        assert.equal(a.arabicName, 'John');
        assert.equal(b.arabicName, 'غير معروف');
        assert.equal(b.age, null);
        assert.equal(b.gender, null);
        assert.equal(b.birthYear, null);
    });

    it('rejects non-binary gender markers and non-numeric ages', () => {
        const [row] = normalizeData([['1', 'x', 'س', 'old', 'not-a-date', 'x']]);
        assert.equal(row.gender, null);
        assert.equal(row.age, null);
        assert.equal(row.birthYear, null);
    });
});
