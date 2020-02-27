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
    it('should support all scalar types at top level', () => {
        const result = parser.parseYAML('stringy: foo\ninty: 123\nfloaty: 4.5\nbooly: true')[0];
        assert.equal(Object.keys(result.entries).length, 4);
        assertEqualsStringValue(result.entries['stringy'], 'foo');
        assertEqualsNumberValue(result.entries['inty'], 123);
        assertEqualsNumberValue(result.entries['floaty'], 4.5);
        assertEqualsBooleanValue(result.entries['booly'], true);
    });
    it('should provide access to raw text', () => {
        const result = parser.parseYAML('stringy: foo\ninty: 123\nfloaty: 4.5\nbooly: true')[0];
        assert.equal(Object.keys(result.entries).length, 4);
        assertEqualsRawText(result.entries['stringy'], 'foo');
        assertEqualsRawText(result.entries['inty'], '123');
        assertEqualsRawText(result.entries['floaty'], '4.5');
        assertEqualsRawText(result.entries['booly'], 'true');
    });

    it('should represent nested entries as maps', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace\nmetadata:\n  name: foo\n  generation: 123\n  labels:\n    hello: world')[0];
        assert.equal(Object.keys(result.entries).length, 3);
        assert.equal(result.entries['apiVersion'].value.valueType, 'string');
        assert.equal(result.entries['kind'].value.valueType, 'string');
        assert.equal(result.entries['metadata'].value.valueType, 'map');
    });
    it('should represent nested hierarchies', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace\nmetadata:\n  name: foo\n  generation: 123\n  labels:\n    hello: world')[0];
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
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace\nmetadata:\n  name: foo\n  generation: 123\n  labels:\n    hello: world')[0];
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

        assert.equal(metadata.entries['name'].keyRange.start, 48);  // NOTE: don't naively subtract column numbers - '\n' is two columns but only one character!
        assert.equal(metadata.entries['name'].keyRange.end, 52);
        assert.equal(metadata.entries['generation'].keyRange.start, 60);
        assert.equal(metadata.entries['generation'].keyRange.end, 70);
        assert.equal(metadata.entries['labels'].keyRange.start, 78);
        assert.equal(metadata.entries['labels'].keyRange.end, 84);
        assert.equal(labels.entries['hello'].keyRange.start, 90);
        assert.equal(labels.entries['hello'].keyRange.end, 95);
    });
    it('should give the correct value ranges for nested hierarchies', () => {
        const result = parser.parseYAML('apiVersion: apps/v1\nkind: Namespace\nmetadata:\n  name: foo\n  generation: 123\n  labels:\n    hello: world')[0];
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

        assert.equal(range(metadata.entries['name'].value).start, 54);  // NOTE: don't naively subtract column numbers - '\n' is two columns but only one character!
        assert.equal(range(metadata.entries['name'].value).end, 57);
        assert.equal(range(metadata.entries['generation'].value).start, 72);
        assert.equal(range(metadata.entries['generation'].value).end, 75);
        assert.equal(range(labels.entries['hello'].value).start, 97);
        assert.equal(range(labels.entries['hello'].value).end, 102);
    });

    const arrayTestText = 'apiVersion: apps/v1\nkeywords:\n- foo\n- 123\n- true\nwidgets:\n- name: w1\n  size: 1\n- name: w2\n  size: 2';
    it('should represent arrays as, you know, arrays', () => {
        const result = parser.parseYAML(arrayTestText)[0];
        assert.equal(Object.keys(result.entries).length, 3);
        assert.equal(result.entries['keywords'].value.valueType, 'array');
        assert.equal(result.entries['widgets'].value.valueType, 'array');
    });
    it('should give the correct key range for arrays', () => {
        const result = parser.parseYAML(arrayTestText)[0];
        assert.equal(result.entries['keywords'].keyRange.start, 20);
        assert.equal(result.entries['keywords'].keyRange.end, 28);
        assert.equal(result.entries['widgets'].keyRange.start, 49);
        assert.equal(result.entries['widgets'].keyRange.end, 56);
    });
    it('should have the right number of entries in arrays', () => {
        const result = parser.parseYAML(arrayTestText)[0];
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
        const result = parser.parseYAML(arrayTestText)[0];
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
        const result = parser.parseYAML(arrayTestText)[0];
        const keywords = result.entries['keywords'].value;
        if (keywords.valueType !== 'array') {
            assert.fail('expected keywords item to be an array');
            return;
        }
        assert.equal(range(keywords.items[0]).start, 32);
        assert.equal(range(keywords.items[0]).end, 35);
        assert.equal(range(keywords.items[1]).start, 38);
        assert.equal(range(keywords.items[1]).end, 41);
        assert.equal(range(keywords.items[2]).start, 44);
        assert.equal(range(keywords.items[2]).end, 48);
    });
    it('should give the correct entry values for object arrays', () => {
        const result = parser.parseYAML(arrayTestText)[0];
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
        const result = parser.parseYAML(arrayTestText)[0];
        const widgets = result.entries['widgets'].value;
        if (widgets.valueType !== 'array') {
            assert.fail('expected widgets item to be an array');
            return;
        }
        assert.equal(widgets.items[0].valueType, 'map');
        assert.equal(widgets.items[1].valueType, 'map');
        const w1 = widgets.items[0] as parser.MapValue;
        const w2 = widgets.items[1] as parser.MapValue;
        assert.equal(w1.entries['name'].keyRange.start, 60);
        assert.equal(w1.entries['name'].keyRange.end, 64);
        assert.equal(w1.entries['size'].keyRange.start, 71);
        assert.equal(w1.entries['size'].keyRange.end, 75);
        assert.equal(w2.entries['name'].keyRange.start, 81);
        assert.equal(w2.entries['name'].keyRange.end, 85);
        assert.equal(w2.entries['size'].keyRange.start, 92);
        assert.equal(w2.entries['size'].keyRange.end, 96);
    });

    it('should return multiline data as strings', () => {
        const result = parser.parseYAML('foo: |\n  hello\n  world\nbar: quux')[0];
        assertEqualsStringValue(result.entries['foo'], 'hello\nworld\n');
        assertEqualsStringValue(result.entries['bar'], 'quux');
    });

    it('handles keys with no values', () => {
        const result = parser.parseYAML('naughty:\nnice:\n  test: 123')[0];
        assert.equal(result.entries['naughty'].value.valueType, 'missing');
        assert.equal(result.entries['nice'].value.valueType, 'map');
    });

    const helmTemplateText = `
apiVersion: v1
kind: Service
metadata:
  name: {{ template "nginx-lego.fullname" . }}-default-backend
  labels:
    chart: "{{ .Chart.Name }}-{{ .Chart.Version }}"
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: {{ template "nginx-lego.fullname" . }}-default-backend
`;

    it('should handle Helm template syntax', () => {
        const result = parser.parseHelmTemplate(helmTemplateText)[0];
        assertEqualsStringValue(result.entries['kind'], 'Service');

        const md = result.entries['metadata'].value as parser.MapValue;
        assertEqualsStringValue(md.entries['name'], '{{ template "nginx-lego.fullname" . }}-default-backend');

        const labels = md.entries['labels'].value as parser.MapValue;
        assertEqualsStringValue(labels.entries['chart'], '"{{ .Chart.Name }}-{{ .Chart.Version }}"');

        const chartTemplateTextRange = range(labels.entries['chart'].value);
        const chartTemplateTextExpectedIndex = helmTemplateText.indexOf('"{{ .Chart.Name }}-{{ .Chart.Version }}"');
        assert.equal(chartTemplateTextRange.start, chartTemplateTextExpectedIndex);
        assert.equal(chartTemplateTextRange.end, chartTemplateTextExpectedIndex + '"{{ .Chart.Name }}-{{ .Chart.Version }}"'.length);

        const spec = result.entries['spec'].value as parser.MapValue;
        assertEqualsStringValue(spec.entries['type'], 'ClusterIP');
        const ports = spec.entries['ports'].value as parser.ArrayValue;
        const ports0 = ports.items[0] as parser.MapValue;
        assertEqualsNumberValue(ports0.entries['port'], 80);
    });
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
