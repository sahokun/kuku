"""kuku-playtest のチェック行に判定の印を付ける。印のない行だけを置き換え、それ以外の行は変えない。

使い方: python3 -I mark.py <table.json> <in.md> <out.md>

table.json の形:
    {"version": "v2026.11.27（sahokun/kuku#19）",
     "R34": ["done", "何をしたか"],      # 報告No.34 → ✅
     "R36": ["none", "対応しない理由"],  # → ➖
     "Y37": ["hold", "次に何を検討するか"]}  # 要望37 → ⏸
キーは、報告No.N を含む行が RN、行頭が「要望N:」の行が YN。表に無いチェック行があれば失敗する。
"""
import json
import re
import sys

LINE = re.compile(r'^- \[ ?\] (?!✅|➖|⏸)(.*)$')


def key_of(text):
    """チェック行の本文から、表のキー（RN / YN）を返す。見つからなければ None。"""
    m = re.search(r'報告No\.(\d+)', text)
    if m:
        return f'R{m.group(1)}'
    m = re.match(r'要望(\d+):', text)
    return f'Y{m.group(1)}' if m else None


def mark_line(line, table):
    """1行に印を付けた行と、使ったキーを返す。チェック行でなければ (元の行, None)。"""
    m = LINE.match(line)
    if not m:
        return line, None
    text = m.group(1)
    k = key_of(text)
    if k not in table:
        raise SystemExit(f'判定の無いチェック行: {text[:60]}')
    kind, note = table[k]
    if kind == 'done':
        return f'- [x] ✅ {text} → {table["version"]}：{note}', k
    if kind == 'none':
        return f'- [x] ➖ ~~{text}~~ → 対応なし：{note}', k
    if kind == 'hold':
        return f'- [ ] ⏸ {text} → 次回以降：{note}', k
    raise SystemExit(f'{k} の判定 {kind!r} は done / none / hold のどれでもない')


def main(table_path, src, dst):
    table = json.load(open(table_path, encoding='utf-8'))
    out, used = [], []
    for line in open(src, encoding='utf-8').read().split('\n'):
        new, k = mark_line(line, table)
        out.append(new)
        if k:
            used.append(k)
    open(dst, 'w', encoding='utf-8').write('\n'.join(out))
    print(' '.join(used) or '(none)')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
