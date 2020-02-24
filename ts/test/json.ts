import * as assert from 'assert';

import * as parser from '../src/index';

describe('JSON parser', () => {
    it('should handle a single resource', () => {
        const result = parser.parseYAML(`{ "hello": "world" }`);
        assert.equal(result.length, 1);
    });

    const topLevelOnly = `{ "apiVersion": "apps/v1",\n"kind": "Namespace" }`;
    const topLevelTypes = `{ "stringy": "foo",\n"inty": 123,\n"floaty": 4.5,\n"booly": true }`;

    it('should contain top level entries', () => {
        const result = parser.parseJSON(topLevelOnly)[0];
        assert.equal(Object.keys(result.entries).length, 2);
        assert.notEqual(result.entries['apiVersion'], undefined);
        assert.notEqual(result.entries['kind'], undefined);
    });
    it('should have the ranges for top level keys', () => {
        const result = parser.parseJSON(topLevelOnly)[0];
        assert.equal(result.entries['apiVersion'].keyRange.start, 2);
        assert.equal(result.entries['apiVersion'].keyRange.end, 14);
        assert.equal(result.entries['kind'].keyRange.start, 27);
        assert.equal(result.entries['kind'].keyRange.end, 33);
    });
    it('should have the values of top level scalars', () => {
        const result = parser.parseJSON(topLevelOnly)[0];
        assertEqualsStringValue(result.entries['apiVersion'], 'apps/v1');
        assertEqualsStringValue(result.entries['kind'], 'Namespace');
    });
    it('should have the ranges for top level scalar values', () => {
        const result = parser.parseJSON(topLevelOnly)[0];
        assert.equal(range(result.entries['apiVersion'].value).start, 16);
        assert.equal(range(result.entries['apiVersion'].value).end, 25);
        assert.equal(range(result.entries['kind'].value).start, 35);
        assert.equal(range(result.entries['kind'].value).end, 46);
    });
    it('should support all scalar types at top level', () => {
        const result = parser.parseJSON(topLevelTypes)[0];
        assert.equal(Object.keys(result.entries).length, 4);
        assertEqualsStringValue(result.entries['stringy'], 'foo');
        assertEqualsNumberValue(result.entries['inty'], 123);
        assertEqualsNumberValue(result.entries['floaty'], 4.5);
        assertEqualsBooleanValue(result.entries['booly'], true);
    });
    it('should provide access to raw text', () => {
        const result = parser.parseJSON(topLevelTypes)[0];
        assert.equal(Object.keys(result.entries).length, 4);
        assertEqualsRawText(result.entries['stringy'], 'foo');
        assertEqualsRawText(result.entries['inty'], '123');
        assertEqualsRawText(result.entries['floaty'], '4.5');
        assertEqualsRawText(result.entries['booly'], 'true');
    });

    const nested = `{ "apiVersion": "apps/v1",\n"kind": "Namespace",\n"metadata": {\n  "name": "foo",\n  "generation": 123,\n  "labels": {\n    "hello": "world"\n  }\n} }`;

    it('should represent nested entries as maps', () => {
        const result = parser.parseJSON(nested)[0];
        assert.equal(Object.keys(result.entries).length, 3);
        assert.equal(result.entries['apiVersion'].value.valueType, 'string');
        assert.equal(result.entries['kind'].value.valueType, 'string');
        assert.equal(result.entries['metadata'].value.valueType, 'map');
    });
    it('should represent nested hierarchies', () => {
        const result = parser.parseJSON(nested)[0];
        const metadata = result.entries['metadata'].value;
        if (metadata.valueType !== 'map') {
            assert.fail('expected top level metadata item to be a map');
            return;
        }
        const labels = metadata.entries['labels'].value;
        if (labels.valueType !== 'map') {
            assert.fail('expected metadata.labels item to be a map');
            return;
        }

        assert.equal(Object.keys(metadata.entries).length, 3);
        assertEqualsStringValue(metadata.entries['name'], 'foo');
        assertEqualsNumberValue(metadata.entries['generation'], 123);

        assert.equal(Object.keys(labels.entries).length, 1);
        assertEqualsStringValue(labels.entries['hello'], 'world');
    });
    it('should give the correct key ranges for nested hierarchies', () => {
        const result = parser.parseJSON(nested)[0];
        const metadata = result.entries['metadata'].value;
        if (metadata.valueType !== 'map') {
            assert.fail('expected top level metadata item to be a map');
            return;
        }
        const labels = metadata.entries['labels'].value;
        if (labels.valueType !== 'map') {
            assert.fail('expected metadata.labels item to be a map');
            return;
        }

        assert.equal(metadata.entries['name'].keyRange.start, 64);  // NOTE: don't naively subtract column numbers - '\n' is two columns but only one character!
        assert.equal(metadata.entries['name'].keyRange.end, 70);
        assert.equal(metadata.entries['generation'].keyRange.start, 81);
        assert.equal(metadata.entries['generation'].keyRange.end, 93);
        assert.equal(metadata.entries['labels'].keyRange.start, 102);
        assert.equal(metadata.entries['labels'].keyRange.end, 110);
        assert.equal(labels.entries['hello'].keyRange.start, 118);
        assert.equal(labels.entries['hello'].keyRange.end, 125);
    });
    it('should give the correct value ranges for nested hierarchies', () => {
        const result = parser.parseJSON(nested)[0];
        const metadata = result.entries['metadata'].value;
        if (metadata.valueType !== 'map') {
            assert.fail('expected top level metadata item to be a map');
            return;
        }
        const labels = metadata.entries['labels'].value;
        if (labels.valueType !== 'map') {
            assert.fail('expected metadata.labels item to be a map');
            return;
        }

        assert.equal(range(metadata.entries['name'].value).start, 72);  // NOTE: don't naively subtract column numbers - '\n' is two columns but only one character!
        assert.equal(range(metadata.entries['name'].value).end, 77);
        assert.equal(range(metadata.entries['generation'].value).start, 95);
        assert.equal(range(metadata.entries['generation'].value).end, 98);
        assert.equal(range(labels.entries['hello'].value).start, 127);
        assert.equal(range(labels.entries['hello'].value).end, 134);
    });

    const arrayTestText = '{ "apiVersion": "apps/v1",\n"keywords": [\n  "foo",\n  123,\n  true ],\n"widgets": [\n { "name": "w1", "size": 1 },\n  { "name": "w2", "size": 2 } ] }';

    it('should represent arrays as, you know, arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        assert.equal(Object.keys(result.entries).length, 3);
        assert.equal(result.entries['keywords'].value.valueType, 'array');
        assert.equal(result.entries['widgets'].value.valueType, 'array');
    });
    it('should give the correct key range for arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        assert.equal(result.entries['keywords'].keyRange.start, 27);
        assert.equal(result.entries['keywords'].keyRange.end, 37);
        assert.equal(result.entries['widgets'].keyRange.start, 67);
        assert.equal(result.entries['widgets'].keyRange.end, 76);
    });
    it('should have the right number of entries in arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        const keywords = result.entries['keywords'].value;
        if (keywords.valueType !== 'array') {
            assert.fail('expected keywords item to be an array');
            return;
        }
        const widgets = result.entries['widgets'].value;
        if (widgets.valueType !== 'array') {
            assert.fail('expected widgets item to be an array');
            return;
        }
        assert.equal(keywords.items.length, 3);
        assert.equal(widgets.items.length, 2);
    });
    it('should give the correct entry values for scalar arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        const keywords = result.entries['keywords'].value;
        if (keywords.valueType !== 'array') {
            assert.fail('expected keywords item to be an array');
            return;
        }
        assertEqualsString(keywords.items[0], 'foo');
        assertEqualsNumber(keywords.items[1], 123);
        assertEqualsBoolean(keywords.items[2], true);
    });
    it('should give the correct entry range for scalar arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        const keywords = result.entries['keywords'].value;
        if (keywords.valueType !== 'array') {
            assert.fail('expected keywords item to be an array');
            return;
        }
        assert.equal(range(keywords.items[0]).start, 43);
        assert.equal(range(keywords.items[0]).end, 48);
        assert.equal(range(keywords.items[1]).start, 52);
        assert.equal(range(keywords.items[1]).end, 55);
        assert.equal(range(keywords.items[2]).start, 59);
        assert.equal(range(keywords.items[2]).end, 63);
    });
    it('should give the correct entry values for object arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        const widgets = result.entries['widgets'].value;
        if (widgets.valueType !== 'array') {
            assert.fail('expected widgets item to be an array');
            return;
        }
        assert.equal(widgets.items[0].valueType, 'map');
        assert.equal(widgets.items[1].valueType, 'map');
        const w1 = widgets.items[0] as parser.MapValue;
        const w2 = widgets.items[1] as parser.MapValue;
        assertEqualsStringValue(w1.entries['name'], 'w1');
        assertEqualsNumberValue(w1.entries['size'], 1);
        assertEqualsStringValue(w2.entries['name'], 'w2');
        assertEqualsNumberValue(w2.entries['size'], 2);
    });
    it('should give the correct entry range for object arrays', () => {
        const result = parser.parseJSON(arrayTestText)[0];
        const widgets = result.entries['widgets'].value;
        if (widgets.valueType !== 'array') {
            assert.fail('expected widgets item to be an array');
            return;
        }
        assert.equal(widgets.items[0].valueType, 'map');
        assert.equal(widgets.items[1].valueType, 'map');
        const w1 = widgets.items[0] as parser.MapValue;
        const w2 = widgets.items[1] as parser.MapValue;
        assert.equal(w1.entries['name'].keyRange.start, 83);
        assert.equal(w1.entries['name'].keyRange.end, 89);
        assert.equal(w1.entries['size'].keyRange.start, 97);
        assert.equal(w1.entries['size'].keyRange.end, 103);
        assert.equal(w2.entries['name'].keyRange.start, 114);
        assert.equal(w2.entries['name'].keyRange.end, 120);
        assert.equal(w2.entries['size'].keyRange.start, 128);
        assert.equal(w2.entries['size'].keyRange.end, 134);
    });

    // it('should return multiline data as strings', () => {
    //     const result = parser.parseYAML('foo: |\n  hello\n  world\nbar: quux')[0];
    //     assertEqualsStringValue(result.entries['foo'], 'hello\nworld\n');
    //     assertEqualsStringValue(result.entries['bar'], 'quux');
    // });

    // const badIdeaTestText = arrayTestText + '\nmetadata:\n  name: foo\n  generation: 123\n  labels:\n    hello: world';

    // it('can traverse in a weak-typed way', () => {
    //     const result = parser.parseYAML(badIdeaTestText)[0];
    //     const c = parser.asTraversable(result) as any;

    //     const apiVersion = c.child('apiVersion');
    //     assert.equal(apiVersion.exists(), true);
    //     assert.equal(apiVersion.value(), 'apps/v1');
    //     assert.equal(apiVersion.keyRange().start, 0);
    //     assert.equal(apiVersion.keyRange().end, 10);
    //     assert.equal(apiVersion.range().start, 12);
    //     assert.equal(apiVersion.range().end, 19);

    //     assert.equal(c.string('zzzzapiVersion').exists(), false);

    //     const kws = c.child('keywords');
    //     assert.equal(kws.exists(), true);
    //     assert.equal(kws.items().length, 3);
    //     assert.equal(kws.items()[1].type(), 'number');
    //     assert.equal(kws.string(0).value(), 'foo');
    //     assert.equal(kws.number(1).value(), 123);
    //     assert.equal(kws.boolean(2).value(), true);

    //     assert.equal(c.child('metadata').child('name').value(), 'foo');
    //     assert.equal(c.child('metadata').child('name').exists(), true);
    //     assert.equal(c.child('metadata').child('gnome').exists(), false);
    //     assert.equal(c.child('metadata').child('labels').child('hello').value(), 'world');
    //     assert.equal(c.child('metadata').child('labels').child('zzzzzzzzhello').exists(), false);

    //     assert.equal(c.child('metadata').map('labelles').string('hello').exists(), false);

    //     assert.equal(c.child('metadata').child('labels').child('hello').valid(), true);
    // });
    // it('can traverse in a weak-typed using native JS idioms', () => {
    //     const result = parser.parseYAML(badIdeaTestText)[0];
    //     const c = parser.asTraversable(result) as any;

    //     const apiVersion = c.apiVersion;
    //     assert.equal(apiVersion.exists(), true);
    //     assert.equal(apiVersion.value(), 'apps/v1');
    //     assert.equal(apiVersion.keyRange().start, 0);
    //     assert.equal(apiVersion.keyRange().end, 10);
    //     assert.equal(apiVersion.range().start, 12);
    //     assert.equal(apiVersion.range().end, 19);

    //     assert.equal(c['zzzzapiVersion'].exists(), false);

    //     const kws = c.keywords;
    //     assert.equal(kws.exists(), true);
    //     assert.equal(kws.items().length, 3);
    //     assert.equal(kws.items()[1].type(), 'number');
    //     assert.equal(kws[0].value(), 'foo');
    //     assert.equal(kws[1].value(), 123);
    //     assert.equal(kws[2].value(), true);

    //     assert.equal(c.metadata.name.value(), 'foo');
    //     assert.equal(c.metadata.name.exists(), true);
    //     assert.equal(c.metadata.gnome.exists(), false);
    //     assert.equal(c.metadata.labels.hello.value(), 'world');
    //     assert.equal(c.metadata.labels.zzzzzzzzhello.exists(), false);

    //     assert.equal(c.metadata.labelles.hello.exists(), false);

    //     assert.equal(c.metadata.labels.hello.valid(), true);
    // });

    // it('might not be a terrible idea either', () => {
    //     const result = parser.parseYAML(badIdeaTestText)[0];
    //     const c = parser.asTraversable(result);

    //     const apiVersion = c.string('apiVersion');
    //     assert.equal(apiVersion.exists(), true);
    //     assert.equal(apiVersion.value(), 'apps/v1');
    //     assert.equal(apiVersion.keyRange().start, 0);
    //     assert.equal(apiVersion.keyRange().end, 10);
    //     assert.equal(apiVersion.range().start, 12);
    //     assert.equal(apiVersion.range().end, 19);

    //     assert.equal(c.string('zzzzapiVersion').exists(), false);

    //     const kws = c.array('keywords');
    //     assert.equal(kws.exists(), true);
    //     assert.equal(kws.items().length, 3);
    //     assert.equal(kws.items()[1].type(), 'number');
    //     assert.equal(kws.string(0).value(), 'foo');
    //     assert.equal(kws.number(1).value(), 123);
    //     assert.equal(kws.boolean(2).value(), true);

    //     assert.equal(c.map('metadata').string('name').value(), 'foo');
    //     assert.equal(c.map('metadata').string('name').exists(), true);
    //     assert.equal(c.map('metadata').string('gnome').exists(), false);
    //     assert.equal(c.map('metadata').map('labels').string('hello').value(), 'world');
    //     assert.equal(c.map('metadata').map('labels').string('zzzzzzzzhello').exists(), false);

    //     assert.equal(c.map('metadata').map('labelles').string('hello').exists(), false);

    //     assert.equal(c.map('metadata').map('labels').string('hello').valid(), true);
    //     assert.equal(c.map('metadata').map('labels').number('hello').valid(), false);
    // });
    // it('might actually be coming together', () => {
    //     const result = parser.parseYAML(badIdeaTestText)[0];
    //     const c = parser.asTraversable(result);

    //     const kws = c.array('keywords');
    //     assert.equal(kws.string(0).rawText(), 'foo');
    //     assert.equal(kws.number(1).rawText(), '123');
    //     assert.equal(kws.boolean(2).rawText(), 'true');
    // });
    // it('can provide raw text and range even when it contains the wrong kind of data', () => {
    //     const result = parser.parseYAML(badIdeaTestText)[0];
    //     const c = parser.asTraversable(result);

    //     const kws = c.array('keywords');
    //     assert.equal(kws.number(0).rawText(), 'foo');
    //     assert.equal(kws.number(0).range().start, 32);
    //     assert.equal(kws.number(0).range().end, 35);
    // });
    // it('tells you what is wrong when your type expectations are not fulfilled', () => {
    //     const result = parser.parseYAML(badIdeaTestText)[0];
    //     const c = parser.asTraversable(result);

    //     assert.equal(c.array('metadata').type(), 'not-valid');
    //     assert.equal(c.array('zzzzzzz').type(), 'not-present');

    //     const md = c.map('metadata');
    //     assert.equal(md.number('name').type(), 'not-valid');
    //     assert.equal(md.number('zzzzzzz').type(), 'not-present');
    // });
});

