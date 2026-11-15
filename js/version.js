/* App version and change notes shown in メニュー → こうしん きろく. Newest first; notes[0] is the current version. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KukuVersion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const notes = [
        { version: '2026.11.16', date: '2026-11-16', items: [
            'メニューに バージョンと「こうしん きろく」を ついか。'
        ] }
    ];
    return Object.freeze({ version: notes[0].version, notes });
});
