const { setVotes, getVotes } = require('./db/vote');
const userRegex = /[0-9]+(-[0-9]+|)(@g\.us|@s\.whatsapp\.net)/g;

const convertToHex = (str) => [...str].map(char => char.codePointAt(0).toString(16)).join('-');

const parseOptions = (text) => {
    const options = [];
    const lines = text.toLowerCase().split('\n');
    lines.forEach(line => {
        if (line.startsWith('o')) {
            const [, emoji, option] = line.split('|');
            if (emoji && option) {
                options.push({ emoji: emoji.trim(), option: option.trim() });
            }
        }
    });
    return options;
};

const createVoteOptions = (options) => {
    const voteOptions = {};
    options.forEach(({ emoji, option }) => {
        voteOptions[convertToHex(emoji)] = { v: [], e: emoji, o: option };
    });
    return voteOptions;
};

const createVote = (question, options, msg, force) => ({
    question,
    options,
    voted: createVoteOptions(options),
    msg,
    force,
    total: []
});

const parseQuestion = (text) => {
    const questionLine = text.toLowerCase().split('\n').find(line => line.startsWith('q|'));
    if (!questionLine) {
        throw new Error('No question found');
    }
    const [, question] = questionLine.split('|');
    return question.trim();
};

const generateResults = (voteData) => {
    const totalVotes = voteData.total.length;
    let resultText = `${voteData.question}\n`;
    for (const key in voteData.voted) {
        const { e, v, o } = voteData.voted[key];
        resultText += `${o} (${e}) *${((v.length / totalVotes) * 100).toFixed(0)}%*\n`;
    }
    resultText += `\nTotal votes: *${totalVotes}*\n\nReact | reply to vote*`;
    return resultText;
};

let currentVotes;

exports.newVote = async (context, text) => {
    currentVotes = await getVotes();
    let chatId;

    if (userRegex.test(text)) {
        const matches = text.match(userRegex);
        if (matches.length === 1) {
            context.jid = matches[0];
        } else {
            chatId = matches;
        }
    }

    if (context.jid in currentVotes && !text) {
        return [currentVotes[context.jid].msg];
    }

    if (text.startsWith('result')) {
        if (!(context.jid in currentVotes)) {
            return ['No vote in progress'];
        }
        const totalVotes = currentVotes[context.jid].total.length;
        if (totalVotes === 0) {
            return ['No votes'];
        }
        return [generateResults(currentVotes[context.jid])];
    }

    if (text.startsWith('delete')) {
        if (userRegex.test(text)) {
            const matches = text.match(userRegex);
            for (const id of matches) {
                delete currentVotes[id];
            }
        } else {
            if (!(context.jid in currentVotes)) {
                return ['No vote in progress'];
            }
            delete currentVotes[context.jid];
        }
        await setVotes(currentVotes);
        return ['Vote deleted'];
    }

    if (!(context.jid in currentVotes)) {
        if (!text) {
            return ['Example\nvote q|What is your favorite color?\n\no|ðŸ˜Š|Blue\no|ðŸ˜Š|Red\n'];
        }

        const question = parseQuestion(text);
        if (question.length < 2) {
            throw new Error('Two options are required');
        }

        const options = parseOptions(text);
        if (!options.length) {
            throw new Error('Question required');
        }

        const forceVote = text.includes('--force');
        const voteMessage = `${question}\n\n${options.map(opt => `${opt.emoji} - ${opt.option}`).join('\n')}\n\n*react|reply to vote*`;

        if (chatId && chatId.length === 1) {
            for (const id of chatId) {
                currentVotes[id] = createVote(question, options, voteMessage, forceVote);
            }
        } else {
            currentVotes[context.jid] = createVote(question, options, voteMessage, forceVote);
        }

        await setVotes(currentVotes);
        return [voteMessage, chatId];
    } else {
        return ['Delete current vote to start a new one'];
    }
};

exports.participateInVote = async (message, voteId, participantId, option) => {
    if (!currentVotes) {
        currentVotes = await getVotes();
    }

    if (option) {
        if (!(voteId in currentVotes) || !voteId || currentVotes[voteId].total.includes(participantId)) {
            return;
        }
        const optionHex = convertToHex(option);
        const voteOption = currentVotes[voteId].voted[optionHex];
        if (!voteOption || currentVotes[voteId].voted[optionHex].v.includes(participantId)) {
            return;
        }
        currentVotes[voteId].voted[optionHex].v.push(participantId);
        currentVotes[voteId].total.push(participantId);
        await setVotes(currentVotes);
        return generateResults(currentVotes[voteId]);
    }

    const { jid, text, participant } = message;
    if (!message.isGroup || !(jid in currentVotes) || currentVotes[jid].total.includes(participantId)) {
        return;
    }

    if ((!message.reply_message || !message.reply_message.text || !text || !message.reply_message.text.includes(currentVotes[jid].question)) && !currentVotes[jid].force) {
        return;
    }

    const optionHex = convertToHex(text);
    let voteOption = currentVotes[jid].voted[optionHex];
    if (!voteOption) {
        const lowercaseText = text.toLowerCase();
        const matchingOption = currentVotes[jid].options.find(opt => opt.option === lowercaseText);
        if (matchingOption) {
            message.text = matchingOption.emoji;
            voteOption = currentVotes[jid].voted[convertToHex(matchingOption.emoji)];
        }
    }

    if (!voteOption) {
        if (currentVotes[jid].force) {
            return {
                text: currentVotes[jid].msg,
                option: { voted: null }
            };
        }
        return;
    }

    currentVotes[jid].voted[optionHex].v.push(participantId);
    currentVotes[jid].total.push(participantId);
    await setVotes(currentVotes);
    const resultText = generateResults(currentVotes[jid]);

    const contextInfo = { mentionedJid: [participant] };
    return {
        text: `@${participant.replace('@s.whatsapp.net', '')} voted for ${text}\n\n${resultText}`,
        contextInfo
    };
};