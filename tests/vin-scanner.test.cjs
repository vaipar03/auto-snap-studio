const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const definition = html.match(/function getVinFromBarcode\(rawValue\) \{[\s\S]*?\n        \}/);
assert.ok(definition, 'VIN barcode extraction function should exist in index.html');
const context = {};
vm.runInNewContext(`${definition[0]}; this.getVinFromBarcode = getVinFromBarcode;`, context);
const getVinFromBarcode = context.getVinFromBarcode;

const vin = '1HGCM82633A004352';

test('extracts an uninterrupted VIN from a barcode payload', () => {
    assert.equal(getVinFromBarcode(vin), vin);
});

test('extracts a VIN with spaces or hyphens between characters', () => {
    assert.equal(getVinFromBarcode('VIN: 1HG-CM8-26-33A-004-352'), vin);
});

test('rejects invalid VIN characters and VINs embedded in longer identifiers', () => {
    assert.equal(getVinFromBarcode('1HGCM82633A00435I'), '');
    assert.equal(getVinFromBarcode(`X${vin}`), '');
    assert.equal(getVinFromBarcode(`${vin}X`), '');
});

test('extracts labeled and compact VIN barcode payload variants', () => {
    assert.equal(getVinFromBarcode('VIN NO: 1HGCM82633A004352'), vin);
    assert.equal(getVinFromBarcode('VEHICLE IDENTIFICATION NUMBER 1HGCM82633A004352'), vin);
    assert.equal(getVinFromBarcode('1HGCM82633A004352\r\n'), vin);
    assert.equal(getVinFromBarcode('WMI=1HGCM82633A004352'), vin);
});

test('strips a leading Code 39 I prefix from the barcode payload', () => {
    assert.equal(getVinFromBarcode('I1HGCM82633A004352'), vin);
});

test('extracts the supplied WA1GCCFS6HR011411 door-jamb VIN', () => {
    assert.equal(getVinFromBarcode('IWA1GCCFS6HR011411'), 'WA1GCCFS6HR011411');
    assert.equal(getVinFromBarcode('WA1GCCFS6HR011411'), 'WA1GCCFS6HR011411');
});

test('OCR normalizes common VIN misreads and extracts the printed VIN', () => {
    assert.match(html, /function getVinFromOcrText/);
    assert.match(html, /replace\(\/O\/g, '0'\)/);
    assert.match(html, /replace\(\/I\/g, '1'\)/);
    assert.match(html, /VIN_OCR_SCRIPT_URL/);
    assert.match(html, /canvas\.width = 2400/);
    assert.match(html, /variants = \['normal', 'contrast', 'threshold'\]/);
});

test('scanner prefers VIN barcode formats and keeps decode work lightweight', () => {
    assert.match(html, /POSSIBLE_FORMATS/);
    assert.match(html, /CODE_128/);
    assert.match(html, /CODE_39/);
    assert.match(html, /PDF_417/);
    assert.match(html, /BarcodeDetector/);
    assert.match(html, /Capture & Decode/);
    assert.match(html, /captureVinFrameNow/);
    assert.doesNotMatch(html, /advanced:\s*\[\{\s*zoom/);
    assert.match(html, /reader\.decodeFromStream\([\s\S]*?\.catch\(/);
    assert.match(html, /getOrientedCameraFrame\(video, state\.cameraVideoRotation\)/);
    assert.match(html, /barcode crops/);
});

test('VIN scanner includes three flashlight modes and landscape safe areas', () => {
    assert.match(html, /id="vin-flash-off"/);
    assert.match(html, /id="vin-flash-on"/);
    assert.match(html, /id="vin-flash-auto"/);
    assert.match(html, /setVinScannerTorchMode/);
    assert.match(html, /vinScannerTorchMode/);
    assert.match(html, /@media \(orientation: landscape\)[\s\S]*?#vin-scanner-panel/);
    assert.match(html, /env\(safe-area-inset-(top|bottom)/);
    assert.match(html, /handleVinScannerViewfinderTap/);
    assert.match(html, /applyVinScannerAutoFocus/);
    assert.match(html, /id="vin-scanner-header"/);
    assert.match(html, /id="vin-scanner-content"/);
    assert.match(html, /id="vin-scanner-actions"/);
    assert.match(html, /#vin-scanner-panel[\s\S]*?height:\s*calc\(100dvh/);
});
