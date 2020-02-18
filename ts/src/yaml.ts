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
    const mappings = map.mappings;

    const mapParse: { [key: string]: model.ResourceMapEntry } = {};
    for (const m of mappings) {
        mapParse[m.key.rawValue] = {
            keyRange: { start: m.key.startPosition, end: m.key.endPosition },
            value: {
                valueType: 'string',
                value: (m.value as yp.YAMLScalar).value,
                range: { start: m.value.startPosition, end: m.value.endPosition }
            }
        };
    }
    return mapParse;
}
