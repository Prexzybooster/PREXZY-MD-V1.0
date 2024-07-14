const got = require('got');
const secretKey = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const testModule = require('../test/test');
const checkResult = testModule.iChecker();
const isKeyValid = checkResult == secretKey;

const cheerio = require('cheerio');

if (isKeyValid) {
    function decodeData(...args) {
        function decode(encoded, baseFrom, baseTo) {
            const chars = '0123456789abcdefABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
            const baseFromChars = chars.slice(0, baseFrom);
            const baseToChars = chars.slice(0, baseTo);
            let number = encoded.split('').reverse().reduce((acc, char, index) => {
                if (baseFromChars.includes(char)) {
                    return acc + baseFromChars.indexOf(char) * Math.pow(baseFrom, index);
                }
                return acc;
            }, 0);
            let decoded = '';
            while (number > 0) {
                decoded = baseToChars[number % baseTo] + decoded;
                number = Math.floor(number / baseTo);
            }
            return decoded || '0';
        }

        function decodeString(input, baseFrom, baseTo, offset) {
            let result = '';
            for (let i = 0; i < input.length; i++) {
                let segment = '';
                while (input[i] !== baseFrom[offset]) {
                    segment += input[i];
                    i++;
                }
                for (let j = 0; j < baseFrom.length; j++) {
                    segment = segment.replace(new RegExp(baseFrom[j], 'g'), j.toString());
                }
                result += String.fromCharCode(decode(segment, baseFrom, 10) - offset);
            }
            return decodeURIComponent(encodeURIComponent(result));
        }

        return decodeString(...args);
    }

    const fetchData = {
        id0: async url => {
            try {
                const response = await got('https://snaptik.app/ID');
                const cookie = response.headers['set-cookie']?.map(cookie => cookie.split(';')[0]).join('; ');
                const $ = cheerio.load(response.body);
                const token = $('input[name="token"]').val();
                const result = await got.post('https://snaptik.app/abc2.php', {
                    headers: {
                        'cookie': cookie || '',
                        'referer': 'https://snaptik.app/ID'
                    },
                    searchParams: {
                        url: encodeURI(url),
                        lang: 'ID',
                        token
                    }
                }).text();
                const data = result.split('))</script>')[0].split('decodeURIComponent(escape(')[1]?.split(',')?.map(str => str.replace(/^"/, '').replace(/"$/, '').trim());
                if (!Array.isArray(data) || data.length !== 6) {
                    return false;
                }
                const decodedData = decodeData(...data);
                const content = decodedData.split('innerHTML =')[1].split('$("contents")')[0]?.replace(/\\(\\)?/g, '');
                if (!content) {
                    return {};
                }
                const $$ = cheerio.load(content);
                const links = $$('body > div > div.video-links').find('a');
                let url2 = links.eq(1).attr('href');
                if (!/https?:\/\//.test(url2)) {
                    url2 = 'https://snaptik.app' + url2;
                }
                return {
                    url1: links.eq(0).attr('href'),
                    url2: url2
                };
            } catch (error) {
                return false;
            }
        },
    };

    exports.tiktok = async url => {
        for (const key in fetchData) {
            const result = await fetchData[key](url);
            if (result) {
                return result;
            }
        }
        return false;
    };
}