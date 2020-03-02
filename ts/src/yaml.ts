import * as yp from 'yaml-ast-parser';

import * as model from './model';

export function parseYAML(text: string): model.ResourceParse[] {
    const roots = rootNodes(text);
    return roots.map(parseRootNode);
}

function rootNodes(yamlText: string): yp.YAMLNode[] {
    const roots = Array.of<yp.YAMLNode>();
    yp.safeLoadAll(yamlText, (d) => roots.push(d));
    return roots;
}

function parseRootNode(rootNode: yp.YAMLNode): model.ResourceParse {
    const range = { start: rootNode.startPosition, end: rootNode.endPosition };

    if (rootNode.kind !== yp.Kind.MAP) {
        return { entries: {}, range };
    }

    const map = rootNode as yp.YamlMap;

    return { entries: parseMappings(map), range };
}

function parseMappings(map: yp.YamlMap): { [key: string]: model.ResourceMapEntry; } {
    const mapParse: { [key: string]: model.ResourceMapEntry; } = {};
    parseMappingsInto(map.mappings, mapParse);
    return mapParse;
}

function parseMappingsInto(mappings: yp.YAMLMapping[], mapParse: { [key: string]: model.ResourceMapEntry; }) {
    for (const m of mappings) {
        const value = parseNode(m.value);
        mapParse[m.key.rawValue] = {
            keyRange: { start: m.key.startPosition, end: m.key.endPosition },
            value: value
        };
    }
}

function parseNode(node: yp.YAMLNode | null | undefined): model.Value {
    if (!node) {
        return { valueType: 'missing', range: { start: 0, end: 0 } };
    }
    const range = { start: node.startPosition, end: node.endPosition };
    switch (node.kind) {
        case yp.Kind.SCALAR:
            const value = parseScalarValue(node as yp.YAMLScalar);
            return { range, ...value };
        case yp.Kind.MAP:
            const mapValue = parseMapValue(node as yp.YamlMap);
            return { range, ...mapValue };
        case yp.Kind.SEQ:
            const seqValue = parseSequenceValue(node as yp.YAMLSequence);
            return { range, ...seqValue };
        default:
            throw new Error('unexpected node kind');
    }
}

function parseScalarValue(node: yp.YAMLScalar): Rangeless<model.StringValue> | Rangeless<model.NumberValue> | Rangeless<model.BooleanValue> {
    const scalarType = yp.determineScalarType(node);
    switch (scalarType) {
        case yp.ScalarType.bool:
            return { valueType: 'boolean', rawText: node.value, value: yp.parseYamlBoolean(node.value) };
        case yp.ScalarType.float:
            return { valueType: 'number', rawText: node.value, value: yp.parseYamlFloat(node.value) };
        case yp.ScalarType.int:
            return { valueType: 'number', rawText: node.value, value: yp.parseYamlInteger(node.value) };
        default:
            return { valueType: 'string', rawText: node.value, value: node.value };
    }
}

function parseMapValue(node: yp.YamlMap): Rangeless<model.MapValue> {
    return {
        valueType: 'map',
        entries: parseMappings(node),
    };
}

function parseSequenceValue(node: yp.YAMLSequence): Rangeless<model.ArrayValue> {
    const items = node.items;
    const values = items.map((item) => parseNode(item));
    return {
        valueType: 'array',
        items: values
    };
}

type Rangeless<T> = Omit<T, 'range'>;
