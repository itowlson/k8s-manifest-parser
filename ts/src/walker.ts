import * as model from './model';

export function walk(resource: model.ResourceParse, walker: ResourceWalker): void {
    walkImpl({ valueType: 'map', entries: resource.entries }, [], walker);
}

export interface MapAncestor {
    readonly kind: 'map';
    readonly map: model.MapValue;
    readonly key: string;
    readonly keyRange: model.Range;
}

export interface ArrayAncestor {
    readonly kind: 'array';
    readonly array: model.ArrayValue;
    readonly index: number;
}

export type Ancestor = MapAncestor | ArrayAncestor;

export interface Parented<T> {
    readonly value: T;
    readonly ancestors: ReadonlyArray<Ancestor>;
}

export interface ResourceWalker {
    onNode?: (value: Parented<model.Value>) => void;
    onString?: (value: Parented<model.StringValue>) => void;
    onNumber?: (value: Parented<model.NumberValue>) => void;
    onBoolean?: (value: Parented<model.BooleanValue>) => void;
    onArray?: (value: Parented<model.ArrayValue>) => void;
    onMap?: (value: Parented<model.MapValue>) => void;
}

function walkImpl(v: model.Value, ancestors: ReadonlyArray<Ancestor>, walker: ResourceWalker) {
    if (walker.onNode) {
        walker.onNode({ value: v, ancestors: ancestors });
    }
    switch (v.valueType) {
        case 'string':
            if (walker.onString) {
                walker.onString({ value: v, ancestors: ancestors });
            }
            break;
        case 'number':
            if (walker.onNumber) {
                walker.onNumber({ value: v, ancestors: ancestors });
            }
            break;
        case 'boolean':
            if (walker.onBoolean) {
                walker.onBoolean({ value: v, ancestors: ancestors });
            }
            break;
        case 'array':
            if (walker.onArray) {
                walker.onArray({ value: v, ancestors: ancestors });
            }
            for (const [index, item] of v.items.entries()) {
                walkImpl(item, [{ kind: 'array', array: v, index: index }, ...ancestors], walker);
            }
            break;
        case 'map':
            if (walker.onMap) {
                walker.onMap({ value: v, ancestors: ancestors });
            }
            for (const [key, child] of Object.entries(v.entries)) {
                walkImpl(child.value, [{ kind: 'map', map: v, key: key, keyRange: child.keyRange }, ...ancestors], walker);
            }
            break;
    }
}
