const got = require('got');
const cheerio = require('cheerio');

const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const decodedString = iChecker() === encodedString;

async function fetchStoryLinks(storyId) {
    try {
        const response = await got.post('https://snapinsta.app/action.php', {
            form: {
                url: `https://instagram.com/stories/${storyId}/`,
                action: 'post'
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                origin: 'https://snapinsta.app',
                referer: 'https://snapinsta.app/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36'
            }
        }).text();
        
        const $ = cheerio.load(response);
        
        const downloadLinks = [];
        $('.row.download-box > div.col-md-4').each(function () {
            const link = $(this).find('.download-items__btn > a[href]').attr('href');
            if (link) {
                downloadLinks.push(link);
            }
        });
        
        return downloadLinks;
    } catch {
        return [];
    }
}

async function fetchStoryLinksFromInstagramSave(storyId) {
    try {
        const headers = {
            accept: '*/*',
            cookie: '_ga=GA1.2.1814586753.1642307018; _gid=GA1.2.136857157.1642307018; __gads=ID=6f5ca6608dd8b1e9-22e4ea18ffcf0077:T=1642307019:RT=1642307019:S=ALNI_MZA7NeGtOEcSPXyFhf4LY8w7Myg9g; PHPSESSID=1i9dscs75l6v2h17cvdtd587b4; _gat=1; FCNEC=[["AKsRol9R3FQaOjrrETFMIMIvWtuoY3xRHpQEPHMujRWOd_nxuLgWCSyYK9lLC3ev0L5V8fuaSIjhupCtaReRepP4qNvch536pzvrcU13Gh8CRHSEIh8O3zM42ASwGUQfjoKbxkTV1L15EA6O7FLZ-Qh3Fy1rvh_h8w=="],null,[]]',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36'
        };
        
        const response = await got('https://www.instagramsave.com/instagram-story-downloader.php', {
            headers: {
                ...headers,
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                referer: 'https://www.google.com/'
            }
        }).text();
        
        const $ = cheerio.load(response);
        const form = {
            url: `https://www.instagram.com/${storyId}`,
            action: 'story',
            token: $('#token').val(),
            json: ''
        };
        
        const { medias, error } = await got('https://www.instagramsave.com/system/action.php', {
            form,
            method: 'POST',
            headers: {
                ...headers,
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                origin: 'https://www.instagramsave.com',
                referer: 'https://www.instagramsave.com/instagram-story-downloader.php'
            }
        }).json();
        
        if (error || !medias) {
            return [];
        }
        
        return medias.map(media => media.url);
    } catch {
        return [];
    }
}

exports.story = async (url) => {
    if (url.includes('/stories/')) {
        const start = url.indexOf('/stories/') + 9;
        const end = url.lastIndexOf('/');
        url = url.substring(start, end);
    }
    
    try {
        const { body } = await got(`https://levanter.onrender.com/story?id=${url}`);
        const { status, result } = JSON.parse(body);
        if (status) {
            return result;
        }
    } catch {
        try {
            const { body } = await got(`https://levanter.onrender.com/story?id=${url}`);
            const { status, result } = JSON.parse(body);
            if (status) {
                return result;
            }
        } catch {}
    }
    
    const downloaders = [fetchStoryLinks, fetchStoryLinksFromInstagramSave];
    for (const downloader of downloaders) {
        const links = await downloader(url);
        if (links.length > 0) {
            return links;
        }
    }
    
    return [];
};