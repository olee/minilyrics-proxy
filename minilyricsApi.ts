import http from 'http';
import crypto from 'crypto';

export interface MinilyricsResponse {
    _type: 'return';
    orgcmd: string;
    result: 'OK' | 'NOT_FOUND';
    badrc: string;
    ls_dd: string;
    server_url: string;
    children: LyricsItem[];
}

export interface LyricsItem {
    _type: 'fileinfo';
    link: string;
    artist?: string;
    title?: string;
    album?: string;
    uploader?: string;
    rate?: string;
    ratecount?: number;
    downloads?: number;
    timelength?: number;
}

export default function queryMiniLyrics(title: string, artist: string, cb: (error: Error | undefined, data?: MinilyricsResponse) => void) {
    // Send request
    const req = http.request({
        hostname: 'search.crintsoft.com',
        path: '/searchlyrics.htm',
        method: 'POST',
        headers: {
            'User-Agent': 'MiniLyrics',
        }
    }, response => {
        let buffer: Buffer | undefined;
        response.on('data', (buff) => {
            buffer = !buffer ? buff : Buffer.concat([buffer, buff]);
        });
        response.on('end', function () {
            const reader = new CompressedXmlReader(decryptBuffer(buffer!));
            const result = reader.read() as MinilyricsResponse;
            cb(undefined, result);
        });
    });
    req.on('error', (error) => {
        cb(error);
    });

    const query = `<?xml version='1.0' encoding='utf-8' ?>` +
        `<searchV1 filetype="lyrics" ClientCharEncoding="utf-8" artist="${artist || ''}" title="${title || ''}" OnlyMatched="1" client="MiniLyrics" RequestPage="0" />`;
    const reqBuffer = Buffer.from(encryptString(query));

    req.write(reqBuffer);
    req.end();
}

function strToUtf8Bytes(str: string) {
    const utf8: number[] = [];
    for (let ii = 0; ii < str.length; ii++) {
        let charCode = str.charCodeAt(ii);
        if (charCode < 0x80) utf8.push(charCode);
        else if (charCode < 0x800) {
            utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
        } else if (charCode < 0xd800 || charCode >= 0xe000) {
            utf8.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
        } else {
            ii++;
            // Surrogate pair:
            // UTF-16 encodes 0x10000-0x10FFFF by subtracting 0x10000 and
            // splitting the 20 bits of 0x0-0xFFFFF into two halves
            charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(ii) & 0x3ff));
            utf8.push(
                0xf0 | (charCode >> 18),
                0x80 | ((charCode >> 12) & 0x3f),
                0x80 | ((charCode >> 6) & 0x3f),
                0x80 | (charCode & 0x3f),
            );
        }
    }
    return utf8;
}

function utf8ArrayToString(aBytes: number[] | Uint8Array | Buffer) {
    var sView = "";
    for (var nPart, nLen = aBytes.length, nIdx = 0; nIdx < nLen; nIdx++) {
        nPart = aBytes[nIdx];
        sView += String.fromCharCode(
            nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */
                /* (nPart - 252 << 30) may be not so safe in ECMAScript! So...: */
                (nPart - 252) * 1073741824 +
                (aBytes[++nIdx] - 128 << 24) +
                (aBytes[++nIdx] - 128 << 18) +
                (aBytes[++nIdx] - 128 << 12) +
                (aBytes[++nIdx] - 128 << 6) +
                aBytes[++nIdx] - 128
                : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */
                    (nPart - 248 << 24) +
                    (aBytes[++nIdx] - 128 << 18) +
                    (aBytes[++nIdx] - 128 << 12) +
                    (aBytes[++nIdx] - 128 << 6) +
                    aBytes[++nIdx] - 128
                    : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */
                        (nPart - 240 << 18) +
                        (aBytes[++nIdx] - 128 << 12) +
                        (aBytes[++nIdx] - 128 << 6) +
                        aBytes[++nIdx] - 128
                        : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */
                            (nPart - 224 << 12) +
                            (aBytes[++nIdx] - 128 << 6) +
                            aBytes[++nIdx] - 128
                            : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */
                                (nPart - 192 << 6) +
                                aBytes[++nIdx] - 128
                                : /* nPart < 127 ? */ /* one byte */
                                nPart
        );
    }
    return sView;
}

