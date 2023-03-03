import type * as Stuntman from '.';

export interface AppErrorInterface {
    name?: string;
    httpCode: Stuntman.HttpCode;
    message: string;
    isOperational?: boolean;
}

export class AppError extends Error {
    public readonly httpCode: Stuntman.HttpCode;
    public readonly isOperational: boolean = true;

    constructor(args: AppErrorInterface) {
        super(args.message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = args.name || 'Error';
        this.httpCode = args.httpCode;

        if (args.isOperational !== undefined) {
            this.isOperational = args.isOperational;
        }

        Error.captureStackTrace(this);
    }
}
