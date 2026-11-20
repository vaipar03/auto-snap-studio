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
