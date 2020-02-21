import * as model from './model';

export interface Keyed {
    keyRange(): model.Range;
}

export type NoduleType = 'string' | 'number' | 'boolean' | 'array' | 'map' | 'not-present' | 'not-valid';

export interface Nodule {
    type(): NoduleType;
    exists(): boolean;
    valid(): boolean;
}

export interface ArrayNodule extends Nodule {
    child(key: number): Nodule;
    string(key: number): ScalarNodule<string>;
    number(key: number): ScalarNodule<number>;
    boolean(key: number): ScalarNodule<boolean>;
    array(key: number): ArrayNodule;
    map(key: number): MapNodule;
    items(): ReadonlyArray<Nodule>;
}

export interface MapNodule extends Nodule {
    child(key: string): Nodule & Keyed;
    string(key: string): ScalarNodule<string> & Keyed;
    number(key: string): ScalarNodule<number> & Keyed;
    boolean(key: string): ScalarNodule<boolean> & Keyed;
    array(key: string): ArrayNodule & Keyed;
    map(key: string): MapNodule & Keyed;
    items(): ReadonlyMap<string, Nodule>;
}

export interface ScalarNodule<T> extends Nodule {
    value(): T;
    rawText(): string;
    range(): model.Range;
}

export function convenientify2(impl: model.ResourceParse): MapNodule {
    return typedNoduleOfMap({ valueType: 'map', entries: impl.entries });
}

function proxulise(n: Nodule): any {
    switch (n.type()) {
        case 'array':
            return proxuliseArray(n as ArrayNodule);
        case 'map':
        case 'not-valid':
        case 'not-present':
            return proxuliseMap(n as MapNodule);
        default: return n;
    }
}

function numerous(p: PropertyKey): { num: number } | undefined {
    if (typeof(p) === 'number') {
        return { num: p };
    }
    const numbery = !isNaN(p as any);
    if (numbery) {
        return { num: Number.parseInt(p as any) };
    }
    return undefined;
}

const indexHandler: ProxyHandler<ArrayNodule> = {
    get: (target: ArrayNodule, p: PropertyKey, _receiver: any) => {
        const actualrealresult = (target as any)[p];
        if (actualrealresult === undefined) {
            const numInfo = numerous(p);
            if (numInfo) {
                const result = target.child(numInfo.num);
                return proxulise(result);
            }
        }
        return actualrealresult;
    }
    // TODO: iterator support etc.
};

const keyHandler: ProxyHandler<MapNodule> = {
    get: (target: MapNodule, p: PropertyKey, _receiver: any) => {
        const actualrealresult = (target as any)[p];
        if ((typeof p === 'string') && (actualrealresult === undefined)) {
            const result = target.child(p);
            return proxulise(result);
        }
        return actualrealresult;
    }
};

function proxuliseArray(n: ArrayNodule): any {
    return new Proxy<ArrayNodule>(n, indexHandler);
}

function proxuliseMap(n: MapNodule): any {
    return new Proxy<MapNodule>(n, keyHandler);
}

function kr<T>(r: model.ResourceMapEntry | undefined, f: (v: model.Value | undefined) => T): T & Keyed {
    const n = f(r?.value);
    const k: Keyed = {
        keyRange: () => {
            if (r) {
                return r.keyRange;
            }
            throw new Error('element is not the value of a key');
        }
    };
    return { ...n, ...k };
}

function krDefTotes<T>(r: model.ResourceMapEntry, f: (v: model.Value) => T): T & Keyed {
    const n = f(r.value);
    const k: Keyed = {
        keyRange: () => r.keyRange
    };
    return { ...n, ...k };
}

function typedNoduleOf(v: model.Value): Nodule {
    switch (v.valueType) {
        case 'string': return typedNoduleOfString(v);
        case 'number': return typedNoduleOfNumber(v);
        case 'boolean': return typedNoduleOfBoolean(v);
        case 'array': return typedNoduleOfArray(v);
        case 'map': return typedNoduleOfMap(v);
    }
}

