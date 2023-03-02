export const stringify = (obj: any) =>
    JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'function' || value instanceof RegExp) {
            return value.toString();
        }
        return value;
    });
