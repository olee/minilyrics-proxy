import http from 'http';
import { URL } from 'url';

import queryMiniLyrics, { MinilyricsResponse } from './minilyricsApi';

function logResult(error?: Error, result?: MinilyricsResponse) {
    if (error) {
        console.error(error);
    } else {
        console.log(result);
    }
}

// queryMiniLyrics('一番の宝物', '', logResult);
// queryMiniLyrics('Taiyou Iwaku Moeyo Chaos', 'Ushiro Kara Haiyori Tai G', logResult);
// queryMiniLyrics('taiyou', '', logResult);
// queryMiniLyrics('chaosu', '', logResult);
// queryMiniLyrics('Yume no Naka no Watashi no Yume', '', logResult);

function startServer(serverPort = 8000) {
    const server = http.createServer((req, res) => {
        const url = new URL('http://localhost' + req.url!);
    
        if (url.pathname !== '/') {
            res.statusCode = 404;
            res.write('Not found');
            res.end();
            return;
        }
    
        const title = url.searchParams.get('title') || '';
        const artist = url.searchParams.get('artist') || '';
        if (!title && !artist) {
            res.statusCode = 400;
            res.write('Bad request: Missing artist or title query argument');
            res.end();
            return;
        }
    
        console.log(`Querying MiniLyrics API with artist "${artist}" and title "${title}"`);
        queryMiniLyrics(title, artist, (err, result) => {
            if (err) {
                res.statusCode = 400;
                res.end();
            } else {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.write(JSON.stringify(result, undefined, 2));
                res.end();
            }
        });
    });
    server.listen(serverPort);
    console.log(`Started MiniLyrics proxy server on port ${serverPort}`);    
}

const port = parseInt(process.argv[1]) || parseInt(process.argv[2]) || 8000;
startServer(port);
