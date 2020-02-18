import * as yp from 'yaml-ast-parser';

import * as model from './model';

export function parseYAML(text: string): model.ResourceParse[] {
    const roots = rootNodes(text);
    return roots.map((r) => ({ entries: parseRootNode(r) }));
}

function rootNodes(yamlText: string): yp.YAMLNode[] {
    const roots = Array.of<yp.YAMLNode>();
    yp.safeLoadAll(yamlText, (d) => roots.push(d));
    return roots;
}

function parseRootNode(rootNode: yp.YAMLNode): { [key: string]: model.ResourceMapEntry } {
    if (rootNode.kind !== yp.Kind.MAP) {
        return {};
    }

    const map = rootNode as yp.YamlMap;

    return parseMappings(map);
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

function parseNode(node: yp.YAMLNode): model.Value {
    switch (node.kind) {
        case yp.Kind.SCALAR:
            const value = parseScalarValue(node as yp.YAMLScalar);
            return {
                range: { start: node.startPosition, end: node.endPosition },
                ...value
            };
        case yp.Kind.MAP:
            return parseMapValue(node as yp.YamlMap);
        default:
            throw new Error('unexpected node kind');
    }
}

function parseScalarValue(node: yp.YAMLScalar): Rangeless<model.StringValue> | Rangeless<model.NumberValue> | Rangeless<model.BooleanValue> {
    const scalarType = yp.determineScalarType(node);
    switch (scalarType) {
        case yp.ScalarType.bool:
            return { valueType: 'boolean', value: yp.parseYamlBoolean(node.value) };
        case yp.ScalarType.float:
            return { valueType: 'number', value: yp.parseYamlFloat(node.value) };
        case yp.ScalarType.int:
            return { valueType: 'number', value: yp.parseYamlInteger(node.value) };
        default:
            return { valueType: 'string', value: node.value };
    }
}

function parseMapValue(node: yp.YamlMap): Rangeless<model.MapValue> {
    return {
        valueType: 'map',
        entries: parseMappings(node)
    };
}

type Rangeless<T> = Omit<T, 'range'>;
