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
// set expectations and could be more strongly typed:
//
// ast.string('apiVersion')
// ast.map('spec').array('containers').map(0).string(image).text()  // expects things to exist and throws if not
// ast.map('spec').map$('labels').string$('my-label').text()  // allows .labels and .my-label not to exist
//
// Not sure how useful the 'throw if not exist' version is; surely it has to throw at the .text()
// stage anyway so if the user cares they can just do an exists() on the return of string().
// But the method style has something going for it maybe.

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
