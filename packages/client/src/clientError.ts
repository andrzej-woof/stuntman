import { AppError } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

export enum HttpCode {
    OK = 200,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_SERVER_ERROR = 500,
}

export class ClientError extends AppError {
    public readonly originalStack?: string;

    constructor(args: Stuntman.AppError & { stack?: string }) {
        super(args);
        this.originalStack = args.stack;
    }
}
