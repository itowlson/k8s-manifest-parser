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
});
