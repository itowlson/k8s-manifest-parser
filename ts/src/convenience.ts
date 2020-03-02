import * as model from './model';

export interface Keyed {
    keyRange(): model.Range;
}

export type TraversalEntryType = 'string' | 'number' | 'boolean' | 'array' | 'map' | 'not-present' | 'not-valid';

export interface TraversalEntry {
    type(): TraversalEntryType;
    exists(): boolean;
    valid(): boolean;
    parseNode(): model.Value | undefined;
}

export interface ArrayTraversalEntry extends TraversalEntry {
    child(key: number): TraversalEntry;
    string(key: number): ScalarTraversalEntry<string>;
    number(key: number): ScalarTraversalEntry<number>;
    boolean(key: number): ScalarTraversalEntry<boolean>;
    array(key: number): ArrayTraversalEntry;
    map(key: number): MapTraversalEntry;
    items(): ReadonlyArray<TraversalEntry>;
    strings(): ReadonlyArray<ScalarTraversalEntry<string>>;
    numbers(): ReadonlyArray<ScalarTraversalEntry<number>>;
    booleans(): ReadonlyArray<ScalarTraversalEntry<boolean>>;
    arrays(): ReadonlyArray<ArrayTraversalEntry>;
    maps(): ReadonlyArray<MapTraversalEntry>;
}

export interface MapTraversalEntry extends TraversalEntry {
    child(key: string): TraversalEntry & Keyed;
    string(key: string): ScalarTraversalEntry<string> & Keyed;
    number(key: string): ScalarTraversalEntry<number> & Keyed;
    boolean(key: string): ScalarTraversalEntry<boolean> & Keyed;
    array(key: string): ArrayTraversalEntry & Keyed;
    map(key: string): MapTraversalEntry & Keyed;
    items(): ReadonlyMap<string, TraversalEntry>;
}

export interface ScalarTraversalEntry<T> extends TraversalEntry {
    value(): T;
    rawText(): string;
    range(): model.Range;
}

export function asTraversable(impl: model.ResourceParse): MapTraversalEntry {
    return traversalEntryOfMap({ valueType: 'map', entries: impl.entries });
}

function withChildAccessors(n: TraversalEntry): any {
    switch (n.type()) {
        case 'array':
            return withArrayIndexAccessors(n as ArrayTraversalEntry);
        case 'map':
        case 'not-valid':
        case 'not-present':
            return withMapKeyAccessors(n as MapTraversalEntry);
        default: return n;
    }
}

function numberLike(p: PropertyKey): { num: number } | undefined {
    if (typeof(p) === 'number') {
        return { num: p };
    }
    const numbery = !isNaN(p as any);
    if (numbery) {
        return { num: Number.parseInt(p as any) };
    }
    return undefined;
}

const indexHandler: ProxyHandler<ArrayTraversalEntry> = {
    get: (target: ArrayTraversalEntry, p: PropertyKey, _receiver: any) => {
        const actualrealresult = (target as any)[p];
        if (actualrealresult === undefined) {
            const numInfo = numberLike(p);
            if (numInfo) {
                const result = target.child(numInfo.num);
                return withChildAccessors(result);
            }
        }
        return actualrealresult;
    }
    // TODO: iterator support etc.
};

const keyHandler: ProxyHandler<MapTraversalEntry> = {
    get: (target: MapTraversalEntry, p: PropertyKey, _receiver: any) => {
        const actualrealresult = (target as any)[p];
        if ((typeof p === 'string') && (actualrealresult === undefined)) {
            const result = target.child(p);
            return withChildAccessors(result);
        }
        return actualrealresult;
    }
};

function withArrayIndexAccessors(n: ArrayTraversalEntry): any {
    return new Proxy<ArrayTraversalEntry>(n, indexHandler);
}

function withMapKeyAccessors(n: MapTraversalEntry): any {
    return new Proxy<MapTraversalEntry>(n, keyHandler);
}

