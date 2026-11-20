const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadInlineFunction(name, globals = {}, dependencies = []) {
    const definitions = [...dependencies, name].map(functionName => {
        const definition = html.match(new RegExp(`function ${functionName}\\([^)]*\\) \\{[\\s\\S]*?\\n        \\}`));
        assert.ok(definition, `${functionName} should exist in index.html`);
        return definition[0];
    });
    const context = { ...globals };
    vm.runInNewContext(`${definitions.join('\n')}; this.target = ${name};`, context);
    return { target: context.target, context };
}

test('walkaround framing order matches the requested clockwise sequence', () => {
    const optionsBlock = html.match(/ext_walkaround:\s*\{\s*prompt:[\s\S]*?options:\s*\[([\s\S]*?)\]\s*\}/);
    assert.ok(optionsBlock, 'walkaround framing options should exist');
    const options = [...optionsBlock[1].matchAll(/\{ key: '([^']+)', pill: '([^']+)', label: '([^']+)'/g)];
    assert.deepEqual(options.map(([, , , label]) => label), [
        'a. Front Driver 2/4',
        'b. Front Straight',
        'c. Front Pass. 2/4',
        'd. Pass. Side Profile',
        'e. Rear Pass. 2/4',
        'f. Rear Straight',
        'g. Rear Driver 2/4',
        'h. Driver Side Profile'
    ]);
    assert.equal(new Set(options.map(([, key]) => key)).size, 8);
});

test('portrait camera header keeps an explicit return-to-setup action', () => {
    const backButton = html.match(/<button\s+id="camera-back-button"[\s\S]*?<\/button>/);
    assert.ok(backButton, 'camera back button should exist');
    assert.match(backButton[0], /onclick="switchPage\('setup'\)"/);
    assert.match(backButton[0], /<span>Back<\/span>/);
    assert.match(html, /@media \(orientation: portrait\) and \(max-width: 639px\)[\s\S]*?#camera-back-button\s*\{[\s\S]*?display:\s*flex/);
});

test('Page 1 reserves safe-area space for narrow portrait screens', () => {
    assert.match(
        html,
        /@media \(orientation: portrait\) and \(max-width: 639px\)\s*\{[\s\S]*?#setup-page-header\s*\{\s*padding-top:\s*max\(4\.5rem,\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*0\.75rem\)\)/
    );
});

test('walkaround toggle selects the shared eight-angle capture group', () => {
    const state = {
        activeAngleIndex: 2,
        categoryFilter: 'interior',
        walkaroundBarOpen: false,
        photos: [{ angleId: 'ext_walkaround', subAngleKey: 'a_front_driver_24' }],
        selectedSubAngles: { ext_walkaround: 'a_front_driver_24' }
    };
    let stepperRenders = 0;
    let overlayRenders = 0;
    const { target: toggleWalkaroundFraming } = loadInlineFunction('toggleWalkaroundFraming', {
        state,
        CORE_ANGLES: [{ id: 'other' }, { id: 'ext_walkaround', isWalkaround: true }],
        ANGLE_SUB_OPTIONS: {
            ext_walkaround: {
                options: [{ key: 'a_front_driver_24' }, { key: 'b_front_straight' }]
            }
        },
        showToast() {},
        renderStepper() { stepperRenders++; },
        renderOverlay() { overlayRenders++; }
    }, ['selectNextUncapturedWalkaround']);

    toggleWalkaroundFraming();

    assert.equal(state.activeAngleIndex, 1);
    assert.equal(state.categoryFilter, 'exterior');
    assert.equal(state.walkaroundBarOpen, true);
    assert.equal(state.selectedSubAngles.ext_walkaround, 'b_front_straight');
    assert.equal(stepperRenders, 1);
    assert.equal(overlayRenders, 1);
    assert.match(html, /onclick="toggleWalkaroundFraming\(\)"/);
    assert.match(html, /id="subangle-bar" class="hidden/);
    assert.match(html, /#subangle-bar\s*\{[\s\S]*?bottom:\s*calc\(100% \+ 0\.5rem\)/);
});

test('capturing another walkaround angle does not replace existing angles', () => {
    const state = {
        photos: [],
        selectedSubAngles: { ext_walkaround: 'a_front_driver_24' },
        drive: { autoUpload: false },
        autoAdvance: false
    };
    const options = [
        { key: 'a_front_driver_24', label: 'a. Front Driver 2/4', slug: 'front-driver' },
        { key: 'b_front_straight', label: 'b. Front Straight', slug: 'front-straight' }
    ];
    const getResolvedAngleInfo = angle => {
        const option = options.find(item => item.key === state.selectedSubAngles[angle.id]);
        return { subKey: option.key, label: option.label, slug: option.slug, multiCapture: true };
    };
    const { target: saveCapturedRecord } = loadInlineFunction('saveCapturedRecord', {
        state,
        getResolvedAngleInfo,
        isDirectUploadReady: () => false,
        buildPhotoFilename: slug => `${slug}.jpg`,
        sanitizeSlug: value => value,
        renderStepper() {},
        renderOverlay() {},
        renderGallery() {},
        showToast() {}
    });
    const angle = { id: 'ext_walkaround', isExtra: false, isWalkaround: true };

    saveCapturedRecord(angle, 'first-data', 'a. Front Driver 2/4');
    state.selectedSubAngles.ext_walkaround = 'b_front_straight';
    saveCapturedRecord(angle, 'second-data', 'b. Front Straight');

    assert.deepEqual(state.photos.map(photo => photo.subAngleKey), ['a_front_driver_24', 'b_front_straight']);
    state.selectedSubAngles.ext_walkaround = 'a_front_driver_24';
    saveCapturedRecord(angle, 'retake-data', 'a. Front Driver 2/4');

    assert.equal(state.photos.length, 2);
    assert.equal(state.photos[0].dataUrl, 'retake-data');
    assert.equal(state.photos[1].dataUrl, 'second-data');
});
