import { test, expect } from '@jest/globals';
import { naiveGQLParser } from '../src/gqlParser';

const queryBody = {
    query: 'query myOperation ($someId: String) { author(input: { id: $someId }) { id name } }',
    operationName: 'myOperation',
    variables: { $someId: '666777test' },
    type: 'query',
    methodName: 'author',
};

test('naiveGQLParser', async () => {
    expect(naiveGQLParser(JSON.stringify(queryBody))).toEqual(queryBody);
    expect(naiveGQLParser(JSON.stringify({ ...queryBody, query: queryBody.query.replace(/^query/, 'mutation') }))).toEqual({
        ...queryBody,
        type: 'mutation',
        query: queryBody.query.replace(/^query/, 'mutation'),
    });
});

test('invalid body', async () => {
    expect(naiveGQLParser('Internal server error')).toBeUndefined();
    expect(naiveGQLParser(JSON.stringify({ someObject: 'someValue' }))).toBeUndefined();
    expect(naiveGQLParser(JSON.stringify({ query: 'someValue' }))).toBeUndefined();
    expect(naiveGQLParser(JSON.stringify({ query: 'query broken' }))).toBeUndefined();
    expect(
        naiveGQLParser(
            JSON.stringify({ query: 'querybroken myOperation ($someId: String) { author(input: { id: $someId }) { id name } }' })
        )
    ).toBeUndefined();
});

test('buffer body', async () => {
    expect(naiveGQLParser(Buffer.from(JSON.stringify(queryBody)))).toEqual(queryBody);
});
