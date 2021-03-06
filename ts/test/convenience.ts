import * as assert from 'assert';

import * as parser from '../src/index';

const testText = 'apiVersion: apps/v1\nkeywords:\n- foo\n- 123\n- true\nwidgets:\n- name: w1\n  size: 1\n- name: w2\n  size: 2\nmetadata:\n  name: foo\n  generation: 123\n  labels:\n    hello: world';
const parse = parser.parseYAML(testText)[0];

describe('mostly-type-safe convenience layer', () => {
    const doc = parser.asTraversable(parse);

    it('surfaces top-level entries in a compact way', () => {
        const apiVersion = doc.string('apiVersion');
        assert.equal(apiVersion.exists(), true);
        assert.equal(apiVersion.value(), 'apps/v1');
        assert.equal(apiVersion.keyRange().start, 0);
        assert.equal(apiVersion.keyRange().end, 10);
        assert.equal(apiVersion.range().start, 12);
        assert.equal(apiVersion.range().end, 19);
    });
    it('surfaces array entries in a compact way', () => {
        const kws = doc.array('keywords');
        assert.equal(kws.exists(), true);
        assert.equal(kws.items().length, 3);
        assert.equal(kws.items()[1].type(), 'number');
        assert.equal(kws.string(0).value(), 'foo');
        assert.equal(kws.number(1).value(), 123);
        assert.equal(kws.boolean(2).value(), true);
    });
    it('surfaces map entries in a compact way', () => {
        const md = doc.map('metadata');
        assert.equal(md.string('name').value(), 'foo');
        assert.equal(md.string('name').exists(), true);
        assert.equal(md.string('gnome').exists(), false);
        assert.equal(md.map('labels').string('hello').value(), 'world');
    });

    it('tells you when things do not exist', () => {
        assert.equal(doc.string('zzzzapiVersion').exists(), false);
    });
    it('tells you when array entries do not exist', () => {
        const kws = doc.array('keywords');
        assert.equal(kws.string(1).exists(), true);
        assert.equal(kws.string(10).exists(), false);
    });
    it('tells you when map entries do not exist', () => {
        const md = doc.map('metadata');
        assert.equal(md.map('labels').string('zzzzzzzzhello').exists(), false);
    });
    it('handles when you navigate through something that does not exist', () => {
        const md = doc.map('metadata');
        assert.equal(md.map('labelles').string('hello').exists(), false);
    });
    it('tells you when things are not of the expected type', () => {
        const md = doc.map('metadata');
        assert.equal(md.map('labels').string('hello').valid(), true);
        assert.equal(md.map('labels').number('hello').valid(), false);
    });

    it('provides raw text of scalars', () => {
        const kws = doc.array('keywords');
        assert.equal(kws.string(0).rawText(), 'foo');
        assert.equal(kws.number(1).rawText(), '123');
        assert.equal(kws.boolean(2).rawText(), 'true');
    });
    it('can provide raw text and range even when it contains the wrong kind of data', () => {
        const kws = doc.array('keywords');
        assert.equal(kws.number(0).rawText(), 'foo');
        assert.equal(kws.number(0).range().start, 32);
        assert.equal(kws.number(0).range().end, 35);
    });
    it('tells you what is wrong when your type expectations are not fulfilled', () => {
        assert.equal(doc.array('metadata').type(), 'not-valid');
        assert.equal(doc.array('zzzzzzz').type(), 'not-present');

        const md = doc.map('metadata');
        assert.equal(md.number('name').type(), 'not-valid');
        assert.equal(md.number('zzzzzzz').type(), 'not-present');
    });

    it('handles keys with no values', () => {
        const result = parser.asTraversable(parser.parseYAML('naughty:\nnice:\n  test: 123')[0]);
        assert.equal(result.child('naughty').exists(), false);
        assert.equal(result.child('naughty').type(), 'not-present');
    });

    const arrayTestText = 'homogeneous:\n- image: im1\n  policy: AlwaysPull\n- image: im2\n  policy: PullIfMissing\nheterogeneous:\n- image: im3\n- astring\n- 1234';

    it('supports homogeneous arrays', () => {
        const result = parser.asTraversable(parser.parseYAML(arrayTestText)[0]);
        const array = result.array('homogeneous');
        assert.equal(array.exists(), true);
        assert.equal(array.valid(), true);
        const arrayElements = array.maps();
        assert.equal(arrayElements.length, 2);
        assert.equal(arrayElements[0].valid(), true);
        assert.equal(arrayElements[0].string('image').value(), 'im1');
        assert.equal(arrayElements[1].valid(), true);
        assert.equal(arrayElements[1].string('image').value(), 'im2');
    });
    it('handles heterogeneous arrays', () => {
        const result = parser.asTraversable(parser.parseYAML(arrayTestText)[0]);
        const array = result.array('heterogeneous');
        assert.equal(array.exists(), true);
        assert.equal(array.valid(), true);

        const arrayAsStrings = array.strings();
        const arrayAsNumbers = array.numbers();

        assert.equal(arrayAsStrings.length, 3);
        assert.equal(arrayAsStrings[0].valid(), false);
        assert.equal(arrayAsStrings[1].valid(), true);
        assert.equal(arrayAsStrings[2].valid(), false);
        assert.equal(arrayAsStrings[1].value(), 'astring');

        assert.equal(arrayAsNumbers.length, 3);
        assert.equal(arrayAsNumbers[0].valid(), false);
        assert.equal(arrayAsNumbers[1].valid(), false);
        assert.equal(arrayAsNumbers[2].valid(), true);
        assert.equal(arrayAsNumbers[2].value(), 1234);
    });

    const rangeTestText = 'str1: s1\nmap1:\n  map11:\n    foo: 123\n    bar: 456\nmap2:\n  baz: 789\narr:\n- a\n- b\n- m:\n    am1: 987';
    const rangeTest1WithMissingText = 'api: s1\nspec:\n  containers:\n  - image: i1\n    resources:\n    moar: something';
    const rangeTest2WithMissingText = 'api: s1\nspec:\n  containers:\n  - image: i1\n    resources:\n      limits:\n        # memory: 1';

    it('can give out a highlight range for nonexistent nodes', () => {
        const resource = parser.parseYAML(rangeTestText)[0];
        const result = parser.asTraversable(resource);

        assertHighlightRangeIs(result.child('str1'), 6, 8);  // because this is the value range not the key range

        assertHighlightRangeIs(result.child('wibble'), 0, 97);  // TODO: maybe the default should be the first entry in the file or something
        assertHighlightRangeIs(result.map('wibble').child('wobble'), 0, 97);

        assertHighlightRangeIs(result.map('map1').map('nope'), 9, 13);
        assertHighlightRangeIs(result.map('map1').map('nope').string('nope2'), 9, 13);
        assertHighlightRangeIs(result.map('map1').map('map11'), 28, 49);  // TODO: I feel this is inconsistent - nonexistent children of this would report the key range not the node itself
        assertHighlightRangeIs(result.map('map1').map('map11').string('nope2'), 17, 22);

        assertHighlightRangeIs(result.array('arr').string(0), 74, 75);
        assertHighlightRangeIs(result.array('arr').number(0), 74, 75);
        assertHighlightRangeIs(result.array('arr').map(0).child('nope'), 74, 75);
        assertHighlightRangeIs(result.array('arr').map(2).child('nope'), 72, 98);  // TODO: again feels like 'nonexistent child of existent map' is blowing up the wrong thing - this is the whole array  // TODO: why 98 rather than 97?!
    });
    it('can give out a highlight range for nonexistent nodes under nodes with missing values', () => {
        const resource = parser.parseYAML(rangeTest1WithMissingText)[0];
        const result = parser.asTraversable(resource);

        const underMissing = result.map('spec').array('containers').map(0).map('resources').map('limits').child('memory');
        //                                                                                       ^^ this is where it ceases to exist
        //                                                                      ^^ this exists but its value is missing; it should still be the range

        assertHighlightRangeIs(underMissing, 46, 55);
    });
    it('can give out a highlight range for nodes with missing values', () => {
        const resource = parser.parseYAML(rangeTest2WithMissingText)[0];
        const result = parser.asTraversable(resource);

        const missingValue = result.map('spec').array('containers').map(0).map('resources').map('limits');
        //                                                                                       ^^ this exists but its value is missing; it should still be the range

        assertHighlightRangeIs(missingValue, 63, 69);
    });
});

