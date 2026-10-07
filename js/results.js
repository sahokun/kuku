/* Paginate the current round without changing its learning records. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KukuResults = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function page(responses, requested = 0) {
        const pages = Math.max(1, Math.ceil(responses.length / 5));
        const index = Math.max(0, Math.min(pages - 1, Number.isInteger(requested) ? requested : 0));
        const start = index * 5;
        return { index, pages, total: responses.length, start, end: Math.min(start + 5, responses.length), rows: responses.slice(start, start + 5).map((q, i) => ({
            number: start + i + 1, equation: `${q.a} × ${q.b} = ${q.a * q.b}`,
            state: q.ok === true ? 'correct' : q.kind === 'listen' ? 'listen' : 'wrong',
            mark: q.ok === true ? '○' : q.kind === 'listen' ? '♪' : '×',
            note: q.ok === true ? 'せいかい！' : q.kind === 'listen' ? 'きいて おぼえたよ' : q.reason === 'timeout' ? 'じかんぎれ' : q.reason === 'shown' ? 'こたえを みたよ' : `きみの こたえ：${q.given ?? '—'}`
        })) };
    }
    return { page };
});
