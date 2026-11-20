const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadInlineFunction(name, globals = {}) {
    const definition = html.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n        \\}`));
    assert.ok(definition, `${name} should exist in index.html`);
    const context = { ...globals };
    vm.runInNewContext(`${definition[0]}; this.target = ${name};`, context);
    return context.target;
}

test('webhook uploads require both a destination folder and a script URL', () => {
    const state = { drive: { authMode: 'webhook', folderId: '', webhookUrl: 'https://script.example/exec' } };
    const isReady = loadInlineFunction('isDirectUploadReady', { state, Date });
    assert.equal(isReady(), false);

    state.drive.folderId = 'drive-folder-id';
    assert.equal(isReady(), true);

    state.drive.webhookUrl = '';
    assert.equal(isReady(), false);
});

test('OAuth multipart payload contains JPEG bytes instead of base64 text', async () => {
    const buildBody = loadInlineFunction('buildDriveMultipartBody', {
        Blob,
        atob: value => Buffer.from(value, 'base64').toString('binary')
    });
    const body = buildBody('/9j/', { name: 'car.jpg' }, 'test-boundary');
    const bytes = Buffer.from(await body.arrayBuffer());
    const payload = bytes.toString('latin1');

    assert.equal(body.type, 'multipart/related; boundary=test-boundary');
    assert.ok(payload.includes('{"name":"car.jpg"}'));
    assert.ok(bytes.includes(Buffer.from([0xff, 0xd8, 0xff])));
    assert.equal(payload.includes('/9j/'), false);
    assert.ok(payload.endsWith('\r\n--test-boundary--'));
});
