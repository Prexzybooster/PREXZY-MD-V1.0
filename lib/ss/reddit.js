const cheerio = require('cheerio');
const got = require('got');

exports.reddit = async (url) => {
    let videoUrl = '';
    try {
        const response = await got('https://savemp4.red/backend.php?url=' + url);
        const $ = cheerio.load(response.body);
        videoUrl = $('.card-body > a').attr('href');
    } catch (error) {
        // handle error
    }
    return videoUrl;
};