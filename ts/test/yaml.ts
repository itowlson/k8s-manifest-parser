import * as assert from 'assert';

import * as parser from '../src/index';

describe('YAML parser', () => {
    it('should handle a single resource', () => {
        const result = parser.parseYAML('hello: world');
        assert.equal(1, result.length);
    });
    it('should handle multiple resources', () => {
        const result = parser.parseYAML('hello: world\n---\nhello-again: another-world');
        assert.equal(2, result.length);
    });
});
