const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const cookie = require('cookie');
const { iChecker } = require('./test/test');
const config = iChecker();
const isConfigValid = config == 'aWxvdmV5b3Vzb29vb29vbWF0Y2hidXRpZG9udGtub3d3aHlpbGlrZWxvdmV3YW50dQ==';

if (isConfigValid) {
    exports.textMaker = async (url, texts, radioValue = '') => {
        texts = texts.split(';');
        const baseURL = 'https://' + new URL(url).host + '/';
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        };
        const response = await fetch(url, { method: 'GET', headers });
        const html = await response.text();
        let cookies = response.headers.get('set-cookie').split(',').map(cookie.parse).reduce((acc, item) => ({ ...acc, ...item }), {});
        cookies = Object.entries(cookies).map(([key, value]) => cookie.serialize(key, value)).join('; ');
        const $ = cheerio.load(html);
        const token = $('input[name="token"]').attr('value');
        const buildServer = $('input[name="build_server"]').attr('value');
        const buildServerId = $('input[name="build_server_id"]').attr('value');

        const formData = new FormData();
        texts.forEach(text => formData.append('text[]', text.trim()));
        formData.append('submit', 'Go');
        if (radioValue) {
            formData.append('radio0', radioValue);
        }
        formData.append('token', token);
        formData.append('build_server', buildServer);
        formData.append('build_server_id', buildServerId);

        const postResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                'Cookie': cookies,
                ...formData.getHeaders()
            },
            body: formData.getBuffer()
        });

        const postResult = await postResponse.text();
        const $postResult = cheerio.load(postResult);
        let result;
        if (baseURL === 'https://photo360.com/') {
            result = $postResult('input[name="form_value_input"]').attr('value');
        } else {
            result = $postResult('#form_value').first().text();
        }

        if (!result) {
            return { status: false };
        }

        let parsedResult = JSON.parse(result);
        const finalFormData = new FormData();
        finalFormData.append('id', parsedResult.id);
        parsedResult.text.forEach(text => finalFormData.append('text[]', text));
        finalFormData.append('token', parsedResult.token);
        finalFormData.append('build_server', parsedResult.build_server);
        finalFormData.append('build_server_id', parsedResult.build_server_id);

        if (parsedResult.hasOwnProperty('radio0')) {
            finalFormData.append('radio0', parsedResult.radio0.radio);
        }

        const finalResponse = await fetch(baseURL + 'effect/createimage', {
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                'Cookie': cookies,
                ...finalFormData.getHeaders()
            },
            body: finalFormData.getBuffer()
        });

        const finalResult = await finalResponse.json();
        return { status: finalResult.success, imageUrl: baseURL + finalResult.image };
    };
}