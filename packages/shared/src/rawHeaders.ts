import type * as Stuntman from '.';

export class RawHeaders extends Array<string> implements Stuntman.RawHeadersInterface {
    get(name: string): string | undefined {
        const headers = this.toHeaderPairs();
        const matchingHeaders = headers.filter((h) => h[0].toLowerCase() === name.toLowerCase());
        if (matchingHeaders.length === 0) {
            return undefined;
        }
        if (matchingHeaders.length === 1) {
            return matchingHeaders[0]![1];
        }
        throw new Error('Multiple headers with same name. Manipulate rawHeaders instead');
    }

    has(name: string, value?: string): boolean {
        const foundValue = this.get(name);
        if (value === undefined) {
            return foundValue !== undefined;
        }
        return foundValue === value;
    }

    set(name: string, value: string): void {
        let foundIndex = -1;
        for (let headerIndex = 0; headerIndex < this.length; headerIndex += 2) {
            if (this[headerIndex]!.toLowerCase() === name.toLowerCase()) {
                if (foundIndex !== -1) {
                    throw new Error('Multiple headers with same name. Manipulate rawHeaders instead');
                }
                foundIndex = headerIndex;
            }
        }
        if (foundIndex === -1) {
            this.add(name, value);
            return;
        }
        this[foundIndex + 1] = value;
    }

    add(name: string, value: string): void {
        this.push(name);
        this.push(value);
    }

    remove(name: string): void {
        const headersCopy = [...this];
        let foundIndex = -1;
        for (let headerIndex = 0; headerIndex < headersCopy.length; headerIndex += 2) {
            if (this[headerIndex]!.toLowerCase() === name.toLowerCase()) {
                if (foundIndex !== -1) {
                    throw new Error('Multiple headers with same name. Manipulate rawHeaders instead');
                }
                foundIndex = headerIndex;
            }
        }
        if (foundIndex === -1) {
            return;
        }
        this.splice(foundIndex, 2);
    }

    toHeaderPairs(): readonly [string, string][] {
        return RawHeaders.toHeaderPairs(this);
    }

    toHeadersRecord(): Record<string, string | string[]> {
        return RawHeaders.toHeadersRecord(this);
    }

    static fromHeaderPairs(headerPairs: [string, string][]): RawHeaders {
        return new RawHeaders(...headerPairs.flatMap((x) => x));
    }

    static fromHeadersRecord(headersRecord: Record<string, string | string[] | undefined>): RawHeaders {
        const output = new RawHeaders();
        for (const [key, value] of Object.entries(headersRecord)) {
            if (typeof value === 'string' || value === undefined) {
                output.add(key, value ?? '');
                continue;
            }
            for (const subValue of value) {
                output.add(key, subValue);
            }
        }
        return output;
    }

    static toHeadersRecord(rawHeaders: RawHeaders): Record<string, string | string[]> {
        const output: Record<string, string | string[]> = {};
        const headerPairs = rawHeaders.toHeaderPairs();
        for (const [key, value] of headerPairs) {
            if (!output[key]) {
                output[key] = value;
                continue;
            } else if (typeof output[key] === 'string') {
                output[key] = [output[key] as string, value];
            } else if (Array.isArray(output[key])) {
                (output[key] as string[]).push(value);
            } else {
                throw new Error('unexpected error');
            }
        }
        return output;
    }

    static toHeaderPairs(rawHeaders: string[]): readonly [string, string][] {
        const headers = new Array<[string, string]>();
        for (let headerIndex = 0; headerIndex < rawHeaders.length; headerIndex += 2) {
            headers.push([rawHeaders[headerIndex]!, rawHeaders[headerIndex + 1]!]);
        }
        return headers;
    }
}
