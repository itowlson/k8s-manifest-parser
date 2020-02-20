import * as model from './model';

// TODO: I feel I want to make this safer, and that I could do
// so without all the proxy nonsense, by building up a structure
// of the form:
//
// interface Node {
//    [key: string | number]: Node;  // string key is error if not on map, num key is error if not on array
//    value: string | number | boolean;  // error on other types
//    ^^ or asString / asNumber / asBoolean / asArray / asMap each giving suitable typechecks, so you could do a.asNumber() < b.asNumber() and be assured that the operation existed
//    range: model.Range;  // error on other types
//    keyRange: model.Range;  // error if parent is not a map
// }

// TODO: things that don't exist should still return values so that the user can
// call an exists() or isPresent() method

// Another idea: navigation by methods which is wordier but would allow you to
// set expectations and could be more strongly typed for TS users:
//
// ast.string('apiVersion')
// ast.map('spec').array('containers').map(0).string('image').text()  // expects things to exist and throws if not
// ast.map('spec').map$('labels').string$('my-label').text()  // allows .labels and .my-label not to exist
//
// Not sure how useful the 'throw if not exist' version is; surely it has to throw at the .text()
// stage anyway so if the user cares they can just do an exists() on the return of string().
// But the method style has something going for it maybe.

export interface UntypedNodule {
    readonly [key: string]: any;
    readonly [index: number]: any;
}

// export interface IndexableNodule<I extends (string | number)> {
//     string(key: I): ScalarNodule<string>;
//     number(key: I): ScalarNodule<number>;
//     boolean(key: I): ScalarNodule<boolean>;
//     // possibly need a generic scalar(key) too
//     array(key: I): IndexableNodule<number>; // ReadonlyArray</* what - elements could be scalars or arrays or maps, so have to support the union of accessors (but no keyRange) */TypedNodule>;
//     map(key: I): IndexableNodule<string>;
//     // keyRange(): model.Range;  // TODO: ideally only if coming off map(...)
//     exists(): boolean;
//     valid(): boolean;
// }

export interface Keyed {
    keyRange(): model.Range;
}

export interface Nodule {
    type(): 'string' | 'number' | 'boolean' | 'array' | 'map';
    exists(): boolean;
    valid(): boolean;
}

export interface ArrayNodule extends Nodule {
    string(key: number): ScalarNodule<string>;
    number(key: number): ScalarNodule<number>;
    boolean(key: number): ScalarNodule<boolean>;
    // possibly need a generic scalar(key) too
    array(key: number): ArrayNodule;
    map(key: number): MapNodule;
    items(): ReadonlyArray<Nodule>;
}

export interface MapNodule extends Nodule {
    string(key: string): ScalarNodule<string> & Keyed;
    number(key: string): ScalarNodule<number> & Keyed;
    boolean(key: string): ScalarNodule<boolean> & Keyed;
    // possibly need a generic scalar(key) too
    array(key: string): ArrayNodule & Keyed;
    map(key: string): MapNodule & Keyed;
    items(): ReadonlyMap<string, Nodule>;
}

export interface ScalarNodule<T> extends Nodule {
    value(): T;
    range(): model.Range;
}

export function convenientify2(impl: model.ResourceParse): MapNodule {
    return typedNoduleOfMap({ valueType: 'map', entries: impl.entries });
}

function kr<T>(r: model.ResourceMapEntry | undefined, f: (v: model.Value | undefined) => T): T & Keyed {
    const n = f(r?.value);
    const k: Keyed = {
        keyRange: () => {
            if (r) {
                return r.keyRange;
            }
            throw new Error("I DON'T THINK SO MATE");
        }
    };
    return { ...n, ...k };
}

function typedNoduleOf(v: model.Value | undefined): Nodule {
    if (!v) {
        throw new Error('nooooooooooooooooooooooooooooooooooooooooooooooo');
    }
    switch (v.valueType) {
        case 'string': return typedNoduleOfString(v);
        case 'number': return typedNoduleOfNumber(v);
        case 'boolean': return typedNoduleOfBoolean(v);
        case 'array': return typedNoduleOfArray(v);
        case 'map': return typedNoduleOfMap(v);
    }
}

function typedNoduleOfMap(impl: model.Value | undefined): MapNodule {
    if (!impl || impl.valueType !== 'map') {
        throw new Error('FIIIIIIIIIIIIIE');
    }
    return {
        type: () => 'map',
        string: (key: string) => kr(impl.entries[key], typedNoduleOfString),
        number: (key: string) => kr(impl.entries[key], typedNoduleOfNumber),
        boolean: (key: string) => kr(impl.entries[key], typedNoduleOfBoolean),
        array: (key: string) => kr(impl.entries[key], typedNoduleOfArray),
        map: (key: string) => kr(impl.entries[key], typedNoduleOfMap),
        exists: () => true,
        valid: () => true,
        items: () => new Map<string, Nodule>(Object.entries(impl.entries).map(([k, v]) => [k, kr(v, typedNoduleOf)])),
    };
}

