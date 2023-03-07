import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

export class RequestContext {
    static _bindings: WeakMap<Request, RequestContext> = new WeakMap<Request, RequestContext>();

    public readonly mockUuid;
    public readonly uuid;

    constructor(mockUuid: string) {
        this.uuid = uuidv4();
        this.mockUuid = mockUuid;
    }

    static bind(req: Request, mockUuid: string): void {
        const ctx = new RequestContext(mockUuid);
        RequestContext._bindings.set(req, ctx);
    }

    static get(req: Request): RequestContext | null {
        return RequestContext._bindings.get(req) || null;
    }
}
