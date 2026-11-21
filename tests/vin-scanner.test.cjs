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

test('scanner prefers VIN barcode formats and adds native BarcodeDetector fallback', () => {
    assert.match(html, /POSSIBLE_FORMATS/);
    assert.match(html, /CODE_128/);
    assert.match(html, /CODE_39/);
    assert.match(html, /PDF_417/);
    assert.match(html, /BarcodeDetector/);
    assert.match(html, /startNativeVinBarcodeDetection/);
    assert.match(html, /Capture & Decode/);
    assert.match(html, /captureVinFrameNow/);
    assert.match(html, /capabilities\.zoom/);
});
