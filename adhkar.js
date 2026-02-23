(function () {
    'use strict';

    var STORAGE_KEY = 'ajr_adhkar_state';

    var PRAYER_ITEMS = [
        { id: 'subhanallah', text: 'سبحان الله', required: 33 },
        { id: 'alhamdulillah', text: 'الحمد لله', required: 33 },
        { id: 'allahuakbar', text: 'الله أكبر', required: 34 }
    ];

    var MORNING_ITEMS = [
        { id: 'item1', text: 'أصبحنا وأصبح الملك لله', required: 1 },
        { id: 'item2', text: 'اللهم بك أصبحنا وبك أمسينا', required: 1 },
        { id: 'item3', text: 'اللهم إني أسألك خير هذا اليوم', required: 1 },
        { id: 'item4', text: 'سبحان الله وبحمده', required: 100 },
        { id: 'item5', text: 'لا إله إلا الله وحده لا شريك له', required: 10 }
    ];

    var EVENING_ITEMS = [
        { id: 'item1', text: 'أمسينا وأمسى الملك لله', required: 1 },
        { id: 'item2', text: 'اللهم بك أمسينا وبك أصبحنا', required: 1 },
        { id: 'item3', text: 'رضيت بالله ربًا وبالإسلام دينًا', required: 3 },
        { id: 'item4', text: 'أعوذ بكلمات الله التامات من شر ما خلق', required: 3 },
        { id: 'item5', text: 'اللهم أجرني من النار', required: 7 }
    ];

    function buildDefaultCounts(items) {
        return items.reduce(function (acc, item) {
            acc[item.id] = 0;
            return acc;
        }, {});
    }

    function getDefaultState() {
        return {
            tasbeeh: {
                count: 0,
                dhikr: 'سبحان الله'
            },
            prayer: buildDefaultCounts(PRAYER_ITEMS),
            morning: buildDefaultCounts(MORNING_ITEMS),
            evening: buildDefaultCounts(EVENING_ITEMS)
        };
    }

    function safeParse(value) {
        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function sanitizeCategory(raw, defaults) {
        var output = {};
        Object.keys(defaults).forEach(function (id) {
            var incoming = raw && typeof raw[id] === 'number' ? raw[id] : defaults[id];
            output[id] = Number.isFinite(incoming) && incoming >= 0 ? Math.floor(incoming) : 0;
        });
        return output;
    }

    function sanitizeState(parsed) {
        var defaults = getDefaultState();

        if (!parsed || typeof parsed !== 'object') {
            return defaults;
        }

        var tasbeehCount = parsed.tasbeeh && typeof parsed.tasbeeh.count === 'number' ? parsed.tasbeeh.count : defaults.tasbeeh.count;
        var tasbeehDhikr = parsed.tasbeeh && typeof parsed.tasbeeh.dhikr === 'string' ? parsed.tasbeeh.dhikr : defaults.tasbeeh.dhikr;

        return {
            tasbeeh: {
                count: Number.isFinite(tasbeehCount) && tasbeehCount >= 0 ? Math.floor(tasbeehCount) : 0,
                dhikr: tasbeehDhikr.trim() || defaults.tasbeeh.dhikr
            },
            prayer: sanitizeCategory(parsed.prayer, defaults.prayer),
            morning: sanitizeCategory(parsed.morning, defaults.morning),
            evening: sanitizeCategory(parsed.evening, defaults.evening)
        };
    }

    function loadState() {
        var parsed = safeParse(localStorage.getItem(STORAGE_KEY));
        return sanitizeState(parsed);
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function progressRatio(count, required) {
        return Math.min(count / required, 1);
    }

    function createDhikrRow(item, category, state, onIncrement, onReset) {
        var count = state[category][item.id] || 0;
        var complete = count >= item.required;

        var li = document.createElement('li');
        li.className = 'adhkar-item' + (complete ? ' is-complete' : '');

        li.innerHTML = [
            '<div class="adhkar-item__top">',
            '<p class="adhkar-item__text">' + item.text + '</p>',
            '<span class="adhkar-item__required">' + item.required + ' مرة</span>',
            '</div>',
            '<div class="adhkar-item__progress-row">',
            '<span class="adhkar-item__count">' + count + ' / ' + item.required + '</span>',
            '<div class="adhkar-progress" aria-hidden="true"><span style="width: ' + (progressRatio(count, item.required) * 100) + '%;"></span></div>',
            complete ? '<span class="adhkar-item__done">تم 🤍</span>' : '',
            '</div>',
            '<div class="adhkar-item__actions">',
            '<button type="button" class="btn btn-secondary adhkar-small-btn" data-action="increment">تسبيحة</button>',
            '<button type="button" class="btn btn-ghost adhkar-small-btn" data-action="reset">إعادة</button>',
            '</div>'
        ].join('');

        li.querySelector('[data-action="increment"]').addEventListener('click', function () {
            onIncrement(item.id);
        });

        li.querySelector('[data-action="reset"]').addEventListener('click', function () {
            onReset(item.id);
        });

        return li;
    }

    function setupInlineConfirm(triggerEl, panelEl, confirmEl, cancelEl, onConfirm) {
        triggerEl.addEventListener('click', function () {
            panelEl.hidden = false;
            triggerEl.hidden = true;
        });

        confirmEl.addEventListener('click', function () {
            onConfirm();
            panelEl.hidden = true;
            triggerEl.hidden = false;
        });

        cancelEl.addEventListener('click', function () {
            panelEl.hidden = true;
            triggerEl.hidden = false;
        });
    }

    function init() {
        var state = loadState();

        var tasbeehCount = document.getElementById('tasbeehCount');
        var tasbeehLabel = document.getElementById('tasbeehLabel');
        var tasbeehButton = document.getElementById('tasbeehButton');
        var tasbeehDhikr = document.getElementById('tasbeehDhikr');
        var prayerList = document.getElementById('prayerList');
        var morningList = document.getElementById('morningList');
        var eveningList = document.getElementById('eveningList');

        var isTapLocked = false;

        function renderTasbeeh() {
            tasbeehCount.textContent = state.tasbeeh.count;
            tasbeehLabel.textContent = state.tasbeeh.dhikr;
            tasbeehDhikr.value = state.tasbeeh.dhikr;

            tasbeehCount.classList.toggle('is-milestone', state.tasbeeh.count === 33 || state.tasbeeh.count === 100);
        }

        function renderList(listEl, items, category) {
            listEl.innerHTML = '';
            items.forEach(function (item) {
                var row = createDhikrRow(item, category, state, function increment(id) {
                    state[category][id] += 1;
                    saveState(state);
                    render();
                }, function reset(id) {
                    state[category][id] = 0;
                    saveState(state);
                    render();
                });
                listEl.appendChild(row);
            });
        }

        function render() {
            renderTasbeeh();
            renderList(prayerList, PRAYER_ITEMS, 'prayer');
            renderList(morningList, MORNING_ITEMS, 'morning');
            renderList(eveningList, EVENING_ITEMS, 'evening');
        }

        tasbeehButton.addEventListener('click', function () {
            if (isTapLocked) {
                return;
            }

            isTapLocked = true;
            state.tasbeeh.count += 1;
            saveState(state);

            tasbeehButton.classList.remove('is-pressed');
            tasbeehButton.classList.add('is-pressed');
            renderTasbeeh();

            window.setTimeout(function () {
                isTapLocked = false;
                tasbeehButton.classList.remove('is-pressed');
            }, 120);
        });

        tasbeehDhikr.addEventListener('change', function (event) {
            state.tasbeeh.dhikr = event.target.value;
            saveState(state);
            renderTasbeeh();
        });

        setupInlineConfirm(
            document.getElementById('tasbeehResetTrigger'),
            document.getElementById('tasbeehResetConfirm'),
            document.getElementById('tasbeehResetYes'),
            document.getElementById('tasbeehResetNo'),
            function () {
                state.tasbeeh.count = 0;
                saveState(state);
                renderTasbeeh();
            }
        );

        setupInlineConfirm(
            document.getElementById('morningResetTrigger'),
            document.getElementById('morningResetConfirm'),
            document.getElementById('morningResetYes'),
            document.getElementById('morningResetNo'),
            function () {
                state.morning = buildDefaultCounts(MORNING_ITEMS);
                saveState(state);
                render();
            }
        );

        setupInlineConfirm(
            document.getElementById('eveningResetTrigger'),
            document.getElementById('eveningResetConfirm'),
            document.getElementById('eveningResetYes'),
            document.getElementById('eveningResetNo'),
            function () {
                state.evening = buildDefaultCounts(EVENING_ITEMS);
                saveState(state);
                render();
            }
        );

        render();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
