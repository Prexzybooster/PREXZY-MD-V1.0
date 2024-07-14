const formData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

exports.removeBg = async (filePath, apiKey) => {
    const form = new formData();
    form.append('size', 'auto');
    form.append('image_file', fs.createReadStream(filePath), path.basename(filePath));

    const config = {
        method: 'post',
        url: 'https://api.remove.bg/v1.0/removebg',
        headers: {
            'X-Api-Key': apiKey,
            ...form.getHeaders()
        },
        data: form,
        responseType: 'arraybuffer'
    };

    try {
        const { data } = await axios(config);
        return data;
    } catch (error) {
        return error.message;
    }
};