function assertEqualsRawText(entry: parser.ResourceMapEntry, expected: string): void {
    assert.equal(['string', 'number', 'boolean'].includes(entry.value.valueType), true);
    assert.equal((entry.value as (parser.StringValue | parser.NumberValue | parser.BooleanValue)).rawText, expected);
}

function assertEqualsStringValue(entry: parser.ResourceMapEntry, expected: string): void {
    assert.equal(entry.value.valueType, 'string');
    assert.equal((entry.value as parser.StringValue).value, expected);
}

function assertEqualsNumberValue(entry: parser.ResourceMapEntry, expected: number): void {
    assert.equal(entry.value.valueType, 'number');
    assert.equal((entry.value as parser.NumberValue).value, expected);
}

function assertEqualsBooleanValue(entry: parser.ResourceMapEntry, expected: boolean): void {
    assert.equal(entry.value.valueType, 'boolean');
    assert.equal((entry.value as parser.BooleanValue).value, expected);
}

function assertEqualsString(value: parser.Value, expected: string): void {
    assert.equal(value.valueType, 'string');
    assert.equal((value as parser.StringValue).value, expected);
}

function assertEqualsNumber(value: parser.Value, expected: number): void {
    assert.equal(value.valueType, 'number');
    assert.equal((value as parser.NumberValue).value, expected);
}

function assertEqualsBoolean(value: parser.Value, expected: boolean): void {
    assert.equal(value.valueType, 'boolean');
    assert.equal((value as parser.BooleanValue).value, expected);
}

function range(value: parser.Value): parser.Range {
    switch (value.valueType) {
        case 'string':
        case 'number':
        case 'boolean':
            return value.range;
        default:
            assert.fail(`values of type ${value.valueType} do not have range info`);
            throw new Error(`values of type ${value.valueType} do not have range info`);
    }
}
