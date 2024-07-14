const { prepareWAMessageMedia } = require('baileys');
const { getMessage, setMessage } = require('./db');
const { getBuffer } = require('./fetch');
const { isUrl, genHydratedButtons, store } = require('./utils');
const { iChecker } = require('./test/test');

const checkValid = iChecker() === 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';

if (checkValid) {
  const extractButtons = (text) => (text.match(/#button\\(.|\n)*?#/gm) || []).map(match => match.split('\\')[1].replace(/#/, ''));
  exports.getButtons = extractButtons;

  const extractUrlButtons = (text) => (text.match(/#ubutton\\(.|\n)*?#/gm) || []).map(match => match.split('\\')[1].replace('#', ''));
  exports.getUrlButtons = extractUrlButtons;

  const extractCallButtons = (text) => (text.match(/#cbutton\\(.|\n)*?#/gm) || []).map(match => match.split('\\')[1].replace('#', ''));
  exports.getCallButtons = extractCallButtons;

  const extractNumButtons = (text) => (text.match(/#num\\(.|\n)*?#/gm) || []).map(match => match.split('\\')[1].replace('#', ''));
  exports.getBunNums = extractNumButtons;

  const extractUrls = (text) => (text.match(/#url\\(.|\n)*?#/gm) || []).map(match => match.split('\\')[1].replace('#', ''));
  exports.getBunUrls = extractUrls;

  const extractHeaders = (text) => (text.match(/#header\\(.|\n)*?#/gm) || []).map(match => match.split('\\')[1].replace('#', ''));
  exports.getHeader = extractHeaders;

  const generateMessage = async (media, caption, sender, mediaType, client) => {
    let hasButtons = false;
    let buttons = [];
    const options = { caption: caption.trim() };

    if (/&mention/.test(caption)) {
      options.contextInfo = { mentionedJid: [sender] };
      caption = caption.replace(/&mention/g, '@' + sender.split('@')[0]);
    }

    const urlButtons = extractUrlButtons(caption);
    const header = extractHeaders(caption);
    const regularButtons = extractButtons(caption);
    const urls = extractUrls(caption);
    const callButtons = extractCallButtons(caption);
    const numButtons = extractNumButtons(caption);

    if ((urlButtons.length > 0 && urls.length > 0) || (callButtons.length > 0 && numButtons.length > 0)) {
      hasButtons = true;
      const hydratedButtons = [];

      urlButtons.forEach((button, index) => {
        caption = caption.replace(`#ubutton\\${button}#`, '').replace(`#url\\${urls[index]}#`, '').trim();
        hydratedButtons.push({ urlButton: { text: button, url: urls[index] } });
      });

      callButtons.forEach((button, index) => {
        caption = caption.replace(`#cbutton\\${button}#`, '').replace(`#num\\${numButtons[index]}#`, '').trim();
        hydratedButtons.push({ callButton: { text: button, number: numButtons[index] } });
      });

      regularButtons.forEach((button) => {
        caption = caption.replace(`#button\\${button}#`, '').trim();
        hydratedButtons.push({ button: { text: button, id: button } });
      });

      if (header.length > 0) {
        caption = caption.replace(`#header\\${header[0]}#`, '').trim();
      }

      buttons = await genHydratedButtons(hydratedButtons, caption, header);
    }

    const msg = { msg: buttons || caption.trim(), options, type: hasButtons ? 'template' : mediaType };
    return msg;
  };

  exports.genGreetings = generateMessage;

  exports.greetingsPreview = async (context, key) => {
    const messageData = await getMessage(context.jid, key);
    if (!messageData) return false;

    let mediaUrl = isUrl(messageData.message);

    if (/&desc|&name|&size/.test(messageData.message)) {
      const { participants, subject, desc } = await store.fetchGroupMetadata(context.jid);
      messageData.message = messageData.message.replace('&desc', desc || '').replace('&name', subject).replace('&size', participants.length);
    }

    if (!mediaUrl && /&pp/.test(messageData.message)) {
      messageData.message = messageData.message.replace('&pp', '');
      try {
        mediaUrl = await context.client.profilePictureUrl(context.participant, 'image');
      } catch (e) {}
    }

    const mediaBuffer = mediaUrl && await getBuffer(mediaUrl);

    if (!key && mediaBuffer?.buffer) {
      await setMessage(messageData.chat, mediaBuffer.type || 'text', messageData.message, messageData.enabled);
    }

    const mediaType = ['video', 'image'].includes(mediaBuffer?.type) ? mediaBuffer.type : 'text';
    const generatedMessage = await generateMessage(mediaBuffer?.buffer, messageData.message, context.participant, mediaType, context.client);

    return generatedMessage;
  };

  exports.enableGreetings = async (jid, key, status) => {
    const { message, type } = await getMessage(jid, key);
    return await setMessage(jid, type, message, status === 'on');
  };

  exports.clearGreetings = (jid, type) => {
    const greetsType = { welcome: 'welfiles', goodbye: 'goodfiles', banbye: 'banfiles' }[type];
    const greetIndex = greets[greetsType].find(greet => greet.startsWith(jid));
    if (greetIndex !== undefined) {
      greets[greetsType].splice(greets[greetsType].indexOf(greetIndex), 1);
    }
  };
}