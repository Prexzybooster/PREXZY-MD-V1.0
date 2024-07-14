const cheerio = require('cheerio');
const cache = {};
const got = require('got');
const fetch = require('../fetch');
const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checkerResult = iChecker();
const isValid = checkerResult == encodedString;

if (isValid) {
    exports.y2mate = {
        get: async function (id) {
            try {
                const response = await fetch.getJson(`https://levanter.onrender.com/y2get?id=${id}`);
                if (response) {
                    return response;
                }
            } catch (error) {
                // handle error
            }
            
            const postData = {
                url: `https://www.youtube.com/watch?v=${id}`,
                q_auto: 0,
                ajax: 1
            };
            const headers = {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                cookie: '_ga=GA1.2.1405332118.1641699259; _gid=GA1.2.70284915.1642387108; _gat_gtag_UA_84863187_23=1',
                origin: 'https://www.y2mate.com'
            };
            
            const response = await got.post('https://www.y2mate.com/mates/analyze/ajax', {
                headers,
                form: postData
            }).json();
            
            const $ = cheerio.load(response.result);
            const videoId = (/var k__id = "(.*?)"/.exec($.html()) || ['', ''])[1];
            const dataVid = (/var k_data_vid = "(.*?)"/.exec($.html()) || ['', ''])[1];
            const thumbnail = $('.video-thumbnail > img').attr('src');
            const title = $('div.caption > b').text().trim();
            const video = {};
            const audio = {};
            
            $('#mp4 > table > tbody > tr').each(function () {
                const row = $(this).find('td');
                const quality = row.find('a').attr('data-fquality');
                const fileSize = row.find('td:nth-child(2)').text();
                if (row.find('a').attr('data-ftype') == 'mp4') {
                    video[quality] = {
                        quality,
                        fileSizeH: fileSize,
                        fileSize: parseFloat(fileSize) * (/MB$/.test(fileSize) ? 1000 : 1),
                        download: {
                            _id: videoId,
                            v_id: dataVid,
                            ftype: 'mp4',
                            fquality: quality
                        }
                    };
                }
            });
            
            $('#mp3 > table > tbody > tr').each(function () {
                const row = $(this).find('td');
                const quality = row.find('a').attr('data-fquality');
                const fileSize = row.find('td:nth-child(2)').text();
                audio[quality] = {
                    quality,
                    fileSizeH: fileSize,
                    fileSize: parseFloat(fileSize) * (/MB$/.test(fileSize) ? 1000 : 1),
                    download: {
                        _id: videoId,
                        v_id: dataVid,
                        ftype: 'mp3',
                        fquality: quality
                    }
                };
            });
            
            const result = {
                title,
                thumbnail,
                video,
                audio
            };
            cache[id] = result;
            return result;
        },
        dl: async function (id, type, quality) {
            try {
                const response = await fetch.getJson(`https://levanter.onrender.com/y2dl?id=${id}&t=${type}&q=${quality || '128kbps'}`);
                if (response) {
                    return response;
                }
            } catch (error) {
                // handle error
            }
            
            if (!cache[id]) {
                await exports.y2mate.get(id);
                if (!cache[id]) {
                    return false;
                }
            }
            
            if (type === 'audio' && !quality) {
                quality = Object.keys(cache[id][type])[0];
            }
            
            const { _id, v_id, ftype, fquality } = cache[id][type][quality].download;
            const postData = {
                type: 'youtube',
                v_id,
                ajax: '1',
                token: '',
                ftype,
                fquality,
                _id
            };
            
            const response = await got.post('https://www.y2mate.com/mates/convert', {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    cookie: '_ga=GA1.2.1405332118.1641699259; _gid=GA1.2.1117783105.1641699259; MarketGidStorage=%7B%220%22%3A%7B%7D%2C%22C702514%22%3A%7B%22page%22%3A2%2C%22time%22%3A1641701743540%7D%7D; _PN_SBSCRBR_FALLBACK_DENIED=1641701744162',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
                },
                form: postData
            }).json();
            
            const $ = cheerio.load(response.result);
            const downloadLink = $('a[href]').attr('href');
            if (downloadLink === 'https://app.y2mate.com/download') {
                return false;
            }
            return downloadLink;
        }
    };
}