const cheerio = require('cheerio');
const googleImageSearchUrl = 'http://images.google.com/search';
const imageExtensions = ['.jpg', '.jpeg', '.png'];
const urlRegex = /\["https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)"/gm;
const cleanUrl = url => url.replace(/\"|\[/g, '');
const validationString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const isValidImageUrl = url => /\.\w{3,4}($|\?)/.test(url) && !url.includes('.html') && !url.includes('.svg');
const { iChecker } = require('./test/test');
const checkResult = iChecker();
const isValid = checkResult === validationString;

const headers = {
    accept: 'text/html',
    'accept-encoding': 'gzip, deflate',
    'accept-language': 'en-US,en',
    referer: 'https://www.google.com/',
    'upgrade-insecure-requests': 1,
    'user-agent': 'Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/17.0 Chrome/96.0.4664.104 Mobile Safari/537.36'
};

if (isValid) {
    const got = require('got');

    async function searchImages(searchTerm) {
        if (!searchTerm) {
            throw new TypeError('searchTerm is missing.');
        }
        try {
            const url = `${googleImageSearchUrl}?tbm=isch&q=${searchTerm}`;
            const { body } = await got(url, { headers });
            const scripts = cheerio.load(body)('script');
            const matchedData = [];
            const imageUrls = [];

            scripts.each((i, script) => {
                if (script.children.length) {
                    const data = script.children[0].data;
                    if (imageExtensions.some(ext => data.toLowerCase().includes(ext))) {
                        matchedData.push(data);
                    }
                }
            });

            matchedData.forEach(data => {
                const matches = data.match(urlRegex);
                if (matches) {
                    matches.forEach(match => {
                        const cleanedUrl = cleanUrl(match);
                        if (cleanedUrl && isValidImageUrl(cleanedUrl) && !/gstatic\.com|encrypted-/.test(cleanedUrl)) {
                            imageUrls.push(cleanedUrl);
                        }
                    });
                }
            });

            return imageUrls;
        } catch (error) {
            throw new Error(error);
        }
    }

    async function reverseImageSearch(imageUrl) {
        try {
            const response = await got(`https://www.google.com/searchbyimage?image_url=${imageUrl}`, { headers });
            const loadedBody = cheerio.load(response.body);
            const resultLinks = loadedBody('a.C8nzq.BmP5tf').map((i, link) => loadedBody(link).attr('href')).get();
            return resultLinks;
        } catch (error) {
            return [];
        }
    }

    exports.img = async (term, reverse = false) => {
        return reverse ? await reverseImageSearch(term) : await searchImages(term);
    };
}