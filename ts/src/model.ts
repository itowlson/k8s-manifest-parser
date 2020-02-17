export interface Range {
    readonly start: number;
    readonly end: number;
}

export interface ResourceParse {
    readonly entries: { [key: string]: ResourceMapEntry };
}

export interface ResourceMapEntry {
    readonly keyRange: Range;  // TODO: or have the parse be an array of [Ranged<string>, Value]
    readonly content: Value;
}

export interface StringValue {
    readonly valueType: 'string';
    readonly value: string;
    readonly range: Range;
}

export interface NumberValue {
    readonly valueType: 'number';
    readonly value: number;
    readonly range: Range;
}

export interface BooleanValue {
    readonly valueType: 'boolean';
    readonly value: boolean;
    readonly range: Range;
}

export interface ArrayValue {
    readonly valueType: 'array';
    readonly items: ReadonlyArray<Value>;
}

export interface MapValue {
    readonly valueType: 'map';
    readonly entries: { [key: string]: ResourceMapEntry };
}

export type Value =
    StringValue |
    NumberValue |
    BooleanValue |
    ArrayValue |
    MapValue;
