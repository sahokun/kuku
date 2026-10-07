/* Prepared recordings, shared by HTTP hosting and direct file:// preview. */
window.KukuVoiceFiles = (() => {
    const buffers = new Map(), pending = new Map(), downloads = new Map(), local = new Map();
    const manifest = window.KukuVoiceManifest;
    async function bytes(bank) {
        const file = manifest.banks[bank].file;
        if (location.protocol !== 'file:') {
            const response = await fetch(file, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw Error('Voice file unavailable: ' + bank);
            return response.arrayBuffer();
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timeout = setTimeout(() => finish(Error('Voice file timeout: ' + bank)), 15000);
            function finish(error, data) {
                clearTimeout(timeout); local.delete(bank); script.remove();
                error ? reject(error) : resolve(data);
            }
            local.set(bank, encoded => {
                try { finish(null, Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer); }
                catch (error) { finish(error); }
            });
            script.src = file.replace(/\.mp3$/, '.js');
            script.onerror = () => finish(Error('Voice file unavailable: ' + bank));
            document.head.append(script);
        });
    }
    function load(context, bank) {
        if (buffers.has(bank)) return Promise.resolve(buffers.get(bank));
        if (!pending.has(bank)) {
            const promise = download(bank).then(data => context.decodeAudioData(data.slice(0))).then(buffer => {
                buffers.set(bank, buffer); return buffer;
            }).finally(() => pending.delete(bank));
            pending.set(bank, promise);
        }
        return pending.get(bank);
    }
    function download(bank) {
        if (!downloads.has(bank)) downloads.set(bank, bytes(bank).catch(error => { downloads.delete(bank); throw error; }));
        return downloads.get(bank);
    }
    const unique = banks => [...new Set(banks || Object.keys(manifest.banks))];
    return {
        receive(bank, encoded) { local.get(bank)?.(encoded); },
        clip(text) { return manifest?.clips[text]; },
        ready(banks) { return unique(banks).every(bank => buffers.has(bank)); },
        async prefetch(banks) {
            // Compressed bytes only: no audio device or decoding during home navigation.
            await Promise.all(unique(banks).map(bank => download(bank)));
        },
        async prepare(context, banks) {
            const selected = unique(banks);
            // Only this course's banks, with at most two simultaneous decodes.
            for (let i = 0; i < selected.length; i += 2) await Promise.all(selected.slice(i, i + 2).map(bank => load(context, bank)));
        },
        async get(context, text) {
            const clip = manifest?.clips[text];
            if (!clip) throw Error('Missing voice recording');
            return { ...clip, buffer: await load(context, clip.bank) };
        }
    };
})();
