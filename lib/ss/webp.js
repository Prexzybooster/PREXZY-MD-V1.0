const axios = require('axios');
const FormData = require('form-data');
const cheerio = require('cheerio');
const fs = require('fs');
const encodedString = 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';
const { iChecker } = require('../test/test');
const checkerInstance = iChecker();
const isValid = checkerInstance == encodedString;

if (isValid) {
    exports.webpToMp4 = async (filePath) => {
        const formData = new FormData();
        formData.append('new-image', fs.createReadStream(filePath));

        let { data } = await axios({
            method: 'post',
            url: 'https://ezgif.com/webp-to-mp4',
            data: formData,
            headers: { ...formData.getHeaders() }
        });

        let $ = cheerio.load(data);
        const fileValue = $('input[name="file"]').attr('value');
        const tokenValue = $('input[name="token"]').attr('value');
        const convertValue = $('input[name="convert"]').attr('value');

        const formData2 = new FormData();
        formData2.append('file', fileValue);
        if (tokenValue) {
            formData2.append('token', tokenValue);
        }
        formData2.append('convert', convertValue);

        let response = await axios({
            method: 'post',
            url: `https://ezgif.com/webp-to-mp4/${fileValue}`,
            data: formData2,
            headers: { ...formData2.getHeaders() }
        });

        $ = cheerio.load(response.data);
        const videoUrl = `https:${$('div#output > p.outfile > video > source').attr('src')}`;
        return videoUrl;
    };
}