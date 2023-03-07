import { test, expect } from '@jest/globals';
import { RequestContext } from '../src/requestContext';
import { v4 as uuidv4 } from 'uuid';

test('requestContext', async () => {
    const uuid = uuidv4();
    const requestContext = new RequestContext(uuid);
    expect(requestContext).toEqual(
        expect.objectContaining({
            mockUuid: uuid,
            uuid: expect.stringMatching(/^[0-9a-f]{8}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{12}$/i),
        })
    );
    const boundContext = {};
    // @ts-ignore
    RequestContext.bind(boundContext, uuid);
    // @ts-ignore
    expect(RequestContext.get(boundContext)).toEqual(
        expect.objectContaining({
            mockUuid: uuid,
            uuid: expect.stringMatching(/^[0-9a-f]{8}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{12}$/i),
        })
    );
    // @ts-ignore
    expect(RequestContext.get({})).toBeNull();
});
