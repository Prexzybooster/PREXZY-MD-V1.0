const { setDb, getDb } = require('./db/store');
const expectedValue = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('./test/test');
const checkResult = iChecker();
const isValid = checkResult == expectedValue;

if (isValid) {
    exports.setCmd = async (command, { message, type }) => {
        const fileSha256 = message[type]?.fileSha256?.toString('base64');
        if (!fileSha256) {
            return -1;
        }
        db.cmd = {
            ...db.cmd,
            [fileSha256]: command
        };
        await setDb();
    };

    exports.getCmd = async () => {
        await getDb();
        return Object.values(db.cmd);
    };

    exports.delCmd = async (command) => {
        if (typeof command === 'string') {
            const keysToDelete = Object.keys(db.cmd).filter(key => db.cmd[key] === command);
            if (!keysToDelete.length) {
                return -1;
            }
            keysToDelete.forEach(key => delete db.cmd[key]);
        } else {
            const fileSha256 = command?.message?.message?.[command.type]?.fileSha256?.toString('base64');
            if (!fileSha256) {
                return -1;
            }
            delete db.cmd[fileSha256];
        }
        await setDb();
    };
}

const phonesList = [
    { manufacturer: 'Xiaomi', model: 'POCO F1' },
    { manufacturer: 'Xiaomi', model: 'Redmi 9A' },
    { manufacturer: 'Xiaomi', model: 'Xiaomi Mi 4' },
    { manufacturer: 'Vivo', model: 'Vivo Y20T' },
    { manufacturer: 'OnePlus', model: 'OnePlus 8T' },
    { manufacturer: 'Realme', model: 'Realme 8 5G' },
    { manufacturer: 'Samsung', model: 'Samsung Galaxy M51' }
];
exports.phonesList = phonesList;