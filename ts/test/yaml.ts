import * as assert from 'assert';

import * as parser from '../src/index';

describe('YAML parser', () => {
    it('should handle a single resource', () => {
        const result = parser.parseYAML('hello: world');
        assert.equal(result.length, 1);
    });
    it('should handle multiple resources', () => {
        const result = parser.parseYAML('hello: world\n---\nhello-again: another-world');
        assert.equal(result.length, 2);
    });

    it('should represent top level entries', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace')[0];
        assert.equal(Object.keys(result.entries).length, 2);
        assert.notEqual(result.entries['apiVersion'], undefined);
        assert.notEqual(result.entries['kind'], undefined);
    });
});
