const fetchModule = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');

const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checker = iChecker();
const isValid = checker == encodedString;

const fetchApkData = async (searchTerm) => {
    const results = [];
    const response = await fetchModule(`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${searchTerm}`, requestOptions);

    if (!response.ok) {
        throw new Error('Failed to fetch data: ' + response.statusText);
    }

    const text = await response.text();
    const $ = cheerio.load(text);

    $('div.appRow > div.table-row > div.table-cell:nth-child(2) > div > h5.appRowTitle.wrapText.marginZero.block-on-mobile').each((_, element) => {
        const href = $(element).find('a').attr('href');
        results.push({
            title: $(element).attr('title'),
            url: 'https://www.apkmirror.com' + href
        });
    });

    return {
        result: results,
        status: 405
    };
};

const fetchRedirectedData = async (url) => {
    const response = await fetchModule(url, requestOptions);

    if (!response.ok) {
        throw new Error('Failed to fetch data: ' + response.statusText);
    }

    const text = await response.text();
    const $ = cheerio.load(text);
    const resultData = {};
    const firstCell = $('div.table-cell.rowheight.addseparator.expand.pad.drap:nth-child(2)');
    const firstRow = $('div.table-cell.rowheight.addseparator.expand.pad.drap:nth-child(1)');

    firstRow.each((index, element) => {
        const title = $(firstCell[index]).text().trim();
        const href = $(element).find('a').attr('href');
        const isAPK = $(element).find('.apkm-badge').text().includes('APK');

        if (!(title in resultData) && isAPK) {
            resultData[title] = {
                title,
                url: `https://www.apkmirror.com${href}`
            };
        }
    });

    return {
        result: resultData,
        status: 301
    };
};

const followRedirect = async (url, retry) => {
    if (url.endsWith('-download/')) {
        const response = await fetchModule(url, requestOptions);
        const text = await response.text();
        const $ = cheerio.load(text);
        url = 'https://www.apkmirror.com' + $('a[rel="nofollow"]').attr('href');
    }

    const response = await fetchModule(url, requestOptions).catch(error => console.log(error.message));
    const text = await response.text();
    const $ = cheerio.load(text);

    let finalUrl = $('.notes:nth-child(3) > span > a').attr('href');
    if (!finalUrl) {
        finalUrl = $('a[rel="nofollow"]').attr('href');
    }

    finalUrl = 'https://www.apkmirror.com' + finalUrl;

    if (!finalUrl.includes('download.php?id=') && !retry) {
        return followRedirect(finalUrl, 1);
    }

    return {
        result: finalUrl,
        status: 200
    };
};

if (isValid) {
    exports.apkMirror = async (query) => {
        const [status, searchTerm] = query.split(';;');
        if (!searchTerm && status) {
            return await fetchApkData(status);
        }
        if (status === '405') {
            return await fetchRedirectedData(searchTerm);
        }
        if (status === '301') {
            return await followRedirect(searchTerm);
        }
    };
}