function typedNoduleOf2(v: model.Value | undefined): Nodule {
    if (!v) {
        return typedNoduleOfMap(undefined);
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
    const core = typedNoduleOfMapCore(impl);
    return proxuliseMap(core);
}

function typedNoduleOfMapCore(impl: model.Value | undefined): MapNodule {
    if (!impl || impl.valueType !== 'map') {
        return {
            type: () => impl ? 'not-valid' : 'not-present',
            child: (_key: string) => kr(undefined, typedNoduleOfMap),
            string: (_key: string) => kr(undefined, typedNoduleOfString),
            number: (_key: string) => kr(undefined, typedNoduleOfNumber),
            boolean: (_key: string) => kr(undefined, typedNoduleOfBoolean),
            array: (_key: string) => kr(undefined, typedNoduleOfArray),
            map: (_key: string) => kr(undefined, typedNoduleOfMap),
            exists: () => !!impl,
            valid: () => false,
            items: () => { throw new Error('element is not an array'); },
        };
    }
    return {
        type: () => 'map',
        child: (key: string) => kr(impl.entries[key], typedNoduleOf2),
        string: (key: string) => kr(impl.entries[key], typedNoduleOfString),
        number: (key: string) => kr(impl.entries[key], typedNoduleOfNumber),
        boolean: (key: string) => kr(impl.entries[key], typedNoduleOfBoolean),
        array: (key: string) => kr(impl.entries[key], typedNoduleOfArray),
        map: (key: string) => kr(impl.entries[key], typedNoduleOfMap),
        exists: () => true,
        valid: () => true,
        items: () => new Map<string, Nodule>(Object.entries(impl.entries).map(([k, v]) => [k, krDefTotes(v, typedNoduleOf)])),
    };
}

function typedNoduleOfArray(impl: model.Value | undefined): ArrayNodule {
    const core = typedNoduleOfArrayCore(impl);
    return proxuliseArray(core);
}

function typedNoduleOfArrayCore(impl: model.Value | undefined): ArrayNodule {
    if (!impl || impl.valueType !== 'array') {
        return {
            type: () => impl ? 'not-valid' : 'not-present',
            child: (_key: number) => kr(undefined, typedNoduleOfMap),
            string: (_key: number) => typedNoduleOfString(undefined),
            number: (_key: number) => typedNoduleOfNumber(undefined),
            boolean: (_key: number) => typedNoduleOfBoolean(undefined),
            array: (_key: number) => typedNoduleOfArray(undefined),
            map: (_key: number) => typedNoduleOfMap(undefined),
            exists: () => !!impl,
            valid: () => false,
            items: () => { throw new Error('element is not an array'); },
        };
    }
    return {
        type: () => 'array',
        child: (key: number) => typedNoduleOf2(impl.items[key]),
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

function checkExists(v: model.Value | undefined): asserts v is model.Value {
    if (!v) {
        throw new Error('entry does not exist');
    }
}

function checkString(v: model.Value | undefined): asserts v is model.StringValue {
    checkExists(v);
    if (v.valueType !== 'string') {
        throw new Error(`expected type 'string' but was '${v.valueType}'`);
    }
}

function checkNumber(v: model.Value | undefined): asserts v is model.NumberValue {
    checkExists(v);
    if (v.valueType !== 'number') {
        throw new Error(`expected type 'number' but was '${v.valueType}'`);
    }
}

function checkBoolean(v: model.Value | undefined): asserts v is model.BooleanValue {
    checkExists(v);
    if (v.valueType !== 'boolean') {
        throw new Error(`expected type 'boolean' but was '${v.valueType}'`);
    }
}

function checkScalar(v: model.Value | undefined): asserts v is model.StringValue | model.NumberValue | model.BooleanValue {
    checkExists(v);
    if (v.valueType === 'string' || v.valueType === 'number' || v.valueType === 'boolean') {
        return;
    }
    throw new Error(`expected scalar but was '${v.valueType}'`);
}

function getRawText(v: model.Value | undefined) {
    checkExists(v);
    checkScalar(v);
    return v.rawText;
}

function noduleType(expected: NoduleType, v: model.Value | undefined): NoduleType {
    if (!v) {
        return 'not-present';
    }
    return v.valueType === expected ? v.valueType : 'not-valid';
}

function typedNoduleOfString(impl: model.Value | undefined): ScalarNodule<string> {
    return {
        type: () => noduleType('string', impl),
        value: () => {
            checkString(impl);
            return impl.value;
        },
        range: () => {
            checkScalar(impl);
            return impl.range;
        },
        rawText: () => getRawText(impl),
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'string'
    };
}

function typedNoduleOfNumber(impl: model.Value | undefined): ScalarNodule<number> {
    return {
        type: () => noduleType('number', impl),
        value: () => {
            checkNumber(impl);
            return impl.value;
        },
        range: () => {
            checkScalar(impl);
            return impl.range;
        },
        rawText: () => getRawText(impl),
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'number'
    };
}

function typedNoduleOfBoolean(impl: model.Value | undefined): ScalarNodule<boolean> {
    return {
        type: () => noduleType('boolean', impl),
        value: () => {
            checkBoolean(impl);
            return impl.value;
        },
        range: () => {
            checkScalar(impl);
            return impl.range;
        },
        rawText: () => getRawText(impl),
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'boolean'
    };
}
