import * as model from './model';
import * as traversal from './convenience';

export function walk(resource: model.ResourceParse, walker: ResourceWalker): void {
    evaluate(resource, evalise(walker));
}

export function walkFromValue(resource: model.ResourceParse, from: model.Value, walker: ResourceWalker): void {
    evaluateFromValue(resource, from, evalise(walker));
}

export function walkFrom(resource: model.ResourceParse, from: traversal.TraversalEntry, walker: ResourceWalker): void {
    evaluateFrom(resource, from, evalise(walker));
}

export function evaluate<T>(resource: model.ResourceParse | model.ResourceParse[], evaluator: ResourceEvaluator<T>): T[] {
    if (Array.isArray(resource)) {
        const results = resource.map((r) => evaluate(r, evaluator));
        return Array.of<T>().concat(...results);
    }
    return evaluateImpl({ valueType: 'map', entries: resource.entries }, [], evaluator);
}

export function evaluateFromValue<T>(resource: model.ResourceParse, from: model.Value, evaluator: ResourceEvaluator<T>): T[] {
    const ignoreAboveWalker = {
        onNode: function* (v: model.Value, a: ReadonlyArray<Ancestor>) {
            if (v === from) {
                yield* evaluateImpl(from, a, evaluator);
            }
        }
    };
    return evaluate(resource, ignoreAboveWalker);
}

export function evaluateFrom<T>(resource: model.ResourceParse, from: traversal.TraversalEntry, evaluator: ResourceEvaluator<T>): T[] {
    const fromValue = from.parseNode();
    if (!fromValue) {
        return [];
    }
    return evaluateFromValue(resource, fromValue, evaluator);
}

export interface MapAncestor {
    readonly kind: 'map';
    readonly value: model.MapValue;
    readonly at: string;
    readonly keyRange: model.Range;
}

export interface ArrayAncestor {
    readonly kind: 'array';
    readonly value: model.ArrayValue;
    readonly at: number;
}

export type Ancestor = MapAncestor | ArrayAncestor;

export interface ResourceWalker {
    onNode?: (value: model.Value, ancestors: ReadonlyArray<Ancestor>) => void;
    onString?: (value: model.StringValue, ancestors: ReadonlyArray<Ancestor>) => void;
    onNumber?: (value: model.NumberValue, ancestors: ReadonlyArray<Ancestor>) => void;
    onBoolean?: (value: model.BooleanValue, ancestors: ReadonlyArray<Ancestor>) => void;
    onArray?: (value: model.ArrayValue, ancestors: ReadonlyArray<Ancestor>) => void;
    onMap?: (value: model.MapValue, ancestors: ReadonlyArray<Ancestor>) => void;
}

export interface ResourceEvaluator<T> {
    onNode?: (value: model.Value, ancestors: ReadonlyArray<Ancestor>) => IterableIterator<T>;
    onString?: (value: model.StringValue, ancestors: ReadonlyArray<Ancestor>) => IterableIterator<T>;
    onNumber?: (value: model.NumberValue, ancestors: ReadonlyArray<Ancestor>) => IterableIterator<T>;
    onBoolean?: (value: model.BooleanValue, ancestors: ReadonlyArray<Ancestor>) => IterableIterator<T>;
    onArray?: (value: model.ArrayValue, ancestors: ReadonlyArray<Ancestor>) => IterableIterator<T>;
    onMap?: (value: model.MapValue, ancestors: ReadonlyArray<Ancestor>) => IterableIterator<T>;
}

function evalise(walker: ResourceWalker): ResourceEvaluator<undefined> {
    const { onNode, onString, onNumber, onBoolean, onArray, onMap } = walker; // need to deconstruct for definiteness reasoning in lambdas
    return {
        onNode: function* (v, a) { if (onNode) onNode(v, a); },
        onString: function* (v, a) { if (onString) onString(v, a); },
        onNumber: function* (v, a) { if (onNumber) onNumber(v, a); },
        onBoolean: function* (v, a) { if (onBoolean) onBoolean(v, a); },
        onArray: function* (v, a) { if (onArray) onArray(v, a); },
        onMap: function* (v, a) { if (onMap) onMap(v, a); },
    };
}

function evaluateImpl<T>(v: model.Value, ancestors: ReadonlyArray<Ancestor>, evaluator: ResourceEvaluator<T>): T[] {
    return [...evaluateImplCore(v, ancestors, evaluator)];
}

function* evaluateImplCore<T>(v: model.Value, ancestors: ReadonlyArray<Ancestor>, evaluator: ResourceEvaluator<T>): IterableIterator<T> {
    if (evaluator.onNode) {
        yield* evaluator.onNode(v, ancestors);
    }
    switch (v.valueType) {
        case 'string':
            if (evaluator.onString) {
                yield* evaluator.onString(v, ancestors);
            }
            break;
        case 'number':
            if (evaluator.onNumber) {
                yield* evaluator.onNumber(v, ancestors);
            }
            break;
        case 'boolean':
            if (evaluator.onBoolean) {
                yield* evaluator.onBoolean(v, ancestors);
            }
            break;
        case 'array':
            if (evaluator.onArray) {
                yield* evaluator.onArray(v, ancestors);
            }
            for (const [index, item] of v.items.entries()) {
                yield* evaluateImplCore(item, [{ kind: 'array', value: v, at: index }, ...ancestors], evaluator);
            }
            break;
        case 'map':
            if (evaluator.onMap) {
                yield* evaluator.onMap(v, ancestors);
            }
            for (const [key, child] of Object.entries(v.entries)) {
                yield* evaluateImplCore(child.value, [{ kind: 'map', value: v, at: key, keyRange: child.keyRange }, ...ancestors], evaluator);
            }
            break;
    }
}
