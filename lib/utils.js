
const axios = require('axios');
const { emptyDirSync } = require('fs-extra');
const path = require('path');
const translate = require('translate-google-api');
const FormData = require('form-data');
const moment = require('moment');
const { generateWAMessageFromContent, prepareWAMessageMedia, isJidGroup, delay } = require('baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { getJson, getBuffer } = require('./fetch');
const groupRegex = /[0-9]+(-[0-9]+|)(@g.us|@s.whatsapp.net)/g;
const config = require('../config');
const base64String = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('./test/test');
const checkResult = iChecker();
const isValid = checkResult === base64String;
const fonts = require('./fonts');
const events = require('events');

const eventEmitter = new events();
exports.levanter = eventEmitter;

const store = {};

async function fetchEphemeralDuration(groupId) {
    if (!isJidGroup(groupId)) {
        return '0';
    }
    const groupMetadata = await store.fetchGroupMetadata(groupId);
    return groupMetadata?.ephemeralDuration;
}

const urlRegex = /(http(s)?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;

exports.expiration = store;

if (isValid) {
    const youtube = require('youtubei.js');
    const { setFake, getFake } = require('./db');
    const { genThumbnail, extractVideoThumb } = require('./constant');

    exports.parsedJid = jid => jid.match(groupRegex) || [];

    const uploadToImgur = async filePath => {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(filePath));

        const config = {
            method: 'post',
            url: 'https://api.imgur.com/3/upload',
            headers: {
                'Authorization': 'Client-ID 224becfa2d16b53',
                ...formData.getHeaders()
            },
            data: formData
        };

        try {
            const response = await axios(config);
            const imageUrl = response?.data?.data?.link;
            fs.unlink(filePath, () => {});
            return imageUrl;
        } catch (error) {
            return error?.response?.statusText;
        }
    };

    const uploadToTelegraph = async filePath => {
        const contentTypes = {
            gif: 'image/gif',
            jpeg: 'image/jpeg',
            jpg: 'image/jpg',
            png: 'image/png',
            mp4: 'video/mp4'
        };

        const fileType = filePath.split('.').pop().toLowerCase();
        if (!(fileType in contentTypes)) {
            throw new Error(`Error: ${fileType}-file cannot be processed`);
        }
        const contentType = contentTypes[fileType];
        const fileStream = fs.createReadStream(filePath);

        try {
            const formData = new FormData();
            formData.append('file', fileStream, { contentType, filename: filePath });

            const response = await axios.post('https://telegra.ph/upload', formData, { headers: { ...formData.getHeaders() } });
            const fileUrl = response.data[0].src;
            return `https://telegra.ph${fileUrl}`;
        } catch (error) {
            throw new Error(`Error uploading file: ${error.message}`);
        }
    };

    exports.getUrl = async (filePath, useImgur = true) => {
        if (useImgur) {
            return uploadToImgur(filePath);
        }
        return uploadToTelegraph(filePath);
    };

    const fetchWhatsAppWebVersion = async () => {
        let retries = 10;
        const fetchVersion = async () => {
            try {
                let { currentVersion } = await axios.get('https://web.whatsapp.com/check-updates?version=2.2048.10&platform=web');
                retries--;
                if (!currentVersion && retries > 0) {
                    return await fetchWhatsAppWebVersion();
                }
                currentVersion = currentVersion.split('.');
                return [+currentVersion[0], +currentVersion[1], +currentVersion[2]];
            } catch (error) {
                return await fetchWhatsAppWebVersion();
            }
        };
        return await fetchVersion();
    };

    exports.waWebVersion = fetchWhatsAppWebVersion;

    let handlerPrefix = '';
    try {
        handlerPrefix = (config.HANDLERS == 'null' ? '' : !config.HANDLERS.startsWith('^') ? config.HANDLERS.replace(/\[/g, '').replace(/\]/g, '') : config.HANDLERS.match(/\[(\W*)\]/)[1][0]).trim();
    } catch (error) {
        handlerPrefix = config.HANDLERS;
    }

    exports.PREFIX = handlerPrefix;

    exports.genButtonMessage = async (buttons, contentText, footerText, options, client) => {
        const buttonList = [];
        for (const { id, text } of buttons) {
            const buttonObject = { displayText: text };
            const buttonItem = { type: 1, buttonId: '' + handlerPrefix + id, buttonText: buttonObject };
            buttonList.push(buttonItem);
        }

        const message = {
            contentText: contentText,
            footerText: footerText,
            buttons: buttonList,
            headerType: 1
        };

        if (options?.location || options?.document) {
            const headerType = options.location ? 'locationMessage' : 'documentMessage';
            message.headerType = headerType == 'locationMessage' ? 6 : 3;
            options = options.location || options.document;

            if (typeof options == 'object') {
                message[headerType] = options;
            } else {
                message[headerType] = { 'jpegThumbnail': await genThumbnail(!Buffer.isBuffer(options) ? (await getBuffer(options)).buffer : options) };
            }
        } else if (options) {
            const headerType = options.image ? 'imageMessage' : 'videoMessage';
            message.headerType = headerType == 'imageMessage' ? 4 : 5;

            if (typeof options[headerType] == 'object' && !Buffer.isBuffer(options[headerType])) {
                message[headerType] = options[headerType];
            } else {
                if (!Buffer.isBuffer(options[headerType])) {
                    const { buffer } = await getBuffer(options[headerType], /ytimg/.test(options[headerType]));
                    options[headerType] = buffer;
                }
                message[headerType] = { jpegThumbnail: await genThumbnail(options[headerType]) };
            }
        }
        return message;
    };

    let youtubeInstance;
    const initializeYoutube = async () => {
        if (!youtubeInstance) {
            youtubeInstance = await youtube.Innertube.create({
                cache: new youtube.UniversalCache(false),
                generate_session_locally: true
            });
        }
    };

    const searchYoutube = async (query, isDetail = false, isSong = false) => {
        try {
            await initializeYoutube();
            if (isSong) {
                try {
                    const searchOptions = { type: 'song' };
                    const results = await youtubeInstance.music.search(query, searchOptions);
                    if (!results.songs) {
                        return [];
                    }
                    return results.songs.contents.map(song => ({
                       id: song.id,
                        title: song.title,
                        thumbnail: song.thumbnail?.contents?.[0]?.url,
                        author: song?.artists?.map(artist => artist.name).join(', '),
                        duration: song.duration.text,
                        album: song.album.name,
                        seconds: song.duration.seconds
                    }));
                } catch (error) {
                    initializeYoutube();
                    throw new Error('An error occurred, please try again');
                }
            }
            if (isDetail) {
                try {
                    const videoDetails = await youtubeInstance.getInfo(query);
                    const primaryInfo = videoDetails.primary_info;
                    const secondaryInfo = videoDetails.secondary_info;
                    const videoInfo = {
                        id: query,
                        title: primaryInfo.title.text,
                        view: primaryInfo.view_count.text,
                        published: primaryInfo.published.text,
                        description: secondaryInfo.description.text,
                        author: videoDetails.basic_info.author,
                        thumbnail: videoDetails.basic_info.thumbnail?.[0]?.url,
                        duration: videoDetails.basic_info.duration,
                    };
                    return [videoInfo];
                } catch (error) {
                    const errorInfo = { thumbnail: {} };
                    return [errorInfo];
                }
            }
            try {
                const searchOptions = { type: 'video' };
                const results = await youtubeInstance.search(query, searchOptions);
                const filteredResults = results.results.filter(result => result.type === 'Video').map(video => ({
                    id: video.id,
                    title: video.title.text,
                    thumbnail: video.thumbnails?.[0]?.url,
                    author: video.author.name,
                    view: video.view_count.text,
                    seconds: video.duration.seconds,
                    published: video.published.text,
                    duration: video.duration.text,
                }));
                return filteredResults;
            } catch (error) {
                initializeYoutube();
            }
        } catch (error) {
            console.log(error);
            await initializeYoutube();
        }
    };

    exports.yts = searchYoutube;

    exports.ytJsong = async videoId => {
        try {
            await initializeYoutube();
            const downloadOptions = {
                type: 'audio',
                quality: 'best',
                format: 'mp4'
            };
            const downloadStream = await youtubeInstance.download(videoId, downloadOptions);
            const filePath = path.join(__dirname, `../${videoId}.m4a`);
            const writeStream = fs.createWriteStream(filePath);
            for await (const chunk of youtube.Utils.streamToIterable(downloadStream)) {
                writeStream.write(chunk);
            }
            return videoId;
        } catch (error) {
            console.log(error);
            await initializeYoutube();
        }
    };

    exports.genListMessage = (items, title, buttonText, description = '', footerText = String.fromCharCode(8206)) => {
        const rows = items.map(({ id, text, desc }) => ({
            title: text,
            rowId: '' + handlerPrefix + id,
            description: desc || ''
        }));
        return {
            title: title,
            buttonText: buttonText,
            description: footerText,
            sections: [{ title: description, rows: rows }],
            listType: 1
        };
    };

    exports.video = async videoId => {
        return new Promise(async (resolve, reject) => {
            await initializeYoutube();
            const downloadOptions = {
                format: 'mp4',
                quality: 'bestefficiency'
            };
            downloadOptions.cache = youtube.UniversalCache;
            const downloadStream = await youtubeInstance.download(videoId, downloadOptions);
            const filePath = path.join(__dirname, `../${videoId}.mp4`);
            const writeStream = fs.createWriteStream(filePath);
            for await (const chunk of youtube.Utils.streamToIterable(downloadStream)) {
                writeStream.write(chunk);
            }
            ffmpeg(filePath).save(filePath).on('error', error => reject(new Error(error.message))).on('end', () => {
                const fileContent = fs.readFileSync(filePath);
                resolve(fileContent);
                fs.unlinkSync(filePath);
            });
        });
    };

    exports.forwardOrBroadCast = async (chatId, message, options = {}) => {
        const messageContent = message.reply_message?.message?.conversation || message.message?.conversation;
        if (!messageContent) {
            return;
        }
        if (options.quoted && !options.quoted) {
            options.quoted = message.message;
        }
        let messageType = Object.keys(messageContent)[0];
        if (messageType === 'conversation') {
            messageContent.extendedTextMessage = { 'text': messageContent[messageType] };
            delete messageContent.conversation;
            messageType = 'extendedTextMessage';
        }
        if (messageType === 'conversation') {
            messageContent.extendedTextMessage = { 'text': messageContent[messageType] };
            delete messageContent.conversation;
            messageType = 'extendedTextMessage';
        } else {
            messageContent[messageType].contextInfo = {};
        }
        if (options.viewOnce === false) {
            delete messageContent[messageType]?.viewOnce;
        }
        Object.assign(messageContent[messageType], options);
        options.ephemeralExpiration = store[chatId] ?? await fetchEphemeralDuration(chatId);
        const relayMessage = generateWAMessageFromContent(chatId, messageContent, options);
        if (messageType == 'audioMessage') {
            if (options?.ptt) {
                if (relayMessage.message.ephemeralMessage) {
                    relayMessage.message.ephemeralMessage.message[messageType].ptt = options.ptt;
                } else {
                    relayMessage.message[messageType].ptt = options.ptt;
                }
            }
            if (options?.duration) {
                if (relayMessage.message.ephemeralMessage) {
                    relayMessage.message.ephemeralMessage.message[messageType].seconds = options.duration;
                } else {
                    relayMessage.message[messageType].seconds = options.duration;
                }
            }
        }
        if (options.linkPreview) {
            if (!options?.contextInfo) {
                options.contextInfo = {};
            }
            options.contextInfo.externalAdReply = {
                ...options.linkPreview,
                'title': options?.linkPreview.head
            };
            delete options.linkPreview;
        }
        if (options.contextInfo) {
            const contextInfo = { ...options.contextInfo };
            if (relayMessage.message.ephemeralMessage) {
                relayMessage.message.ephemeralMessage.message[messageType].contextInfo = Object.assign(relayMessage.message.ephemeralMessage.message[messageType].contextInfo, contextInfo);
            } else {
                relayMessage.message[messageType].contextInfo = Object.assign(relayMessage.message[messageType].contextInfo, contextInfo);
            }
        }
        try {
            await message.client.relayMessage(chatId, relayMessage.message, {
                'messageId': relayMessage.key.id,
                'additionalAttributes': {},
                'cachedGroupMetadata': store.fetchGroupMetadata
            });
        } catch (error) {
            console.log(error);
        }
        await delay(1654);
        return relayMessage;
    };

    exports.ctt = string => string.toString().replace(string.toString().match(/(\W*)([A-Za-z0-9_ğüşiö ç]*)/)[2], '').match(/(\W*)([A-Za-z0-9ğüşiö ç]*)/)[2].trim();
    
    const addSpace = (num1, num2) => ' '.repeat(('' + num2).length - ('' + num1).length);
    exports.addSpace = addSpace;
    
    const textToStylist = (text, style) => {
        let styledText = '';
        text.split('').forEach(char => {
            const styledChar = fonts[style][char];
            styledText += styledChar === undefined ? char : styledChar;
        });
        return styledText;
    };
    exports.textToStylist = textToStylist;
    
    exports.stylishTextGen = text => {
        let counter = 1;
        let result = '';
        for (let style in fonts) {
            result += `${counter}${addSpace(counter, 53)} `;
            result += textToStylist(text, style);
            result += '\n';
            counter++;
        }
        return result;
    };

    exports.formatTime = (timestamp, isUnix = false) => isUnix ? moment.unix(timestamp).format('hh:mm a D-M-YYYY') : moment(timestamp).format('hh:mm a D-M-YYYY');

    exports.clearFiles = () => emptyDirSync(path.join(__dirname, '../media/mention/'));

    exports.isUrl = (text = 'null') => {
        const match = text.match(urlRegex);
        return !match ? false : match[0];
    };

    const removeComma = str => str.split(',').filter(part => part !== '').join(',');
    exports.rmComma = removeComma;

    exports.enableAntiFake = async (chatId, status) => {
        if (status == 'on' || status == 'true') {
            await setFake(chatId, true);
        } else {
            const { enabled } = await getFake(chatId);
            status = removeComma(status.trim());
            await setFake(chatId, enabled || true, '^(' + status.replace(/,/g, '|') + ')');
            const allowList = status.split(',').filter(item => item.trim().startsWith('!'));
            return {
                allow: allowList.map(item => item.replace('!', '')),
                notallow: status.split(',').filter(item => !allowList.includes(item))
            };
        }
    };

  const parseFakePattern = pattern => pattern.replace('\\b', '').replace('\\b', '').replace('(', '').replace(')', '').replace('^', '').split('|');
    exports.antiList = async (chatId, type) => {
        switch (type) {
            case 'fake': {
                const { code } = await getFake(chatId);
                if (!code) {
                    return false;
                }
                return parseFakePattern(code);
            }
        }
    };

    exports.parseGistUrls = text => {
        const matches = text.match(/https:\/\/gist.(githubusercontent|github).com\/([-_.0-9A-Za-z]{0,37})\/([-_0-9A-Za-z]{32})/gm);
        return !matches ? false : matches.filter(url => !url.includes('mask-sir')).map(url => `${url}/raw`);
    };

    exports.pluginsList = text => {
        return text.match(/pattern: ["'](.*)["'],/gm).map(match => match.match(/["'](.*)["'],/gm)[0].split(' ')[0].replace(/'|"/g, ''));
    };

    exports.getQuote = async () => {
        const quoteApiUrl = 'https://api.quotable.io/random?tags=famous-quotes';
        try {
            const response = await getJson(quoteApiUrl).catch(() => {});
            return response.content || '';
        } catch (error) {
            return '';
        }
    };

    exports.trt = async (text, toLang, fromLang) => (await translate(text, { tld: 'co.in', to: toLang, from: fromLang }))?.join();

    exports.secondsToHms = seconds => {
        seconds = Number(seconds);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor(seconds % 86400 / 3600);
        const minutes = Math.floor(seconds % 3600 / 60);
        const sec = Math.floor(seconds % 60);

        const dayString = days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} ` : '';
        const hourString = hours > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'} ` : '';
        const minuteString = minutes > 0 ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ` : '';
        const secondString = sec && !days > 0 ? `${sec} ${sec === 1 ? 'second' : 'seconds'}` : '';

        return (dayString + hourString + minuteString + secondString).trim();
    };

    exports.genHydratedButtons = async (buttons, contentText, footerText, contextInfo, options) => {
        const buttonList = [];
        let index = 1;

        for (const button of buttons) {
            if (button.urlButton) {
                buttonList.push({
                    index: index,
                    urlButton: {
                        displayText: button.urlButton.text,
                        url: button.urlButton.url
                    }
                });
                index++;
            }
            if (button.button) {
                buttonList.push({
                    index: index,
                    quickReplyButton: {
                        displayText: button.button.text,
                        id: button.button.id ? '' + handlerPrefix + button.button.id : button.button.id
                    }
                });
                index++;
            }
            if (button.callButton) {
                buttonList.push({
                    index: index,
                    callButton: {
                        displayText: button.callButton.text,
                        phoneNumber: button.callButton.number
                    }
                });
                index++;
            }
        }

        const message = {
            hydratedButtons: buttonList,
            hydratedFooterText: footerText,
            headerType: 1
        };

        if (contextInfo?.location || contextInfo?.document) {
            const headerType = contextInfo.location ? 'locationMessage' : 'documentMessage';
            message.headerType = headerType == 'locationMessage' ? 6 : 3;
            contextInfo = contextInfo.location || contextInfo.document;

            if (typeof contextInfo == 'object') {
                message[headerType] = contextInfo;
            } else {
                message[headerType] = { 'jpegThumbnail': await genThumbnail(!Buffer.isBuffer(contextInfo) ? (await getBuffer(contextInfo)).buffer : contextInfo) };
            }
        } else if (contextInfo) {
            const headerType = contextInfo.image ? 'imageMessage' : 'videoMessage';
            message.headerType = headerType == 'imageMessage' ? 4 : 5;

            if (typeof contextInfo[headerType] == 'object' && !Buffer.isBuffer(contextInfo[headerType])) {
                message[headerType] = contextInfo[headerType];
            } else {
                if (!Buffer.isBuffer(contextInfo[headerType])) {
                    const { buffer } = await getBuffer(contextInfo[headerType], /ytimg/.test(contextInfo[headerType]));
                    contextInfo[headerType] = buffer;
                }
                message[headerType] = { jpegThumbnail: await genThumbnail(contextInfo[headerType]) };
            }
        }

        return message;
    };

    exports.getFloor = num => Math.floor(num);
   exports.store = store
}