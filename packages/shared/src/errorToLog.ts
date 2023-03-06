export const errorToLog = (error: Error) => {
    if (!error || typeof error !== 'object' || Array.isArray(error)) {
        return error;
    }
    return { message: error.message, stack: error.stack, name: error.name };
};
