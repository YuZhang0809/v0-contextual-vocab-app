const { YoutubeTranscript } = require('youtube-transcript');

async function testFetch(videoId) {
    console.log(`Testing video ID: ${videoId}`);
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        console.log('Success! Found ' + transcript.length + ' items.');
        console.log('First item:', transcript[0]);
    } catch (error) {
        console.error('English fetch failed:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        try {
            console.log('Trying default language...');
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            console.log('Success (default)! Found ' + transcript.length + ' items.');
        } catch (e) {
            console.error('Default fetch failed:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
        }
    }
}

// Test with a known video (TED talk)
testFetch('1HalL6d2gqQ');
