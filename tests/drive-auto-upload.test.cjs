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
    return { target: context.target, context };
}

test('auto-upload drains local, queued, and failed photos only when enabled and ready', () => {
    const state = {
        drive: { autoUpload: true },
        photos: [
            { id: 'local', driveStatus: 'local' },
            { id: 'queued', driveStatus: 'queued' },
            { id: 'error', driveStatus: 'error' },
            { id: 'sent', driveStatus: 'sent' },
            { id: 'uploaded', driveStatus: 'uploaded' }
        ]
    };
    const queued = [];
    const { target: queuePendingDriveUploads } = loadInlineFunction('queuePendingDriveUploads', {
        state,
        isDirectUploadReady: () => true,
        queueAutoUpload: id => queued.push(id)
    });

    queuePendingDriveUploads();
    assert.deepEqual(queued, ['local', 'queued', 'error']);

    state.drive.autoUpload = false;
    queued.length = 0;
    queuePendingDriveUploads();
    assert.deepEqual(queued, []);
});

test('automatic uploads are serialized and duplicate photo IDs are queued once', async () => {
    const uploaded = [];
    const { target: queueAutoUpload, context } = loadInlineFunction('queueAutoUpload', {
        state: { drive: { autoUpload: true }, photos: [] },
        isDirectUploadReady: () => true,
        uploadPhotoToDrive: async id => { uploaded.push(id); },
        driveUploadQueue: Promise.resolve(),
        queuedDriveUploadIds: new Set(),
        renderGallery() {},
        console,
        showToast() {}
    });

    queueAutoUpload('photo-a');
    queueAutoUpload('photo-a');
    queueAutoUpload('photo-b');
    await context.driveUploadQueue;

    assert.deepEqual(uploaded, ['photo-a', 'photo-b']);
    assert.equal(context.queuedDriveUploadIds.size, 0);
});

test('new captures enter the auto-upload queue when Drive is ready', () => {
    const state = { photos: [], drive: { autoUpload: true }, autoAdvance: false };
    const queued = [];
    const { target: saveCapturedRecord } = loadInlineFunction('saveCapturedRecord', {
        state,
        getResolvedAngleInfo: () => ({ label: 'Front', slug: 'front', multiCapture: false }),
        isDirectUploadReady: () => true,
        buildPhotoFilename: slug => `${slug}.jpg`,
        renderStepper() {},
        renderOverlay() {},
        renderGallery() {},
        queueAutoUpload: id => queued.push(id),
        showToast() {}
    });

    saveCapturedRecord({ id: 'front', isExtra: false }, 'data:image/jpeg;base64,abc', 'Front');

    assert.equal(state.photos.length, 1);
    assert.deepEqual(queued, [state.photos[0].id]);
});

test('OAuth Drive calls support Shared Drive folders and surface upload failures', () => {
    assert.match(html, /files\?q=\$\{q\}&fields=files\(id,name\)&supportsAllDrives=true&includeItemsFromAllDrives=true/);
    assert.match(html, /files\?supportsAllDrives=true/);
    assert.match(html, /uploadType=multipart&supportsAllDrives=true/);
    assert.match(html, /Drive upload failed: \$\{message\}/);
});
