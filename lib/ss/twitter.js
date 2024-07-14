const cheerio = require('cheerio');
const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { iChecker } = require('../test/test');
const checkerResult = iChecker();
const isValid = checkerResult == encodedString;

const FormData = require('form-data');

if (isValid) {
    const downloaders = {
        dl: async url => {
            const downloadList = [];
            try {
                const response = await fetch('https://squidlr.com/download?url=' + url);
                const text = await response.text();
                const $ = cheerio.load(text);
                $('div.col-md-8').each(function () {
                    const href = $(this).find('.list-group').find('a').attr('href');
                    const quality = $(this).find('.list-group').find('a:nth-child(1)').find('p').text();
                    if (href) {
                        downloadList.push({ url: href, quality });
                    }
                });
                return downloadList;
            } catch (error) {
                return [];
            }
        },
        dl0: async url => {
            try {
                const response = await fetch('https://snaptwitter.com/');
                const text = await response.text();
                const $ = cheerio.load(text);
                const token = $('#get_video > input[type=hidden]:nth-child(2)').val();
                const form = new FormData();
                form.append('url', url);
                form.append('token', token);
                const headers = form.getHeaders();
                const buffer = form.getBuffer();
                const videoResponse = await fetch('https://snaptwitter.com/action.php', {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Linux"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'Referer': 'https://snaptwitter.com/',
                        'Referrer-Policy': 'strict-origin-when-cross-origin'
                    },
                    body: buffer
                });
                const videoData = await videoResponse.json();
                if (videoData.error) {
                    return [];
                }
                const video$ = cheerio.load(videoData.data);
                const href = video$('.abuttons.mb-0 > a')?.attr('href');
                const quality = video$('.abuttons.mb-0 > a')?.text().replace('Download Video (', '').replace(')', '');
                const videoUrl = 'https://snaptwitter.com' + href;
                if (href) {
                    return [{ url: videoUrl, quality }];
                }
            } catch (error) {
                return [];
            }
        }
    };
    exports.twitter = async url => {
        let downloadList = [];
        for (const downloader in downloaders) {
            try {
                const result = await downloaders[downloader](url);
                if (result.length > 0) {
                    downloadList = result;
                    break;
                }
            } catch (error) {
                // handle error
            }
        }
        return downloadList;
    };
}