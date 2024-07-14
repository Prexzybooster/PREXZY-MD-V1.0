const config = require('../config');
const { getLydia } = require('./db/lydia');
const { getJson } = require('./fetch');

exports.lydia = async (message) => {
    const isReplyToBot = message.reply_message?.jid && message.reply_message.jid === message.client.user.jid;

    if (!isReplyToBot) {
        return false;
    }

    let lydiaResponse = await getLydia(message.jid);

    if (!lydiaResponse) {
        lydiaResponse = await getLydia(message.jid, message.participant);
    }

    if (!lydiaResponse) {
        return false;
    }

    if (/<% RGI_Emoji %>|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/gu.test(message.text)) {
        message.text = message.text.replace(/<% RGI_Emoji %>|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/gu, '');
    }

    const brainshopResponse = await getJson(`http://api.brainshop.ai/get?bid=${config.BRAINSHOP.split(',')[0]}&key=${config.BRAINSHOP.split(',')[1]}&uid=[${message.participant}]&msg=[${message.text}]`);

    if (!brainshopResponse) {
        return false;
    }

    return brainshopResponse.cnt;
};