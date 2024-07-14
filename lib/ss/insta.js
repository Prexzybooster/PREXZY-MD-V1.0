const cheerio = require('cheerio');
const got = require('got');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checker = iChecker();
const isValid = checker == encodedString;

if (isValid) {
    function decodeAndExecute(...args) {
        const operations = {
            notEqual: function (a, b) {
                return a !== b;
            },
            baseString: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/',
            divide: function (a, b) {
                return a / b;
            },
            lessThan: function (a, b) {
                return a < b;
            },
            subtract: function (a, b) {
                return a - b;
            },
            executeFunc: function (func, a, b, c) {
                return func(a, b, c);
            },
            wrapFunc: function (func) {
                return func();
            }
        };

        function baseConvert(input, base, targetBase) {
            const baseChars = operations.baseString.split('');
            const inputBaseChars = baseChars.slice(0, base);
            const targetBaseChars = baseChars.slice(0, targetBase);
            let num = input.split('').reverse().reduce(function (sum, char, index) {
                if (operations.notEqual(inputBaseChars.indexOf(char), -1)) {
                    return sum += inputBaseChars.indexOf(char) * Math.pow(base, index);
                }
            }, 0);
            let result = '';
            while (num > 0) {
                result = targetBaseChars[num % targetBase] + result;
                num = operations.divide(operations.subtract(num, num % targetBase), targetBase);
            }
            return result || '0';
        }

        function decodeString(encoded, base, shift, offset, targetBase, decoded) {
            decoded = '';
            for (let i = 0, length = encoded.length; operations.lessThan(i, length); i++) {
                let part = '';
                while (operations.notEqual(encoded[i], shift[targetBase])) {
                    part += encoded[i];
                    i++;
                }
                for (let j = 0; operations.lessThan(j, shift.length); j++) {
                    part = part.replace(new RegExp(shift[j], 'g'), j.toString());
                }
                decoded += String.fromCharCode(operations.subtract(operations.executeFunc(baseConvert, part, targetBase, 10), offset));
            }
            return decodeURIComponent(operations.wrapFunc(encodeURIComponent, decoded));
        }

        return operations.wrapFunc(decodeString, ...args);
    }

    const downloader = {
        dl0: async (url) => {
            const settings = {
                selector: 'div > a',
                attribute: 'href',
                baseUrl: 'https://indown.io/download',
                contentType: 'application/x-www-form-urlencoded',
                userAgent: '"Chromium";v="116", "Not A;Brand";v="24", "Google Chrome";v="116"',
                navigation: 'navigate',
                fetchMode: 'same-origin',
                cookie: 'XSRF-TOKEN=eyJpdiI6InBlNmdkZXUwSjZCann0RGxCUWZEVkE9PSIsInZhbHVlIjo...'
            };
            try {
                const response = await fetch(settings.baseUrl, {
                    headers: {
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'accept-language': 'en-GB,en;q=0.9',
                        'cache-control': 'max-age=0',
                        'content-type': settings.contentType,
                        'sec-ch-ua': settings.userAgent,
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Linux"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': settings.navigation,
                        'sec-fetch-site': settings.fetchMode,
                        'upgrade-insecure-requests': '1',
                        'cookie': settings.cookie,
                        'Referer': settings.baseUrl,
                        'Referrer-Policy': 'strict-origin-when-cross-origin'
                    },
                    body: `referer=https://indown.io/reels&locale=en&_token=${encodeURIComponent(url)}`,
                    method: 'POST'
                });
                const html = await response.text();
                const $ = cheerio.load(html);
                const results = [];
                $('#result > div > div').each(function () {
                    const link = $(this).find(settings.selector).attr(settings.attribute);
                    if (link) {
                        results.push(link);
                    }
                });
                return results;
            } catch (error) {
                return [];
            }
        }
    };

    const urlPattern = /(https?:\/\/(?:www\.)?instagram\.com\/(?:.*\/|)(reel|p|tv)\/([-_0-9A-Za-z]+))./;
    exports.instagram = async (url) => {
        const match = urlPattern.exec(url);
        if (!match || match[3].length > 11) {
            return [];
        }
        url = `https://www.instagram.com/${match[2]}/${match[3]}/`;
        for (const key in downloader) {
            try {
                const links = await downloader[key](url);
                if (links.length > 0) {
                    return links;
                }
            } catch (error) {}
        }
        return [];
    };
}