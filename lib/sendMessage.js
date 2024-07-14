const {
    WAProto,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    extractUrlFromText,
    isJidGroup
} = require('baileys');
const NodeCache = require('node-cache');
const { getUrlInfo } = require('baileys/lib/Utils/link-preview');
const { genThumbnail, extractVideoThumb, chats } = require('./constant');
const cache = new NodeCache({ stdTTL: 3600, useClones: false });
const utils = require('./utils');

async function getGroupEphemeralDuration(groupId) {
    if (!isJidGroup(groupId)) {
        return '0';
    }
    const groupData = await utils.store.fetchGroupMetadata(groupId);
    return groupData?.ephemeralDuration;
}

const prepareMessage = async (message, options) => {
    if (options.linkPreview) {
        if (!options.contextInfo) {
            options.contextInfo = {};
        }
        options.contextInfo.externalAdReply = {
            ...options.linkPreview,
            title: options.linkPreview.head
        };
        delete options.linkPreview;
    }

    let preparedMessage = {
        contactMessage: WAProto.Message.ContactMessage.fromObject(message.contacts.contacts[0]),
        contactsArrayMessage: WAProto.Message.ContactsArrayMessage.fromObject(message.contacts),
        reactionMessage: WAProto.Message.ReactionMessage.fromObject(message.react),
        protocolMessage: options.protocolMessage
    };

    if ('text' in message) {
        const url = extractUrlFromText(message.text);
        const processedMessage = { ...message };
        let linkPreview = options.LinkPreview || cache.get(url);
        if (!linkPreview && url && !cache.has(url)) {
            try {
                linkPreview = await getUrlInfo(url, { uploadImage: options.upload });
                cache.set(url, linkPreview);
            } catch {
                cache.set(url, null);
            }
        }
        if (linkPreview) {
            processedMessage.canonicalUrl = linkPreview['canonical-url'];
            processedMessage.matchedText = linkPreview['matched-text'];
            processedMessage.jpegThumbnail = linkPreview.jpegThumbnail;
            processedMessage.description = linkPreview.description;
            processedMessage.title = linkPreview.title;
            processedMessage.previewType = 0;
            if (linkPreview.highQualityThumbnail) {
                Object.assign(processedMessage, {
                    thumbnailDirectPath: linkPreview.highQualityThumbnail.directPath,
                    mediaKey: linkPreview.highQualityThumbnail.mediaKey,
                    mediaKeyTimestamp: linkPreview.highQualityThumbnail.mediaKeyTimestamp,
                    thumbnailWidth: linkPreview.highQualityThumbnail.width,
                    thumbnailHeight: linkPreview.highQualityThumbnail.height,
                    thumbnailSha256: linkPreview.highQualityThumbnail.fileSha256,
                    thumbnailEncSha256: linkPreview.highQualityThumbnail.fileEncSha256
                });
            }
        }
        preparedMessage.extendedTextMessage = processedMessage;
    } else if ('contacts' in message) {
        const contactCount = message.contacts.contacts.length;
        if (!contactCount) {
            throw new Error('require at least 1 contact');
        }
        if (contactCount === 1) {
            // Single contact
        } else {
            // Multiple contacts
        }
    } else if ('location' in message) {
        preparedMessage.locationMessage = WAProto.Message.LocationMessage.fromObject(message.location);
    } else if ('button' in message) {
        const buttonMessage = message.button;
        Object.assign(buttonMessage, preparedMessage);
        preparedMessage = { buttonsMessage: buttonMessage };
    } else if ('react' in message) {
        message.react.senderTimestampMs = Date.now();
    } else if ('list' in message) {
        preparedMessage = { listMessage: message.list };
    } else if ('template' in message) {
        preparedMessage = { templateMessage: { hydratedTemplate: message.template } };
    } else if ('invite' in message) {
        preparedMessage = { groupInviteMessage: WAProto.Message.GroupInviteMessage.fromObject(message.invite) };
    } else if ('delete' in message) {
        preparedMessage = {
            protocolMessage: {
                key: message.delete,
                type: 0
            }
        };
    } else if ('poll' in message) {
        const pollMessage = WAProto.Message.PollCreationMessage.fromObject(message.poll);
        preparedMessage = {
            pollCreationMessage: pollMessage,
            messageContextInfo: {
                messageSecret: require('crypto').randomBytes(32).toString('base64')
            }
        };
    } else if ('edit' in message) {
        const editMessage = {
            key: message.edit.key,
            type: 14,
            editedMessage: message.edit.message || { conversation: message.edit.text }
        };
        preparedMessage = { protocolMessage: editMessage };
    } else if ('image' in message) {
        message.jpegThumbnail = await genThumbnail(message.image);
    } else if ('video' in message) {
        const { thumbnail, duration } = await extractVideoThumb(message.video);
        message.jpegThumbnail = thumbnail;
        message.seconds = duration;
    }

    if ('viewOnce' in options) {
        preparedMessage = { viewOnceMessage: { message: preparedMessage } };
    }
    if ('contextInfo' in options) {
        const [messageType] = Object.keys(preparedMessage);
        preparedMessage[messageType].contextInfo = {
            ...preparedMessage[messageType]?.contextInfo,
            ...options.contextInfo
        } || {};
    }
    return preparedMessage;
};

exports.prepareMessage = async (jid, message, options, media) => {
    if (options.linkPreview) {
        if (!options.contextInfo) {
            options.contextInfo = {};
        }
        options.contextInfo.externalAdReply = {
            ...options.linkPreview,
            title: options.linkPreview.head
        };
        delete options.linkPreview;
    }
    if (!message.contacts && !message.react && !message.invite && !message.delete && !message.poll && !message.template) {
        if ('text' in message && !options.linkPreview) {
            const url = extractUrlFromText(message.text);
            if (url) {
                let linkPreview = cache.get(url);
                if (!linkPreview && !cache.has(url)) {
                    try {
                        linkPreview = await getUrlInfo(url, { uploadImage: media.waUploadToServer });
                        if (linkPreview) {
                            cache.set(url, linkPreview);
                        }
                    } catch {
                        cache.set(url, null);
                    }
                }
                message.linkPreview = linkPreview;
            }
        }
        message.mentions = options.contextInfo?.mentionedJid || [];
        message.caption = options.caption || undefined;
        message.gifPlayback = options.gifPlayback || undefined;
        options.cachedGroupMetadata = utils.store.fetchGroupMetadata;
        if (!options.ephemeralExpiration) {
            options.ephemeralExpiration = utils.expiration[jid] || await getGroupEphemeralDuration(jid);
        }
        if ('image' in message) {
            message.jpegThumbnail = await genThumbnail(message.image);
        } else if ('video' in message) {
            const { thumbnail, duration } = await extractVideoThumb(message.video);
            message.jpegThumbnail = thumbnail;
            message.seconds = duration;
        }
        options.urlInfo = null;
        const sentMessage = await media.sendMessage(jid, message, options).catch(console.log);
        chats.set(`${sentMessage.key.remoteJid}${sentMessage.key.id}`, sentMessage);
        if (process.env.EMIT_SOWN_EVENT) {
            process.nextTick(() => {
                // Emit event
            });
        }
    }
};