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

test('rear walkaround sketches use rear three-quarter geometry and correct side orientation', () => {
    const guideState = { guideStyle: 'silhouette', outlinerLook: 'cad_sketch' };
    const { target: buildSilhouetteSvg } = loadInlineFunction('buildSilhouetteSvg', {
        state: guideState,
        window: { matchMedia: () => ({ matches: false }) },
        VEHICLE_GUIDE_SCALE: 1,
        VEHICLE_GUIDE_LANDSCAPE_SCALE: 1,
        OUTLINER_LOOKS: [{
            id: 'cad_sketch',
            stroke: '#60a5fa',
            secondary: '#e0f2fe',
            subtle: 'rgba(147,197,253,0.38)',
            accent: '#3b82f6',
            groundBracket: '#3b82f6',
            fillTop: 'rgba(59,130,246,0.10)',
            dash: '',
            glow: true
        }, {
            id: 'modern_sketch',
            stroke: '#e2e8f0',
            secondary: '#a5f3fc',
            subtle: 'rgba(148,163,184,0.42)',
            accent: '#22d3ee',
            groundBracket: 'rgba(148,163,184,0.48)',
            fillTop: 'rgba(34,211,238,0.08)',
            dash: '',
            glow: false
        }]
    });
    const rearPassenger = buildSilhouetteSvg('Sedan', 'exterior_rear', true);
    const rearDriver = buildSilhouetteSvg('Sedan', 'exterior_rear', false);
    const rearPassengerOption = html.match(/\{ key: 'e_rear_pass_24'[^}]*\}/);
    const rearDriverOption = html.match(/\{ key: 'g_rear_driver_24'[^}]*\}/);
    const passengerBodyGroup = rearPassenger.match(/<g([^>]*)>\s*<!-- Sculpted Cabin/);
    const driverBodyGroup = rearDriver.match(/<g([^>]*)>\s*<!-- Sculpted Cabin/);
    const passengerBracketGroup = rearPassenger.match(/<g([^>]*)>\s*<!-- Bold L-Shaped Ground/);
    const driverBracketGroup = rearDriver.match(/<g([^>]*)>\s*<!-- Bold L-Shaped Ground/);

    assert.match(rearPassenger, /SEDAN PASSENGER SIDE REAR 3\/4/);
    assert.match(rearDriver, /SEDAN DRIVER SIDE REAR 3\/4/);
    assert.ok(rearPassengerOption);
    assert.ok(rearDriverOption);
    assert.match(rearPassengerOption[0], /type: 'exterior_rear', mirror: true/);
    assert.match(rearDriverOption[0], /type: 'exterior_rear', mirror: false/);
    assert.ok(passengerBodyGroup);
    assert.ok(driverBodyGroup);
    assert.ok(passengerBracketGroup);
    assert.ok(driverBracketGroup);
    assert.match(rearPassenger, /M43 145 C41 129 46 117 64 110 L130 102 L326 98/);
    assert.match(rearDriver, /M43 145 C41 129 46 117 64 110 L130 102 L326 98/);
    assert.match(rearPassenger, /M72 111 L119 106 L120 120 L70 126 Z/);
    assert.match(rearDriver, /M67 126 L122 120 L122 140 L66 143 Z/);
    assert.match(rearPassenger, /M47 117 L64 113 L65 133 L48 135 Z/);
    assert.match(rearDriver, /M47 117 L64 113 L65 133 L48 135 Z/);
    assert.match(passengerBodyGroup[1], /transform="translate\(420,0\) scale\(-1,1\)"/);
    assert.doesNotMatch(driverBodyGroup[1], /transform=/);
    assert.doesNotMatch(passengerBracketGroup[1], /transform=/);
    assert.match(driverBracketGroup[1], /transform="translate\(420,0\) scale\(-1,1\)"/);
    assert.doesNotMatch(rearPassenger, /M56 128 C76 123 98 123 116 128/);
    assert.doesNotMatch(rearDriver, /M56 128 C76 123 98 123 116 128/);

    for (const bodyStyle of ['Sedan', 'Hatchback', 'SUV', 'Pickup', 'Coupe', 'Convertible', 'Wagon', 'Van']) {
        const rearStyle = buildSilhouetteSvg(bodyStyle, 'exterior_rear', false);
        assert.match(rearStyle, /Angled rear plane, hatch glass, liftgate seam/);
        assert.doesNotMatch(rearStyle, /undefined/);
    }

    guideState.outlinerLook = 'modern_sketch';
    const modernRear = buildSilhouetteSvg('Sedan', 'exterior_rear', true);
    assert.match(html, /id: 'modern_sketch', label: 'Modern Sketch'/);
    assert.match(modernRear, /M44 188 Q210 181 376 188/);
    assert.match(modernRear, /rgba\(34,211,238,0\.12\)/);
    assert.doesNotMatch(modernRear, /<rect x="20" y="26" width="380" height="182" rx="8" fill="url\(#cadSubGrid\)"/);
    assert.doesNotMatch(modernRear, /M168 189 L378 164 L378 76/);
    assert.doesNotMatch(modernRear, /x1="152" y1="154" x2="184" y2="154"/);

    guideState.guideStyle = 'wheel_anchors';
    guideState.outlinerLook = 'cad_sketch';
    const rearPassengerAnchors = buildSilhouetteSvg('Sedan', 'exterior_rear', true);
    const rearDriverAnchors = buildSilhouetteSvg('Sedan', 'exterior_rear', false);
    assert.match(rearPassengerAnchors, /<g transform="translate\(420,0\) scale\(-1,1\)">/);
    assert.doesNotMatch(rearDriverAnchors, /<g transform="translate\(420,0\) scale\(-1,1\)">/);
});

test('portrait camera header keeps an explicit return-to-setup action', () => {
    const backButton = html.match(/<button\s+id="camera-back-button"[\s\S]*?<\/button>/);
    assert.ok(backButton, 'camera back button should exist');
    assert.match(backButton[0], /onclick="switchPage\('setup'\)"/);
    assert.match(backButton[0], /<span>Back<\/span>/);
    assert.match(html, /@media \(orientation: portrait\) and \(max-width: 639px\)[\s\S]*?#camera-back-button\s*\{[\s\S]*?display:\s*flex/);
});

test('setup and camera headers reserve safe-area space in narrow portrait screens', () => {
    assert.match(
        html,
        /@media \(orientation: portrait\) and \(max-width: 639px\)\s*\{[\s\S]*?#setup-page-header,\s*#camera-header\s*\{\s*padding-top:\s*max\(4\.5rem,\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*0\.75rem\)\)/
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
