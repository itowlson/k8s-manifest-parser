import * as model from "./model";
import { parseYAML } from "./yaml";

export function parseHelmTemplate(text: string): model.ResourceParse[] {
    const yaml = text.replace(/{{[^}]*}}/g, (s) => encodeWithTemplateMarkers(s));
    const mutilatedParses = parseYAML(yaml);
    const parses = mutilatedParses.map((rp) => unmutilate(rp, text));
    return parses;
}

// These MUST be the same lengths as the strings they replace
// ('{{', '}}' and '"'") - we rely on the text ranges staying
// the same in order to detect and substitute back the actual
// template expression.
const ENCODE_TEMPLATE_START = 'AA';
const ENCODE_TEMPLATE_END = 'ZZ';
const ENCODE_TEMPLATE_QUOTE = 'Q';

// This is pretty horrible, but the YAML parser can't handle embedded Go template
// expressions.  So we transform Go template expressions to (reasonably) distinctive
// strings with the EXACT SAME position and length, run the YAML parser, then when we
// construct the Helm AST, if we see such a string we check back to the original YAML
// document to fix it up if necessary.
function encodeWithTemplateMarkers(s: string): string {
    return s.replace(/{{/g, ENCODE_TEMPLATE_START)
            .replace(/}}/g, ENCODE_TEMPLATE_END)
            .replace(/"/g, ENCODE_TEMPLATE_QUOTE);
}

function unmutilate(parse: model.ResourceParse, originalText: string): model.ResourceParse {
    return unmutilateMap({ valueType: 'map', entries: parse.entries, range: parse.range }, originalText);
}

function unmutilateNode(node: model.Value, originalText: string): model.Value {
    switch (node.valueType) {
        case 'string':
            return unmutilateString(node, originalText);
        case 'array':
            return unmutilateArray(node, originalText);
        case 'map':
            return unmutilateMap(node, originalText);
        case 'number':
        case 'boolean':
        case 'missing':
            return node;
    }
}

function unmutilateString(s: model.StringValue, originalText: string): model.StringValue {
    const originalValue = originalText.substring(s.range.start, s.range.end);
    return {
        valueType: 'string',
        range: s.range,
        rawText: originalValue,
        value: originalValue,
    };
}

function unmutilateArray(array: model.ArrayValue, originalText: string): model.ArrayValue {
    return { valueType: 'array', items: array.items.map((v) => unmutilateNode(v, originalText)), range: array.range };
}

function unmutilateMap(map: model.MapValue, originalText: string): model.MapValue {
    const entries: { [key: string]: model.ResourceMapEntry } = {};
    for (const [key, value] of Object.entries(map.entries)) {
        entries[key] = unmutilateResourceMapEntry(value, originalText);
    }
    return { valueType: 'map', entries: entries, range: map.range };
}

function unmutilateResourceMapEntry(entry: model.ResourceMapEntry, originalText: string): model.ResourceMapEntry {
    return { keyRange: entry.keyRange, value: unmutilateNode(entry.value, originalText) };
}
