const {
    isAdmin,
    jidToNum
} = require('.');
const {
    getMessage,
    getFake,
    getPdm
} = require('./db');
const { resetMsgs } = require('./db/store');
const {
    download,
    getBuffer
} = require('./fetch');
const { genGreetings } = require('./greetings');
const { prepareMessage } = require('./sendMessage');
const {
    isUrl,
    store
} = require('./utils');
const path = require('path');
const fs = require('fs');

const removePlusSigns = str => str.replace(/\+/g, '');
const cache = {};

exports.participantUpdate = async (event, context) => {
    const actions = {
        invite: 'invite',
        add: 'add',
        remove: 'remove',
        promote: 'promote',
        demote: 'demote',
    };

    if (!event.participants.length) return;

    try {
        switch (event.action) {
            case actions.invite:
            case actions.add:
                await handleAdd(event, context);
                break;
            case actions.remove:
                await handleRemove(event, context);
                break;
            case actions.promote:
            case actions.demote:
                await handlePromoteDemote(event, context);
                break;
        }
    } catch (error) {
        console.error(error);
    }
};

async function handleAdd(event, context) {
    const settings = await getMessage(event.id, 'welcome');
    if (!settings || !settings.enabled) return;

    let groupMetadata = await store.fetchGroupMetadata(event.id);
    if (!groupMetadata) return console.log('error:', event.id);

    const { participants, desc, subject } = groupMetadata;
    const newParticipant = event.participants[0];
    const fakeData = await getFake(event.id);

    if (event.action !== 'add' && settings.enabled) {
        // Additional logic to handle the participant
    }

    let welcomeMessage = settings.message
        .replace('&desc', desc?.toString() || '')
        .replace('&name', subject)
        .replace('&size', participants.length);

    const mediaPath = path.join(__dirname, '../media/welcomeFolder/', welcomeMessage.chat);
    const media = await download(isUrl(welcomeMessage.message), mediaPath);
    if (!media.error) {
        welcomeMessage.message = welcomeMessage.message.replace(isUrl(welcomeMessage.message), '');
        cache.welcomeFiles.push(welcomeMessage.chat + '.' + media.ext);
        const messageType = media.type;
        const buffer = fs.readFileSync(path.join(__dirname, '../media/welcomeFolder/', welcomeMessage.chat + '.' + media.ext));
        const message = await genGreetings(buffer, welcomeMessage.message, newParticipant, messageType, context);

        if (shift) {
            await prepareMessage(event.id, message, message.options, context);
        }
    }
}

async function handleRemove(event, context) {
    const leavingParticipant = event.participants[0];
    resetMsgs(event.id, leavingParticipant == context.user.jid ? undefined : leavingParticipant);
    const goodbyeMessage = await getMessage(event.id, 'goodbye');
    if (!goodbyeMessage || !goodbyeMessage.enabled) return;

    let goodbyeFile = cache.goodFiles.find(file => file.startsWith(event.id));
    let messageType = 'text';
    const mediaUrl = isUrl(goodbyeMessage.message);

    if (/&desc|&name|&size/.test(goodbyeMessage.message)) {
        const { participants, subject, desc } = await store.fetchGroupMetadata(event.id);
        goodbyeMessage.message = goodbyeMessage.message
            .replace('&desc', desc?.toString() || '')
            .replace('&name', subject)
            .replace('&size', participants.length);
    }

    if (!goodbyeFile && mediaUrl && !cache[event.id]) {
        const mediaPath = path.join(__dirname, '../media/goodFolder/', goodbyeMessage.chat);
        const media = await download(mediaUrl, mediaPath);
        if (!media.error) {
            goodbyeMessage.message = goodbyeMessage.message.replace(mediaUrl, '');
            cache.goodFiles.push(goodbyeMessage.chat + '.' + media.ext);
            goodbyeFile = goodbyeMessage.chat + '.' + media.ext;
            messageType = media.type;
        }
    }

    if (!goodbyeFile && /&pp/.test(goodbyeMessage.message)) {
        goodbyeMessage.message = goodbyeMessage.message.replace('&pp', '');
        try {
            const profilePictureUrl = await context.getProfilePicture(event.participants[0], 'image');
            const { buffer } = await getBuffer(profilePictureUrl);
            const message = await genGreetings(buffer, goodbyeMessage.message, event.participants[0], 'image', context);
            await prepareMessage(event.id, { [message.type || 'text']: message.msg, ...message.options }, message.options, context);
        } catch (error) {
            console.error(error);
        }
    } else if (goodbyeFile) {
        const buffer = fs.readFileSync(path.join(__dirname, '../media/goodFolder/', goodbyeFile));
        messageType = goodbyeFile.endsWith('.mp4') ? 'video' : 'image';
        const message = await genGreetings(buffer, goodbyeMessage.message, event.participants[0], messageType, context);
        await prepareMessage(event.id, { [message.type || 'text']: message.msg, ...message.options }, message.options, context);
    }
}

async function handlePromoteDemote(event, context) {
    const groupMetadata = await store.fetchGroupMetadata(event.id);
    if (!groupMetadata) return;

    const { announce, participants } = groupMetadata;
    const participant = participants.find(p => p.id === context.user.jid);
    if (announce && !participant.admin) return;

    try {
        await prepareMessage(event.id, {
            'text': `_@${jidToNum(event.from)} ${event.action === 'demote' ? 'demoted' : 'promoted'} @${jidToNum(event.participants[0])}_`,
            'contextInfo': { 'mentionedJid': [event.from, event.participants[0]] }
        }, {}, context);
    } catch (error) {
        console.error(error);
    }
}