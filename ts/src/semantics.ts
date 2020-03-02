import { ResourceParse } from "./model";
import { MapTraversalEntry } from "./convenience";

export function isKind(resource: ResourceParse | MapTraversalEntry, kind: string, apiVersion?: string): boolean {
    if (!resource) {
        return false;
    }

    if (isMapTraversalEntry(resource)) {
        const resourceKind = resource.string('kind');
        const resourceVersion = resource.string('apiVersion');

        const kindMatches = resourceKind.exists() && resourceKind.valid() && resourceKind.value() === kind;
        const versionMatches = apiVersion ? (resourceVersion.exists() && resourceVersion.valid() && resourceVersion.value() === apiVersion) : true;

        return kindMatches && versionMatches;
    } else {
        const resourceKind = resource.entries.kind;
        const resourceVersion = resource.entries.apiVersion;

        const kindMatches = !!resourceKind && resourceKind.value.valueType === 'string' && resourceKind.value.value === kind;
        const versionMatches = apiVersion ? (!!resourceVersion && resourceVersion.value.valueType === 'string' && resourceVersion.value.value === apiVersion) : true;

        return kindMatches && versionMatches;
    }
}

function isMapTraversalEntry(resource: ResourceParse | MapTraversalEntry): resource is MapTraversalEntry {
    const typeReader = (resource as any).type;
    if (typeReader && (typeof typeReader === 'function')) {
        return typeReader() === 'map';
    }
    return false;
}
