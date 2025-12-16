const { Innertube } = require('youtubei.js');
const fs = require('fs');

async function testFetch(videoId) {
    const logs = [];
    const log = (...args) => {
        console.log(...args);
        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
    };

    log(`Testing video ID: ${videoId}`);
    try {
        log('Attempting with default client...');
        let youtube = await Innertube.create();
        try {
            await youtube.getInfo(videoId);
        } catch (e) {
            log('Default client failed:', e.message);
            log('Attempting with ANDROID client...');
            // Try ANDROID client
            youtube = await Innertube.create({
                lang: 'en',
                location: 'US',
                retrieve_player: false,
                client_type: 'ANDROID'
            });
        }

        // Note: Innertube.create accepts options. passing simple object might not be enough to switch client if not documented.
        // But let's try standard create first, maybe with cookie or something? No, keep it simple.
        // Actually, checking library usage, maybe it needs po_token?
        // Let's just try to persist with what we have but maybe catch the error better.

        // Let's try explicit 'WEB' if supported, or just retry.
        // Re-instantiate for clean state

        log('Getting info...');
        const info = await youtube.getInfo(videoId);

        log('GetInfo result keys:', Object.keys(info));
        // Check if we have transcript capability
        try {
            const transcriptData = await info.getTranscript();
            log('Transcript data keys:', Object.keys(transcriptData));
            if (transcriptData.transcript) {
                log('Success! Found transcript.');
                if (transcriptData.transcript.content && transcriptData.transcript.content.body) {
                    log('Sample content:', JSON.stringify(transcriptData.transcript.content.body.initial_segments[0], null, 2));
                }
            }
        } catch (tErr) {
            log('getTranscript failed:', tErr.message);
            log('Full error:', JSON.stringify(tErr, Object.getOwnPropertyNames(tErr), 2));
        }

    } catch (error) {
        log('Fetch failed:', error.message);
        log('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }

    fs.writeFileSync('debug-output.txt', logs.join('\n'));
}

testFetch('1HalL6d2gqQ');
