import * as assert from 'assert';

import * as parser from '../src/index';

describe('YAML parser', () => {
    it('should support kind checking', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0];
        assert.equal(parser.isKind(result, 'Namespace'), true);
        assert.equal(parser.isKind(result, 'Gnomespace'), false);
        assert.equal(parser.isKind(result, 'Namespace', 'apps/v1'), true);
        assert.equal(parser.isKind(result, 'Namespace', 'gnomes/v1'), false);
    });
    it('should allow kind checking even if kind is missing', () => {
        const result = parser.parseYAML('notanapiVersion: apps/v1\nnotakind: Namespace')[0];
        assert.equal(parser.isKind(result, 'Namespace'), false);
        assert.equal(parser.isKind(result, 'Namespace', 'apps/v1'), false);
    });
});

describe('JSON parser', () => {
    it('should support kind checking', () => {
        const result = parser.parseJSON('{ "apiVersion": "apps/v1", "kind": "Namespace" }')[0];
        assert.equal(parser.isKind(result, 'Namespace'), true);
        assert.equal(parser.isKind(result, 'Gnomespace'), false);
        assert.equal(parser.isKind(result, 'Namespace', 'apps/v1'), true);
        assert.equal(parser.isKind(result, 'Namespace', 'gnomes/v1'), false);
    });
    it('should allow kind checking even if kind is missing', () => {
        const result = parser.parseJSON('{ "notanapiVersion": "apps/v1", "notakind": "Namespace" }')[0];
        assert.equal(parser.isKind(result, 'Namespace'), false);
        assert.equal(parser.isKind(result, 'Namespace', 'apps/v1'), false);
    });
});

describe('convenience layer', () => {
    it('should support kind checking', () => {
        const result = parser.asTraversable(parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0]);
        assert.equal(parser.isKind(result, 'Namespace'), true);
        assert.equal(parser.isKind(result, 'Gnomespace'), false);
        assert.equal(parser.isKind(result, 'Namespace', 'apps/v1'), true);
        assert.equal(parser.isKind(result, 'Namespace', 'gnomes/v1'), false);
    });
    it('should allow kind checking even if kind is missing', () => {
        const result = parser.asTraversable(parser.parseYAML('notanapiVersion: apps/v1\nnotakind: Namespace')[0]);
        assert.equal(parser.isKind(result, 'Namespace'), false);
        assert.equal(parser.isKind(result, 'Namespace', 'apps/v1'), false);
    });
});
