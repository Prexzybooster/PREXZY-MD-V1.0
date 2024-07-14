const {
    readFileSync,
    existsSync
} = require('fs');
const path = require('path');
const {
    setAlive,
    getAlive
} = require('./db/alive');
const {
    secondsToHms,
    download,
    getQuote,
    isUrl
} = require('./index');
const { prepareWAMessageMedia } = require('baileys');
const {
    getButtons,
    getHeader,
    getBunNums,
    getBunUrls,
    getUrlButtons,
    getCallButtons
} = require('./greetings');
const { genHydratedButtons } = require('./utils');

const getUptime = (isDetailed) => {
    if (isDetailed) {
        const totalSeconds = Number(process.uptime());
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor(totalSeconds % 3600 / 60);
        const seconds = Math.floor(totalSeconds % 3600 % 60);
        return `${hours > 0 ? hours + 'h ' : ''}${minutes > 0 ? minutes + 'm ' : ''}${seconds > 0 ? seconds + 's' : ''}`;
    }
    return secondsToHms(process.uptime());
};

exports.getUptime = getUptime;

const uptimeQuoteReplace = async (message, url) => {
    if (url) {
        message = message.replace(url, '');
    }
    message = message.replace('#uptime', getUptime()).trim();
    if (/#quote/.test(message)) {
        const quote = await getQuote();
        message = message.replace('#quote', quote || '');
    }
    return message;
};

exports.uptimeQuoteReplace = uptimeQuoteReplace;

exports.aliveMessage = async (action, context) => {
    if (action === 'get') {
        const aliveData = await getAlive();
        return {
            msg: aliveData?.message,
            options: {},
            type: 'text'
        };
    }

    let mediaUrl = 'null';
    let mediaType = 'text';
    if (isUrl(action)) {
        const downloadResult = await download(action, path.join(__dirname, '../media/alive'));
        if (downloadResult?.path) {
            mediaUrl = downloadResult.path;
            mediaType = downloadResult.type;
        }
    }

    await setAlive(mediaUrl, action, mediaType, downloadResult.ext || 'null');

    const aliveData = await getAlive();
    const message = aliveData ? await uptimeQuoteReplace(aliveData.message, aliveData.url) : '';
    let response = message || `I'm alive\nsend a message to update me.\ntype alive to see again.`;

    const buttons = getButtons(response);
    const header = getHeader(response);
    const urlButtons = getUrlButtons(response);
    const callButtons = getCallButtons(response);
    const bunNums = getBunNums(response);
    const bunUrls = getBunUrls(response);

    if (urlButtons.length > 0 && bunUrls.length > 0 || callButtons.length > 0 && bunNums.length > 0) {
        const buttonObjects = [];
        for (let i = 0; i < urlButtons.length; i++) {
            response = response.replace(`#ubutton\\${urlButtons[i]}#`, '').replace(`#url\\${bunUrls[i]}#`, '');
            buttonObjects.push({ urlButton: { url: bunUrls[i], text: urlButtons[i] } });
        }
        for (let i = 0; i < callButtons.length; i++) {
            response = response.replace(`#cbutton\\${callButtons[i]}#`, '').replace(`#num\\${bunNums[i]}#`, '');
            buttonObjects.push({ callButton: { number: bunNums[i], text: callButtons[i] } });
        }
        for (let i = 0; i < buttons.length; i++) {
            response = response.replace(`#button\\${buttons[i]}#`, '');
            buttonObjects.push({ button: { text: buttons[i], id: buttons[i] } });
        }
        if (header.length > 0) {
            response = response.replace(`#header\\${header[0]}#`, '');
        }
        response = await genHydratedButtons(buttonObjects, response.trim(), header);
        mediaType = 'template';
        if (/image|video/.test(aliveData.type)) {
            if (!existsSync(path.join(__dirname, `../media/alive.${aliveData.ext}`))) {
                await download(aliveData.url, path.join(__dirname, '../media/alive'));
            }
            const mediaContent = readFileSync(path.join(__dirname, `../media/alive.${aliveData.ext}`));
            const mediaOptions = { [aliveData.type]: mediaContent, gifPlayback: aliveData.type === 'video' };
            const mediaMessage = await prepareWAMessageMedia(mediaOptions, { upload: context.client.waUploadToServer });
            response[`${aliveData.type}Message`] = mediaMessage;
        }
    } else if (buttons.length > 0 && header.length > 0) {
        const buttonObjects = buttons.map(button => ({
            buttonId: button,
            buttonText: { displayText: button },
            type: 1
        }));
        response = buttons.reduce((msg, button) => msg.replace(`#button\\${button}#`, '').trim(), response);
        response = response.replace(`#header\\${header[0]}#`, '').trim();
        response = {
            contentText: response.trim(),
            footerText: header[0],
            buttons: buttonObjects,
            headerType: mediaType === 'image' ? 4 : mediaType === 'video' ? 5 : 1
        };
        if (/image|video/.test(aliveData.type)) {
            if (!existsSync(path.join(__dirname, `../media/alive.${aliveData.ext}`))) {
                await download(aliveData.url, path.join(__dirname, '../media/alive'));
            }
            const mediaContent = readFileSync(path.join(__dirname, `../media/alive.${aliveData.ext}`));
            const mediaOptions = { [aliveData.type]: mediaContent, gifPlayback: aliveData.type === 'video' };
            const mediaMessage = await prepareWAMessageMedia(mediaOptions, { upload: context.client.waUploadToServer });
            response[`${aliveData.type}Message`] = mediaMessage;
        }
        mediaType = 'button';
    }

    return {
        msg: response,
        options: { caption: message, gifPlayback: mediaType === 'video' },
        type: mediaType
    };
};