describe('the typed-but-only-weakly convenience layer', () => {
    const doc = parser.asTraversable(parse) as any;

    // TODO: This is mostly exercised via the JS-style direct accessors but should
    // probably break apart the test at some point anyway!
    it('can traverse in a weak-typed way', () => {
        const apiVersion = doc.child('apiVersion');
        assert.equal(apiVersion.exists(), true);
        assert.equal(apiVersion.value(), 'apps/v1');
        assert.equal(apiVersion.keyRange().start, 0);
        assert.equal(apiVersion.keyRange().end, 10);
        assert.equal(apiVersion.range().start, 12);
        assert.equal(apiVersion.range().end, 19);

        assert.equal(doc.child('zzzzapiVersion').exists(), false);

        const kws = doc.child('keywords');
        assert.equal(kws.exists(), true);
        assert.equal(kws.items().length, 3);
        assert.equal(kws.items()[1].type(), 'number');
        assert.equal(kws.string(0).value(), 'foo');
        assert.equal(kws.number(1).value(), 123);
        assert.equal(kws.boolean(2).value(), true);

        const md = doc.child('metadata');
        assert.equal(md.child('name').value(), 'foo');
        assert.equal(md.child('name').exists(), true);
        assert.equal(md.child('gnome').exists(), false);
        assert.equal(md.child('labels').child('hello').value(), 'world');
        assert.equal(md.child('labels').child('zzzzzzzzhello').exists(), false);

        assert.equal(md.map('labelles').string('hello').exists(), false);

        assert.equal(md.child('labels').child('hello').valid(), true);
    });
});