function encryptString(query: string) {
    const queryBytes = strToUtf8Bytes(query);
    const md5Bytes = crypto.createHash('md5').update(query + 'Mlv1clt4.0').digest();

    // Generate encryption key
    const byteSum = queryBytes.reduce((v, x) => v + x, 0);
    const key = Math.floor(byteSum / queryBytes.length) & 255;

    // Value is encrypted
    for (let i = 0; i < queryBytes.length; i++) {
        queryBytes[i] = key ^ queryBytes[i];
    }

    // Final data byte array
    let data = [
        0x02,
        key,
        0x04,
        0x00,
        0x00,
        0x00,
        ...md5Bytes,
        ...queryBytes,
    ];
    return data;
}

function decryptBuffer(byteBuffer: Buffer) {
    const k = byteBuffer.readInt8(1) & 255;
    const valueBuffer = byteBuffer.slice(22, byteBuffer.length);
    for (let i = 0; i < valueBuffer.length; i++) {
        valueBuffer[i] = (valueBuffer.readInt8(i) ^ k) & 255;
    }
    return valueBuffer;
}

class CompressedXmlReader {

    public position = 0;

    private stringTable: string[] = [];

    constructor(public readonly buffer: Buffer) { }

    private peekByte() {
        return this.buffer.readUInt8(this.position);
    }

    private readByte() {
        const v = this.peekByte();
        this.position++;
        return v;
    }

    private expectByte(x: number) {
        const v = this.readByte();
        if (v !== x) {
            throw new Error(`Expected (${x}), but got (${v})`);
        }
        return v;
    }

    private readChar() {
        return String.fromCharCode(this.readByte());
    }

    private readInt() {
        const v = this.buffer.readUInt32LE(this.position);
        this.position += 4;
        return v;
    }

    private readSlice(byteCount?: number) {
        if (byteCount === undefined) byteCount = this.buffer.length - this.position + 1;
        const v = this.buffer.slice(this.position, this.position + byteCount);
        this.position += byteCount;
        return v;
    }

    private popValue() {
        return this.stringTable[this.readByte() - 10];;
    }

    private readHeader() {
        if (this.readChar() !== 'M' ||
            this.readChar() !== 'B' ||
            this.readChar() !== 'X' ||
            this.readChar() !== 'M' ||
            this.readChar() !== 'L' ||
            this.readChar() !== '1') {
            throw new Error('MBXML header missmatch');
        }
        if (this.readInt() !== 2)
            throw new Error('Header version mismatch');
        // end of stream is encoded here, but it counts starting from the header (MBXML1)
        const fileEnd = this.readInt() - 6 - 4 - 4 - 2;
    }

    private readStringTable() {
        if (this.readChar() !== 'S' || this.readChar() !== 'T') {
            throw new Error('String table header missmatch');
        }

        // size of string table in bytes 
        // (including both int32 values at the beginning)
        const stSize = this.readInt() - 8;

        // Number of strings in the string table
        const stCount = this.readInt();

        // console.log('fileEnd =', fileEnd, fileEnd.toString(16));
        // console.log('stSize =', stSize, stSize.toString(16));
        // console.log('stCount =', stCount);
        // Convert utf-8 bytes in string table to string

        const stringTableStr = utf8ArrayToString(this.readSlice(stSize));

        // Split by 0-byte
        this.stringTable = stringTableStr.split('\x00');
        this.stringTable.pop();

        if (this.stringTable.length !== stCount) {
            console.warn(`String table should contain ${stCount} items, but has ${this.stringTable.length}`);
        }
    }

    private readElement() {
        this.expectByte(2);
        const node: any = { _type: this.popValue(), };
        // Parse attributes
        while (this.peekByte() >= 10) {
            const key = this.stringTable[this.readByte() - 10];
            const value = this.stringTable[this.readByte() - 10];
            node[key] = value;
        }
        // Parse children if present
        if (this.peekByte() === 3) {
            this.position++;
            node.children = [];
            // loop until no next child found
            while (this.peekByte() !== 4) {
                node.children.push(this.readElement());
            }
        }
        this.expectByte(4);
        return node;
    }

    public read() {
        this.readHeader();

        // String table (ST) start
        this.readStringTable();

        // Number of xml entries
        const nodeCount = this.readInt();
        return this.readElement();
    }
}
