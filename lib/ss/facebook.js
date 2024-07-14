const got = require('got');
const cheerio = require('cheerio');
const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checkerResult = iChecker();
const isValid = checkerResult == encodedString;

if (isValid) {
    exports.mediafire = async function (url) {
        if (!/https?:\/\/(www\.)?mediafire\.com/.test(url)) {
            return;
        }
        const response = await got(url).text();
        const $ = cheerio.load(response);
        const downloadLink = ($('#downloadButton').attr('href') || '').trim();
        return downloadLink;
    };
}