function typedNoduleOfArray(impl: model.Value | undefined): ArrayNodule {
    if (!impl || impl.valueType !== 'array') {
        throw new Error('FIIIIIIIIIIIIIE');
    }
    return {
        type: () => 'array',
        string: (key: number) => typedNoduleOfString(impl.items[key]),
        number: (key: number) => typedNoduleOfNumber(impl.items[key]),
        boolean: (key: number) => typedNoduleOfBoolean(impl.items[key]),
        array: (key: number) => typedNoduleOfArray(impl.items[key]),
        map: (key: number) => typedNoduleOfMap(impl.items[key]),
        exists: () => true,
        valid: () => true,
        items: () => impl.items.map((i) => typedNoduleOf(i)),
    };
}

// function checkString(impl: model.Value | undefined): impl is model.StringValue {
//     if (!impl) {
//         throw new Error('entry does not exist');
//     }
//     if (impl.valueType !== 'string') {
//         throw new Error(`expected type 'string' but was '${impl.valueType}'`);
//     }
//     return true;
// }

function checkString(v: model.Value | undefined): asserts v is model.StringValue {
    if (!v) {
        throw new Error('entry does not exist');
    }
    if (v.valueType !== 'string') {
        throw new Error(`expected type 'string' but was '${v.valueType}'`);
    }
}

function checkNumber(v: model.Value | undefined): asserts v is model.NumberValue {
    if (!v) {
        throw new Error('entry does not exist');
    }
    if (v.valueType !== 'number') {
        throw new Error(`expected type 'number' but was '${v.valueType}'`);
    }
}

function checkBoolean(v: model.Value | undefined): asserts v is model.BooleanValue {
    if (!v) {
        throw new Error('entry does not exist');
    }
    if (v.valueType !== 'boolean') {
        throw new Error(`expected type 'boolean' but was '${v.valueType}'`);
    }
}

function typedNoduleOfString(impl: model.Value | undefined): ScalarNodule<string> {
    return {
        type: () => 'string',
        value: () => {
            checkString(impl);
            return impl.value;
        },
        range: () => {
            checkString(impl);
            return impl.range;
        },
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'string'
    };
}

function typedNoduleOfNumber(impl: model.Value | undefined): ScalarNodule<number> {
    return {
        type: () => 'number',
        value: () => {
            checkNumber(impl);
            return impl.value;
        },
        range: () => {
            checkNumber(impl);
            return impl.range;
        },
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'number'
    };
}

function typedNoduleOfBoolean(impl: model.Value | undefined): ScalarNodule<boolean> {
    return {
        type: () => 'boolean',
        value: () => {
            checkBoolean(impl);
            return impl.value;
        },
        range: () => {
            checkBoolean(impl);
            return impl.range;
        },
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'boolean'
    };
}

export function convenientify(impl: model.ResourceParse): any {
    const handler = {
        has: (target: object, p: PropertyKey) => {
            if (p in target) {
                return true;
            }
            const r = target as model.ResourceParse;
            return !!r.entries[p.toString()];
        },
        get: (target: object, p: PropertyKey, receiver: any) => {
            const g = Reflect.get(target, p, receiver);
            if (g !== undefined) {
                return g;
            }
            const r = target as model.ResourceParse;
            return convRME(r.entries[p.toString()]);
        }
    };
    return new Proxy(impl, handler);
}

function convRME(e: model.ResourceMapEntry): any {
    const r = convValue(e.value);
    r.keyRange = e.keyRange;
    return r;
}

function convValue(e: model.Value): any {
    switch (e.valueType) {
        case 'string':
        case 'number':
        case 'boolean':
            return { value: e.value, range: e.range };
        case 'map':
            const map = e;
            // TODO: deduplicate
            const mhandler = {
                has: (target: object, p: PropertyKey) => {
                    if (p in target) {
                        return true;
                    }
                    const r = target as model.MapValue;
                    return !!r.entries[p.toString()];
                },
                get: (target: object, p: PropertyKey, receiver: any) => {
                    const g = Reflect.get(target, p, receiver);
                    if (g !== undefined) {
                        return g;
                    }
                    const r = target as model.MapValue;
                    return convRME(r.entries[p.toString()]);
                }
            };
            return new Proxy(map, mhandler);
        case 'array':
            const arr = e.items;
            const ahandler = {
                has: (target: object, p: PropertyKey) => {
                    const r = target as model.Value[];
                    return (p in r);
                },
                get: (target: object, p: PropertyKey, receiver: any) => {
                    const r = target as model.Value[];
                    if (isNaN(p as any)) {
                        return Reflect.get(r, p, receiver);
                    }
                    const v = r[p as number];
                    return convValue(v);
                }
            };
            return new Proxy(arr, ahandler);
    }
}

export class Resource {
    constructor(private readonly impl: model.ResourceParse) {}

    map(key: string): KeyValueMap {
        const foo: { [key: string]: string | undefined } = {};
        console.log(foo.arse);

        const entry = this.impl.entries['key'];
        if (entry.value.valueType === 'map') {
            return new KeyValueMap(entry);
        }
        throw new Error(`map('${key}') expected to find a map but instead found a ${entry.value.valueType}`);
    }
}

export class KeyValueMap {
    constructor(private readonly impl: model.ResourceMapEntry) {}

    keyRange() { return this.impl.keyRange; }
}

// desired usage:

/*
```
const ast = makeit(someText)
for (const container of ast.spec.containers) {
    const requiredMem = container.required.memory;
    const limitsMem = container.limits.memory;
    if (requiredMem.numValue() < limitsMem.numValue()) {
        mkwarn(requiredMem.range, 'required memory is less than max memory');
    }
}
```
*/
