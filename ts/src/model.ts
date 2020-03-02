export interface Range {
    readonly start: number;
    readonly end: number;
}

export interface ResourceParse {
    readonly entries: { [key: string]: ResourceMapEntry };
    readonly range: Range;
}

export interface ResourceMapEntry {
    readonly keyRange: Range;  // TODO: or have the parse be an array of [Ranged<string>, Value]
    readonly value: Value;
}

export interface StringValue {
    readonly valueType: 'string';
    readonly rawText: string;
    readonly value: string;
    readonly range: Range;
}

export interface NumberValue {
    readonly valueType: 'number';
    readonly rawText: string;
    readonly value: number;
    readonly range: Range;
}

export interface BooleanValue {
    readonly valueType: 'boolean';
    readonly rawText: string;
    readonly value: boolean;
    readonly range: Range;
}

export interface ArrayValue {
    readonly valueType: 'array';
    readonly items: ReadonlyArray<Value>;
    readonly range: Range;
}

export interface MapValue {
    readonly valueType: 'map';
    readonly entries: { [key: string]: ResourceMapEntry };
    readonly range: Range;
}

// E.g. the case where there is a header with no value
// naughty:
// nice:
//   val: 123
// In the above, 'naughty' will have a MissingValue
export interface MissingValue {
    readonly valueType: 'missing';
    readonly range: Range;  // TODO: would rather not but it makes life easier
}

export type Value =
    StringValue |
    NumberValue |
    BooleanValue |
    ArrayValue |
    MapValue |
    MissingValue;
