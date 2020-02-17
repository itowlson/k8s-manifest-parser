import * as assert from 'assert';

import * as testee from '../src/index';

describe('just scaffolding', () => {
    it('should work', () => {
        const result = testee.hello();
        assert.equal('world', result);
    });
});
