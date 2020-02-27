import * as assert from 'assert';

import * as parser from '../src/index';

/*
map
|- string
|- map
|  |- map
|     |- string
|- array
   |- string
   |- string
*/
const simpleText = `apiVersion: apps/v1
metadata:
  labels:
    wizz: bang
containers:
  - cont1
  - 123
`;

const testText = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: foo
  namespace: bar
  labels:
    wizz: bang
  generation: 123
spec:
  podTemplate:
    spec:
      containers:
      - image: someimage:123
        alwaysPull: true
      - image: someotherimage:456
        alwaysPull: false
        pullFrequency: 74
    resources:
      limits:
        cpu: 50
        memory: 128
status:
  good: verygood
`;

const simple = parser.parseYAML(simpleText)[0];
const test = parser.parseYAML(testText)[0];

describe('AST walker', () => {
    it('should notify on every node', () => {
        let count = 0;
        const walker = {
            onNode: (_v: parser.Value, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 8);
    });
    it('should notify on every string scalar', () => {
        let count = 0;
        const walker = {
            onString: (_v: parser.StringValue, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 3);
    });
    it('should notify on every numeric scalar', () => {
        let count = 0;
        const walker = {
            onNumber: (_v: parser.NumberValue, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 1);
    });
    it('should notify on every boolean scalar', () => {
        let count = 0;
        const walker = {
            onBoolean: (_v: parser.BooleanValue, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walk(test, walker);
        assert.equal(count, 2);
    });
    it('should notify on every map', () => {
        let count = 0;
        const walker = {
            onMap: (_v: parser.MapValue, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 3);
    });
    it('should notify on every array', () => {
        let count = 0;
        const walker = {
            onArray: (_v: parser.ArrayValue, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 1);
    });

    it('should be able to walk from a particular node', () => {
        let count = 0;
        const walker = {
            onString: (_v: parser.StringValue, _a: ReadonlyArray<parser.Ancestor>) => {
                ++count;
            }
        };
        parser.walkFrom(test, (parser.asTraversable(test) as any).spec.podTemplate.spec, walker);
        assert.equal(count, 2);
    });

    it('should provide ancestry information', () => {
        const images = Array.of<[parser.StringValue, ReadonlyArray<parser.Ancestor>]>();
        const walker = {
            onString: (v: parser.StringValue, a: ReadonlyArray<parser.Ancestor>) => {
                if (v.value.includes('image')) {
                    images.push([v, a]);
                }
            }
        };
        parser.walk(test, walker);
        assert.equal(images.length, 2);

        const [str0, anc0] = images[0];
        assert.equal(str0.value, 'someimage:123');
        assert.equal(anc0.length, 6);
        assertMap(ancestorAt(anc0, 0), 'image');
        assertArray(ancestorAt(anc0, 1), 0);
        assertMap(ancestorAt(anc0, 2), 'containers', { start: testText.indexOf('containers'), end: testText.indexOf('containers') + 10 });
        assertMap(ancestorAt(anc0, 3), 'spec');
        assertMap(ancestorAt(anc0, 4), 'podTemplate', { start: testText.indexOf('podTemplate'), end: testText.indexOf('podTemplate') + 11 });
        assertMap(ancestorAt(anc0, 5), 'spec', { start: testText.indexOf('spec'), end: testText.indexOf('spec') + 4 });

        const [str1, anc1] = images[1];
        assert.equal(str1.value, 'someotherimage:456');
        assert.equal(anc1.length, 6);
        assertArray(ancestorAt(anc1, 1), 1);
        assertMap(ancestorAt(anc1, 2), 'containers');
    });
    it('should provide ancestry information even when looking only below a node', () => {
        const images = Array.of<[parser.StringValue, ReadonlyArray<parser.Ancestor>]>();
        const walker = {
            onString: (v: parser.StringValue, a: ReadonlyArray<parser.Ancestor>) => {
                if (v.value.includes('image')) {
                    images.push([v, a]);
                }
            }
        };
        parser.walkFrom(test, (parser.asTraversable(test) as any).spec.podTemplate.spec, walker);
        assert.equal(images.length, 2);

        const [str0, anc0] = images[0];
        assert.equal(str0.value, 'someimage:123');
        assert.equal(anc0.length, 6);
        assertMap(ancestorAt(anc0, 0), 'image');
        assertArray(ancestorAt(anc0, 1), 0);
        assertMap(ancestorAt(anc0, 2), 'containers');
        assertMap(ancestorAt(anc0, 3), 'spec');
        assertMap(ancestorAt(anc0, 4), 'podTemplate');
        assertMap(ancestorAt(anc0, 5), 'spec');

        const [str1, anc1] = images[1];
        assert.equal(str1.value, 'someotherimage:456');
        assert.equal(anc1.length, 6);
        assertArray(ancestorAt(anc1, 1), 1);
        assertMap(ancestorAt(anc1, 2), 'containers');
    });
});

function ancestorAt(ancestors: ReadonlyArray<parser.Ancestor>, level: number): parser.Ancestor {
    return ancestors[level];
}

function assertArray(entry: parser.Ancestor, expectedIndex: number): void {
    assert.equal(entry.kind, 'array');
    assert.equal(entry.at, expectedIndex);
}

function assertMap(entry: parser.Ancestor, expectedKey: string, expectedKeyRange?: parser.Range): void {
    assert.equal(entry.kind, 'map');
    assert.equal(entry.at, expectedKey);

    if (expectedKeyRange) {
        const actualKeyRange = (entry as parser.MapAncestor).keyRange;
        assert.equal(actualKeyRange.start, expectedKeyRange.start);
        assert.equal(actualKeyRange.end, expectedKeyRange.end);
    }
}
