"""Generate checked-in speech assets (development only).

Requires voicevox_core 0.17.0, PyAV and the official model 0.vvm.
Usage: python tools/generate-voice.py --runtime LIB --dict DIR --model FILE
Playback needs neither Python nor a speech service. See docs/VOICE.md.
"""
import argparse
import base64
import io
import json
from pathlib import Path
import subprocess
import wave

import av
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile

ROOT = Path(__file__).resolve().parents[1]
RATE = 24000
STYLE = 8  # VOICEVOX:春日部つむぎ（ノーマル）


def katakana(text):
    return ''.join(chr(ord(c) + 0x60) if 'ぁ' <= c <= 'ゖ' else c for c in text)


def answer_kana(text):
    kana = katakana(text)
    # The last unit has the accent, e.g. ニジュウハ'チ; kana fixes every mora.
    if kana.endswith(('イチ', 'ロク', 'シチ', 'ハチ')):
        return kana[:-1] + "'" + kana[-1:]
    if kana.endswith('ジュウ'):
        return kana[:-1] + "'ウ"
    if kana.endswith('サン'):
        return kana[:-1] + "'ン"
    return kana + "'"


def main():
    parser = argparse.ArgumentParser(__doc__)
    for arg in ('runtime', 'dict', 'model'):
        parser.add_argument('--' + arg, required=True)
    parser.add_argument('--banks', nargs='+', help='Regenerate only these banks, preserving the others')
    args = parser.parse_args()
    rows = json.loads(subprocess.check_output(['node', '-e',
        "global.window={};require('./js/data.js');process.stdout.write(JSON.stringify(window.KukuData))"], cwd=ROOT))
    output = ROOT / 'audio' / 'tsumugi'
    output.mkdir(parents=True, exist_ok=True)
    entries = [{'id': 'cue', 'bank': 'cue', 'text': 'いってみよう。せーのっ！', 'kana': None}]
    phrases = json.loads((output / 'phrases.json').read_text())
    entries.extend({'id': key, 'bank': 'messages', 'text': text, 'kana': None} for key, text in phrases.items())
    for q in rows:
        prefix = q.get('q_speak', q['q_read'])
        answer = q.get('a_speak', q['a_read'])
        for kind in ('question', 'full'):
            entries.append({'id': f"{q['a']}-{q['b']}-{kind}", 'bank': f"dan-{q['a']}",
                'text': prefix + (answer if kind == 'full' else ''),
                'kana': katakana(q['q_read']) + "'" + ('/' + answer_kana(q['a_read']) if kind == 'full' else '')})
    manifest = {'credit': 'VOICEVOX:春日部つむぎ', 'core': '0.17.0', 'style': STYLE, 'clips': {}, 'banks': {}}
    if args.banks:
        manifest = json.loads((output / 'manifest.json').read_text())
        manifest['clips'] = {text: clip for text, clip in manifest['clips'].items() if clip['bank'] not in args.banks}
    manifest['phrases'] = phrases
    with Synthesizer(Onnxruntime.load_once(filename=args.runtime), OpenJtalk(args.dict), cpu_num_threads=2) as synth:
        with VoiceModelFile.open(args.model) as model:
            synth.load_voice_model(model)
        for bank in dict.fromkeys(e['bank'] for e in entries):
            if args.banks and bank not in args.banks:
                continue
            samples = bytearray()
            for e in (e for e in entries if e['bank'] == bank):
                query = synth.create_audio_query_from_kana(e['kana'], STYLE) if e['kana'] else synth.create_audio_query(e['text'], STYLE)
                query.speed_scale = 1.0
                query.pre_phoneme_length = .06
                query.post_phoneme_length = .1
                with wave.open(io.BytesIO(synth.synthesis(query, STYLE)), 'rb') as wav:
                    assert wav.getframerate() == RATE and wav.getnchannels() == 1
                    pcm = wav.readframes(wav.getnframes())
                manifest['clips'][e['text']] = {'bank': bank, 'offset': len(samples) / 2 / RATE, 'duration': len(pcm) / 2 / RATE, 'id': e['id']}
                samples.extend(pcm)
                samples.extend(bytes(int(RATE * .12) * 2))
            wav_data = io.BytesIO()
            with wave.open(wav_data, 'wb') as wav:
                wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(RATE); wav.writeframes(samples)
            wav_data.seek(0)
            mp3_data = io.BytesIO()
            with av.open(wav_data) as source, av.open(mp3_data, mode='w', format='mp3') as target:
                stream = target.add_stream('libmp3lame', rate=RATE)
                stream.bit_rate = 64000
                stream.layout = 'mono'
                for frame in source.decode(audio=0):
                    for packet in stream.encode(frame): target.mux(packet)
                for packet in stream.encode(None): target.mux(packet)
            binary = mp3_data.getvalue()
            (output / (bank + '.mp3')).write_bytes(binary)
            # file:// cannot fetch local assets; the same bytes are script-loadable there.
            (output / (bank + '.js')).write_text('KukuVoiceFiles.receive(' + json.dumps(bank) + ',' + json.dumps(base64.b64encode(binary).decode()) + ');\n')
            manifest['banks'][bank] = {'file': f'audio/tsumugi/{bank}.mp3', 'bytes': len(binary)}
            print(bank, len(binary), 'bytes', flush=True)
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'js' / 'voice-manifest.js').write_text('// Generated by tools/generate-voice.py. VOICEVOX:春日部つむぎ\nwindow.KukuVoiceManifest = ' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main()
