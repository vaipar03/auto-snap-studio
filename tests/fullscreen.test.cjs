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
    return context.target;
}

test('fullscreen control toggles the immersive layout when native fullscreen is unavailable', () => {
    const state = { cameraImmersive: false };
    const classes = new Set();
    const buttonAttributes = {};
    const toasts = [];
    const pageCamera = {
        classList: {
            toggle(name, enabled) {
                if (enabled) classes.add(name);
                else classes.delete(name);
            }
        }
    };
    const button = {
        classList: { toggle() {} },
        setAttribute(name, value) { buttonAttributes[name] = value; }
    };
    const document = {
        fullscreenElement: null,
        webkitFullscreenElement: null,
        getElementById(id) {
            return id === 'page-camera' ? pageCamera : button;
        }
    };
    const toggleCameraFullscreen = loadInlineFunction('toggleCameraFullscreen', {
        state,
        document,
        canRequestCameraFullscreen: () => false,
        getFullscreenHelpMessage: () => 'Expanded camera view',
        showToast: message => toasts.push(message)
    }, ['updateFullscreenButton', 'setCameraImmersive']);

    toggleCameraFullscreen();

    assert.equal(state.cameraImmersive, true);
    assert.ok(classes.has('camera-immersive'));
    assert.equal(buttonAttributes['aria-label'], 'Exit expanded camera view');
    assert.deepEqual(toasts, ['Expanded camera view']);

    toggleCameraFullscreen();

    assert.equal(state.cameraImmersive, false);
    assert.ok(!classes.has('camera-immersive'));
    assert.equal(buttonAttributes['aria-label'], 'Expand camera view');
});

test('immersive layout keeps its fullscreen control while expanding the viewfinder', () => {
    assert.match(html, /#page-camera\.camera-immersive #camera-header-leading,[\s\S]*?#camera-angle-controls\s*\{\s*display:\s*none !important;/);
    assert.match(html, /#page-camera\.camera-immersive #fullscreen-btn\s*\{\s*display:\s*flex/);
    assert.match(html, /#page-camera\.camera-immersive #camera-workspace\s*\{\s*padding:\s*0\.375rem/);
    assert.match(html, /id="camera-angle-controls"/);
});
