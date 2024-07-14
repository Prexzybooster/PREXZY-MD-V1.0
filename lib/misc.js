const getImgUrl = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    return $('#il_fi').attr('src');
};

const getCommonElements = (arrays, isDeep) => {
    let commonElements = [];
    if (isDeep) {
        for (let i = 0; i < arrays.length; i++) {
            for (let j = 1; j < arrays.length; j++) {
                if (i === j) continue;
                commonElements = [
                    ...commonElements,
                    ...arrays[i].filter(item => arrays[j].includes(item))
                ];
            }
        }
    } else {
        commonElements = arrays.reduce((acc, array) => acc.filter(item => array.includes(item)));
    }
    return Array.from(new Set(commonElements));
};

const createButtonMessage = async (buttons, title, body, options = {}) => {
    const buttonArray = buttons.slice(2).map(button => ({
        id: button,
        text: button
    }));
    return await genButtonMessage(buttonArray, title, body, options.reply_message);
};

const toPdf = async () => {
    const pdfFiles = readdirSync('./pdf');
    if (pdfFiles.length === 0) {
        throw new Error("No PDF files found to combine.");
    }
    return new Promise((resolve) => {
        const doc = new PDFDocument({ margin: 0, size: [841.89, 1190.55] });
        pdfFiles.forEach((file, index) => {
            doc.image(path.join(__dirname, '../pdf', file), 0, 0, { align: 'center', valign: 'center', fit: [841.89, 1190.55] });
            if (index < pdfFiles.length - 1) doc.addPage();
        });
        doc.end();
        const writeStream = createWriteStream('./pdf/output.pdf');
        doc.pipe(writeStream).on('finish', () => {
            emptyDirSync('./pdf');
            resolve(readFileSync('./pdf/output.pdf'));
        });
    });
};

const isSpam = async (chatId, senderId, message, isGroup, groupId, chat) => {
    const { enabled, type } = await getSpam(chatId);
    if (!enabled) return false;
    return spamCheck(chatId, senderId, message, isGroup, groupId, chat);
};

exports.getImgUrl = getImgUrl;
exports.getCommonElements = getCommonElements;
exports.createButtonMessage = createButtonMessage;
exports.toPdf = toPdf;
exports.isSpam = isSpam;