describe('terse JavaScript-ish convenience layer', () => {
    const doc = parser.asTraversable(parse) as any;

    it('can access top-level entries directly as properties', () => {
        const apiVersion = doc.apiVersion;
        assert.equal(apiVersion.exists(), true);
        assert.equal(apiVersion.value(), 'apps/v1');
        assert.equal(apiVersion.keyRange().start, 0);
        assert.equal(apiVersion.keyRange().end, 10);
        assert.equal(apiVersion.range().start, 12);
        assert.equal(apiVersion.range().end, 19);
    });
    it('can tell you if a top-level entry does not exist', () => {
        assert.equal(doc['zzzzapiVersion'].exists(), false);
        assert.equal(doc.zzzzapiVersion.exists(), false);
    });
    it('can access array entries using index syntax', () => {
        const kws = doc.keywords;
        assert.equal(kws.exists(), true);
        assert.equal(kws.items().length, 3);
        assert.equal(kws.items()[1].type(), 'number');
        assert.equal(kws[0].value(), 'foo');
        assert.equal(kws[1].value(), 123);
        assert.equal(kws[2].value(), true);
    });
    it('can tell you if array entries accessed via index syntax exist', () => {
        const kws = doc.keywords;
        assert.equal(kws[0].exists(), true);
        assert.equal(kws[100].exists(), false);
    });
    it('can access map entries using property syntax', () => {
        const md = doc.metadata;
        assert.equal(md.name.value(), 'foo');
        assert.equal(md.labels.hello.value(), 'world');
    });
    it('can tell you if map entries accessed via property syntax exist', () => {
        const md = doc.metadata;
        assert.equal(md.name.exists(), true);
        assert.equal(md.gnome.exists(), false);
        assert.equal(md.labels.zzzzzzzzhello.exists(), false);
        assert.equal(md.labels.hello.valid(), true);
    });
    it('can use property syntax to traverse through something that does not exist', () => {
        assert.equal(doc.metadata.labelles.hello.exists(), false);
    });
});

function assertHighlightRangeIs(entry: parser.TraversalEntry, start: number, end: number) {
    assert.equal(parser.highlightRange(entry)?.start, start);
    assert.equal(parser.highlightRange(entry)?.end, end);
}
