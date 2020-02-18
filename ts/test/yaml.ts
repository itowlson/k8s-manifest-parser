import * as assert from 'assert';

import * as parser from '../src/index';
import { StringValue } from '../src/index';

describe('YAML parser', () => {
    it('should handle a single resource', () => {
        const result = parser.parseYAML('hello: world');
        assert.equal(result.length, 1);
    });
    it('should handle multiple resources', () => {
        const result = parser.parseYAML('hello: world\n---\nhello-again: another-world');
        assert.equal(result.length, 2);
    });

    it('should contain top level entries', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0];
        assert.equal(Object.keys(result.entries).length, 2);
        assert.notEqual(result.entries['apiVersion'], undefined);
        assert.notEqual(result.entries['kind'], undefined);
    });
    it('should have the ranges for top level keys', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0];
        assert.equal(result.entries['apiVersion'].keyRange.start, 0);
        assert.equal(result.entries['apiVersion'].keyRange.end, 10);
        assert.equal(result.entries['kind'].keyRange.start, 20);
        assert.equal(result.entries['kind'].keyRange.end, 24);
    });
    it('should have the values of top level scalars', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0];
        assertEqualsStringValue(result.entries['apiVersion'], 'apps/v1');
        assertEqualsStringValue(result.entries['kind'], 'Namespace');
    });
    it('should have the ranges for top level scalar values', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0];
        assert.equal(range(result.entries['apiVersion'].value).start, 12);
        assert.equal(range(result.entries['apiVersion'].value).end, 19);
        assert.equal(range(result.entries['kind'].value).start, 26);
        assert.equal(range(result.entries['kind'].value).end, 35);
    });
});

function assertEqualsStringValue(entry: parser.ResourceMapEntry, expected: string): void {
    assert.equal(entry.value.valueType, 'string');
    assert.equal((entry.value as StringValue).value, expected);
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