function withKeyRange<T>(r: model.ResourceMapEntry | undefined, f: (v: model.Value | undefined) => T): T & Keyed {
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

function withKeyRangeUnchecked<T>(r: model.ResourceMapEntry, f: (v: model.Value) => T): T & Keyed {
    const n = f(r.value);
    const k: Keyed = {
        keyRange: () => r.keyRange
    };
    return { ...n, ...k };
}

function traversalEntryOf(v: model.Value): TraversalEntry {
    switch (v.valueType) {
        case 'string': return traversalEntryOfString(v);
        case 'number': return traversalEntryOfNumber(v);
        case 'boolean': return traversalEntryOfBoolean(v);
        case 'array': return traversalEntryOfArray(v);
        case 'map': return traversalEntryOfMap(v);
        case 'missing': return traversalEntryOfMissing();
    }
}

function safeTraversalEntryOf(v: model.Value | undefined): TraversalEntry {
    if (!v) {
        return traversalEntryOfMap(undefined);
    }
    switch (v.valueType) {
        case 'string': return traversalEntryOfString(v);
        case 'number': return traversalEntryOfNumber(v);
        case 'boolean': return traversalEntryOfBoolean(v);
        case 'array': return traversalEntryOfArray(v);
        case 'map': return traversalEntryOfMap(v);
        case 'missing': return traversalEntryOfMissing();
    }
}

function traversalEntryOfMap(impl: model.Value | undefined): MapTraversalEntry {
    const core = traversalEntryOfMapCore(impl);
    return withMapKeyAccessors(core);
}

function traversalEntryOfMapCore(impl: model.Value | undefined): MapTraversalEntry {
    if (!impl || impl.valueType !== 'map') {
        return {
            type: () => impl ? 'not-valid' : 'not-present',
            child: (_key: string) => withKeyRange(undefined, traversalEntryOfMap),
            string: (_key: string) => withKeyRange(undefined, traversalEntryOfString),
            number: (_key: string) => withKeyRange(undefined, traversalEntryOfNumber),
            boolean: (_key: string) => withKeyRange(undefined, traversalEntryOfBoolean),
            array: (_key: string) => withKeyRange(undefined, traversalEntryOfArray),
            map: (_key: string) => withKeyRange(undefined, traversalEntryOfMap),
            parseNode: () => undefined,
            exists: () => !!impl,
            valid: () => false,
            items: () => { throw new Error('element is not an array'); },
        };
    }
    return {
        type: () => 'map',
        child: (key: string) => withKeyRange(impl.entries[key], safeTraversalEntryOf),
        string: (key: string) => withKeyRange(impl.entries[key], traversalEntryOfString),
        number: (key: string) => withKeyRange(impl.entries[key], traversalEntryOfNumber),
        boolean: (key: string) => withKeyRange(impl.entries[key], traversalEntryOfBoolean),
        array: (key: string) => withKeyRange(impl.entries[key], traversalEntryOfArray),
        map: (key: string) => withKeyRange(impl.entries[key], traversalEntryOfMap),
        parseNode: () => impl,
        exists: () => true,
        valid: () => true,
        items: () => new Map<string, TraversalEntry>(Object.entries(impl.entries).map(([k, v]) => [k, withKeyRangeUnchecked(v, traversalEntryOf)])),
    };
}

function traversalEntryOfArray(impl: model.Value | undefined): ArrayTraversalEntry {
    const core = traversalEntryOfArrayCore(impl);
    return withArrayIndexAccessors(core);
}

function traversalEntryOfArrayCore(impl: model.Value | undefined): ArrayTraversalEntry {
    if (!impl || impl.valueType !== 'array') {
        return {
            type: () => impl ? 'not-valid' : 'not-present',
            child: (_key: number) => withKeyRange(undefined, traversalEntryOfMap),
            string: (_key: number) => traversalEntryOfString(undefined),
            number: (_key: number) => traversalEntryOfNumber(undefined),
            boolean: (_key: number) => traversalEntryOfBoolean(undefined),
            array: (_key: number) => traversalEntryOfArray(undefined),
            map: (_key: number) => traversalEntryOfMap(undefined),
            parseNode: () => undefined,
            exists: () => !!impl,
            valid: () => false,
            items: () => { throw new Error('element is not an array'); },
            strings: () => [],
            numbers: () => [],
            booleans: () => [],
            arrays: () => [],
            maps: () => [],
        };
    }
    return {
        type: () => 'array',
        child: (key: number) => safeTraversalEntryOf(impl.items[key]),
        string: (key: number) => traversalEntryOfString(impl.items[key]),
        number: (key: number) => traversalEntryOfNumber(impl.items[key]),
        boolean: (key: number) => traversalEntryOfBoolean(impl.items[key]),
        array: (key: number) => traversalEntryOfArray(impl.items[key]),
        map: (key: number) => traversalEntryOfMap(impl.items[key]),
        parseNode: () => impl,
        exists: () => true,
        valid: () => true,
        items: () => impl.items.map((i) => traversalEntryOf(i)),
        strings: () => impl.items.map((i) => traversalEntryOfString(i)),
        numbers: () => impl.items.map((i) => traversalEntryOfNumber(i)),
        booleans: () => impl.items.map((i) => traversalEntryOfBoolean(i)),
        arrays: () => impl.items.map((i) => traversalEntryOfArray(i)),
        maps: () => impl.items.map((i) => traversalEntryOfMap(i)),
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

function validatedEntryType(expected: TraversalEntryType, v: model.Value | undefined): TraversalEntryType {
    if (!v) {
        return 'not-present';
    }
    return v.valueType === expected ? v.valueType : 'not-valid';
}

function traversalEntryOfString(impl: model.Value | undefined): ScalarTraversalEntry<string> {
    return {
        type: () => validatedEntryType('string', impl),
        value: () => {
            checkString(impl);
            return impl.value;
        },
        range: () => {
            checkScalar(impl);
            return impl.range;
        },
        rawText: () => getRawText(impl),
        parseNode: () => impl,
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'string'
    };
}

function traversalEntryOfNumber(impl: model.Value | undefined): ScalarTraversalEntry<number> {
    return {
        type: () => validatedEntryType('number', impl),
        value: () => {
            checkNumber(impl);
            return impl.value;
        },
        range: () => {
            checkScalar(impl);
            return impl.range;
        },
        rawText: () => getRawText(impl),
        parseNode: () => impl,
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'number'
    };
}

function traversalEntryOfBoolean(impl: model.Value | undefined): ScalarTraversalEntry<boolean> {
    return {
        type: () => validatedEntryType('boolean', impl),
        value: () => {
            checkBoolean(impl);
            return impl.value;
        },
        range: () => {
            checkScalar(impl);
            return impl.range;
        },
        rawText: () => getRawText(impl),
        parseNode: () => impl,
        exists: () => impl !== undefined,
        valid: () => impl !== undefined && impl.valueType === 'boolean'
    };
}

function traversalEntryOfMissing(): TraversalEntry {
    return {
        type: () => 'not-present',
        exists: () => false,
        valid: () => false,
        parseNode: () => undefined,
    };
}
