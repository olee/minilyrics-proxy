function get_my_name() {
    return 'Minilyrics';
}

function get_version() {
    return '0.0.1';
}

function get_author() {
    return 'Olee';
}

var dbg = true;
var api = 'http://bzeutzheim.de:8981/';

function start_search(info, callback) {
    var httpClient = utils.CreateHttpClient();

    var queryUrl = api + '?artist=' + encodeURI(info.Artist) + '&title=' + encodeURI(info.Title);
    console('Query: ' + queryUrl);

    var jsonText = httpClient.Request(queryUrl);
    if (httpClient.StatusCode !== 200) {
        console('Request url ' + queryUrl + ' error: ' + httpClient.StatusCode);
        return;
    }

    var result = JSON.parse(jsonText);
    console('result: ' + result.result);

    if (result.result !== 'OK') {
        console(result.result);
        return;
    }

    console('Found ' + result.children.length + ' lyrics');

    var lyric = callback.CreateLyric();
    lyric.Source = get_my_name();

    for (var i = 0; i < result.children.length; i++) {
        if (callback.IsAborting()) {
            console('User aborted!');
            break;
        }

        var item = result.children[i];

        var lyricsUrl = result.server_url + item.link;
        console('Downloading item ' + (i + 1) + ' from ' + lyricsUrl);

        var lyricsText = httpClient.Request(lyricsUrl);
        if (httpClient.StatusCode !== 200) {
            console('Request url ' + lyricsUrl + ' error: ' + httpClient.StatusCode);
            continue;
        }

        lyric.Title = item.title;
        lyric.Artist = item.artist;
        lyric.Album = item.album;
        lyric.LyricText = lyricsText;
        callback.AddLyric(lyric);
    }
    lyric.Dispose();
}

function console(s) {
    dbg && fb.trace('ESLyrics source ' + get_my_name() + ': ' + s);
}

// if (!Array.prototype.filter) {
//     Array.prototype.filter = function (func, thisArg) {
//         'use strict';
//         if (!((typeof func === 'Function' || typeof func === 'function') && this))
//             throw new TypeError();

//         var len = this.length >>> 0,
//             res = new Array(len), // preallocate array
//             t = this, c = 0, i = -1;
//         if (thisArg === undefined) {
//             while (++i !== len) {
//                 // checks to see if the key was set
//                 if (i in this) {
//                     if (func(t[i], i, t)) {
//                         res[c++] = t[i];
//                     }
//                 }
//             }
//         }
//         else {
//             while (++i !== len) {
//                 // checks to see if the key was set
//                 if (i in this) {
//                     if (func.call(thisArg, t[i], i, t)) {
//                         res[c++] = t[i];
//                     }
//                 }
//             }
//         }

//         res.length = c; // shrink down array to proper size
//         return res;
//     };
// }
