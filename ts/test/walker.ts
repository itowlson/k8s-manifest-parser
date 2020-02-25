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
            onNode: (_v: parser.Parented<parser.Value>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 8);
    });
    it('should notify on every string scalar', () => {
        let count = 0;
        const walker = {
            onString: (_v: parser.Parented<parser.StringValue>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 3);
    });
    it('should notify on every numeric scalar', () => {
        let count = 0;
        const walker = {
            onNumber: (_v: parser.Parented<parser.NumberValue>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 1);
    });
    it('should notify on every boolean scalar', () => {
        let count = 0;
        const walker = {
            onBoolean: (_v: parser.Parented<parser.BooleanValue>) => {
                ++count;
            }
        };
        parser.walk(test, walker);
        assert.equal(count, 2);
    });
    it('should notify on every map', () => {
        let count = 0;
        const walker = {
            onMap: (_v: parser.Parented<parser.MapValue>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 3);
    });
    it('should notify on every array', () => {
        let count = 0;
        const walker = {
            onArray: (_v: parser.Parented<parser.ArrayValue>) => {
                ++count;
            }
        };
        parser.walk(simple, walker);
        assert.equal(count, 1);
    });

    it('should be able to walk from a particular node', () => {
        let count = 0;
        const walker = {
            onString: (_v: parser.Parented<parser.StringValue>) => {
                ++count;
            }
        };
        parser.walkFrom(test, (parser.asTraversable(test) as any).spec.podTemplate.spec, walker);
        assert.equal(count, 2);
    });

    it('should provide ancestry information', () => {
        const images = Array.of<parser.Parented<parser.StringValue>>();
        const walker = {
            onString: (v: parser.Parented<parser.StringValue>) => {
                if (v.value.value.includes('image')) {
                    images.push(v);
                }
            }
        };
        parser.walk(test, walker);
        assert.equal(images.length, 2);

        assert.equal(images[0].value.value, 'someimage:123');
        assert.equal(images[0].ancestors.length, 6);
        assertMap(ancestorAt(images[0], 0), 'image');
        assertArray(ancestorAt(images[0], 1), 0);
        assertMap(ancestorAt(images[0], 2), 'containers');
        assertMap(ancestorAt(images[0], 3), 'spec');
        assertMap(ancestorAt(images[0], 4), 'podTemplate');
        assertMap(ancestorAt(images[0], 5), 'spec');

        assert.equal(images[1].value.value, 'someotherimage:456');
        assert.equal(images[1].ancestors.length, 6);
        assertArray(ancestorAt(images[1], 1), 1);
        assertMap(ancestorAt(images[1], 2), 'containers');
    });
});

function ancestorAt(entry: parser.Parented<parser.Value>, level: number): parser.Ancestor {
    return entry.ancestors[level];
}

function assertArray(entry: parser.Ancestor, expectedIndex: number): void {
    assert.equal(entry.kind, 'array');
    assert.equal((entry as parser.ArrayAncestor).index, expectedIndex);
}

function assertMap(entry: parser.Ancestor, expectedKey: string, expectedKeyRange?: parser.Range): void {
    assert.equal(entry.kind, 'map');
    assert.equal((entry as parser.MapAncestor).key, expectedKey);

    if (expectedKeyRange) {
        const actualKeyRange = (entry as parser.MapAncestor).keyRange;
        assert.equal(actualKeyRange.start, expectedKeyRange.start);
        assert.equal(actualKeyRange.end, expectedKeyRange.end);
    }
}
