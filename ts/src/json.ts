import * as yaml from './yaml';
import * as model from './model';

export function parseJSON(text: string): model.ResourceParse[] {
    const naiveParse = yaml.parseYAML(text);
    return naiveParse.map(dequote);
}

function dequote(source: model.ResourceParse): model.ResourceParse {
    return { entries: dequoteKeys(source.entries), range: source.range };
}

function dequoteKeys(source: { [key: string ]: model.ResourceMapEntry }): { [key: string ]: model.ResourceMapEntry } {
    const quotedKeys = Object.keys(source);
    const result: { [key: string ]: model.ResourceMapEntry } = {};
    for (const k of quotedKeys) {
        result[dequoteString(k)] = dequoteMapEntry(source[k]);
    }
    return result;
}

function dequoteMapEntry(source: model.ResourceMapEntry): model.ResourceMapEntry {
    return { key: source.key, keyRange: source.keyRange, range: source.range, value: dequoteValue(source.value) };
}

function dequoteValue(v: model.Value): model.Value {
    switch (v.valueType) {
        case 'string':
        case 'number':
        case 'boolean':
        case 'missing':
            return v;
        case 'array':
            return { valueType: 'array', items: v.items.map(dequoteValue), range: v.range };
        case 'map':
            return { valueType: 'map', entries: dequoteKeys(v.entries), range: v.range };
    }
}

function dequoteString(s: string): string {
    if ((s.startsWith('"') || s.startsWith("'")) && s.endsWith(s[0])) {
        return s.substr(1, s.length - 2);
    }
    return s;
}
