const { ANTIWORDS } = require('../config');
const { getAntiLink, getWord } = require('./db');
const { getFloor } = require('./utils');
const http = require('http');

const emailRegex = new RegExp('\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b');
const numberRegex = new RegExp('^[0-9]');

async function checkHostExists(host) {
    return await new Promise(resolve => {
        const options = { method: 'HEAD', host: host };
        const req = http.request(options, res => {
            resolve(true);
        });
        req.on('error', () => {
            resolve(false);
        });
        req.end();
    });
}

const checkSpam = function (inputArray = [], patternsArray = [], specialPatternsArray = []) {
    let matchCount = 0;
    let specialMatchCount = 0;
    for (const input of inputArray) {
        for (const pattern of patternsArray) {
            const regex = new RegExp(pattern, 'iu');
            if (regex.test(input)) {
                matchCount++;
            }
        }
        for (const pattern of specialPatternsArray) {
            const regex = new RegExp(pattern, 'iu');
            if (regex.test(input)) {
                specialMatchCount++;
            }
        }
    }
    if (specialPatternsArray.length) {
        return specialMatchCount > 0 && matchCount == 0;
    }
    return specialMatchCount > 0 ? true : inputArray.length != matchCount;
};

const urlCache = new Map();

exports.isAntiLink = async function (message, chatId) {
    let urls = message.match(/(?:(http|https):\/\/)?(?:[\w-]+\.)+([\w.@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?\b/gi)?.filter(url => !numberRegex.test(url));
    if (!urls || !urls.length) {
        return false;
    }
    const antiLinkConfig = await getAntiLink(chatId);
    if (!antiLinkConfig) {
        return false;
    }
    let { enabled, action, allowedUrls } = antiLinkConfig;
    if (!enabled) {
        return false;
    }
    const validUrls = [];
    for (const url of urls) {
        let host = url;
        try {
            const parsedUrl = new URL(url);
            host = parsedUrl.host;
        } catch (e) {}

        let isValid = false;
        if (!emailRegex.test(url)) {
            if (!urlCache.has(host)) {
                urlCache.set(host, await checkHostExists(host));
            }
            isValid = urlCache.get(host);
        }
        validUrls.push({ url, isValid });
    }
    urls = validUrls.filter(item => item.isValid).map(item => item.url);
    if (!urls.length) {
        return false;
    }
    if (allowedUrls === 'all') {
        return action;
    }
    if (allowedUrls) {
        const allowedList = allowedUrls.split(',');
        const includedUrls = allowedList.filter(url => !url.startsWith('!'));
        const excludedUrls = allowedList.filter(url => url.startsWith('!')).map(url => url.replace('!', ''));
        const isValid = checkSpam(urls, includedUrls, excludedUrls);
        return isValid ? action : false;
    }
};

exports.spamCheck = function (userId, chatId, key, score, prevMessage) {
    const now = Math.floor(new Date().getTime() / 1000);
    if (!(userId in temp.spam)) {
        temp.spam[userId] = {};
    }
    const userSpamData = {
        cool: 0,
        keys: [],
        score: 0,
        index: 0,
        prev: ''
    };
    if (!(chatId in temp.spam[userId])) {
        temp.spam[userId][chatId] = userSpamData;
    }
    if (prevMessage) {
        if (temp.spam[userId][chatId].prev === prevMessage) {
            score = score > 4.5 ? score : 4.5;
        }
        temp.spam[userId][chatId].prev = prevMessage;
    }
    const timeDiff = now - temp.spam[userId][chatId].cool;
    temp.spam[userId][chatId].cool = now;
    temp.spam[userId][chatId].keys.push(key);
    temp.spam[userId][chatId].score += score;
    temp.spam[userId][chatId].index++;
    if (timeDiff != now && timeDiff > 30) {
        delete temp.spam[userId][chatId];
    }
    return timeDiff < temp.spam.cool && (temp.spam[userId][chatId].score > 10 || (temp.spam[userId][chatId].score > 2 && temp.spam[userId][chatId].index > 6));
};

const wordPatterns = ANTIWORDS.split(',').map(pattern => new RegExp(pattern.trim(), 'iu'));

exports.isWords = async (message, chatId) => {
    if (wordPatterns.length === 0) {
        return false;
    }
    const wordConfig = await getWord(chatId);
    if (!wordConfig.enabled) {
        return false;
    }
    for (const pattern of wordPatterns) {
        if (pattern.test(message)) {
            return wordConfig.action;
        }
    }
    return false;
};
