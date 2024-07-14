const fs = require('fs');
const path = require('path');

let isChecked = false;

const checker = () => {
    const config = {
        expectedString: 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==',
        // iloveyousoooooomatchbutidontknowwhyilikelovewantu
        // 🙄🙄🤣🤣🤣
    };

    /* try {
       const fileContent = fs.readFileSync(path.join(__dirname, config.filePath), 'utf8');
        const isExpected = fileContent.split('\n')[1].trim() === config.cloneCommand;
        const stats = fs.statSync(path.join(__dirname, config.filePath));
        isChecked = (stats.size === 191 || stats.size === 195) && isExpected;
    } catch (err) {
        isChecked = !isChecked;
    } */

    // return isChecked;
    return config.expectedString;
};

exports.iChecker = checker;
