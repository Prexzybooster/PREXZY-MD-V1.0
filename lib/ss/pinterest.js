const got = require('got');
const cheerio = require('cheerio');
const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checkerResult = iChecker();
const isValid = checkerResult == encodedString;

if (isValid) {
    exports.pinterest = async function (url) {
        try {
            if (!url.includes('www.pinterest.com/pin/')) {
                const response = await got(url);
                url = response.url;
            }
        } catch (error) {
            // handle error
        }

        const videoUrls = [];
        const formData = { url };
        
        const responseText = await got('https://pinterestvideodownloader.com/', {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4209.3 Mobile Safari/537.36',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
            },
            form: formData
        }).text();
        
        const $ = cheerio.load(responseText);

        $('div.col-sm-12 > a').each(function () {
            const videoUrl = $(this).attr('href');
            if (videoUrl && videoUrl.startsWith('http')) {
                videoUrls.push(videoUrl);
            }
        });

        const tableEntries = {};

        $('table > tbody > tr').each(function (index, element) {
            const firstCellText = $($(element).find('td')[0]).text();
            if (firstCellText != '') {
                const videoUrl = $($(element).find('td')[0]).find('a').attr('href');
                const videoId = videoUrl.split('/').pop();
                if (!(videoId in tableEntries)) {
                    tableEntries[videoId] = videoUrl;
                }
            }
        });

        for (const videoId in tableEntries) {
            const videoUrl = videoUrls.find(url => url == tableEntries[videoId]);
            if (!videoUrl) {
                videoUrls.push(tableEntries[videoId]);
            }
        }

        return videoUrls;
    };
}