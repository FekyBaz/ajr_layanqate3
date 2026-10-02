import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats } from '../lib/calculateStats.js';

describe('calculateStats', () => {
    it('returns zeroed stats for an empty dataset', () => {
        assert.deepEqual(calculateStats([]), {
            total: 0,
            males: 0,
            females: 0,
            children: 0,
            adults: 0,
            elderly: 0,
            byDecade: {},
        });
    });

    it('buckets gender and age boundaries correctly', () => {
        const stats = calculateStats([
            { gender: 'm', age: 18, birthYear: 2007 },
            { gender: 'f', age: 19, birthYear: 2006 },
            { gender: 'm', age: 60, birthYear: 1965 },
            { gender: 'f', age: 61, birthYear: 1964 },
            { gender: 'x', age: 'unknown', birthYear: -5 },
        ]);
        assert.equal(stats.total, 5);
        assert.equal(stats.males, 2);
        assert.equal(stats.females, 2);
        assert.equal(stats.children, 1); // age 18
        assert.equal(stats.adults, 2); // ages 19 and 60
        assert.equal(stats.elderly, 1); // age 61
        assert.deepEqual(stats.byDecade, { 2000: 2, 1960: 2 });
    });

    it('ignores missing age and birthYear', () => {
        const stats = calculateStats([{}]);
        assert.equal(stats.total, 1);
        assert.equal(stats.children + stats.adults + stats.elderly, 0);
        assert.deepEqual(stats.byDecade, {});
    });
});
