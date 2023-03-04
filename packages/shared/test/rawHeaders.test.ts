import { expect, test } from '@jest/globals';
import { RawHeaders } from '../src/rawHeaders';

test('empty', async () => {
    const rawHeaders = new RawHeaders();
    expect(rawHeaders).toEqual([]);
    expect(rawHeaders.toHeaderPairs()).toEqual([]);
    expect(rawHeaders.has('test')).toEqual(false);
    expect(rawHeaders.get('test')).toBeUndefined();
    expect(rawHeaders.remove('test')).toBeUndefined();

    expect(rawHeaders.add('test0', 'value0')).toBeUndefined();
    expect(rawHeaders.add('test', 'value')).toBeUndefined();
    expect(rawHeaders.add('test2', 'value2')).toBeUndefined();
    expect(rawHeaders).toEqual(['test0','value0','test','value','test2','value2']);
    expect(rawHeaders.toHeaderPairs()).toEqual([['test0','value0'],['test','value'],['test2','value2']]);
    expect(rawHeaders.has('test')).toEqual(true);
    expect(rawHeaders.has('test','wrong')).toEqual(false);
    expect(rawHeaders.has('test','value')).toEqual(true);
    expect(rawHeaders.get('test')).toEqual('value');
    expect(rawHeaders.set('test','newValue')).toBeUndefined();
    expect(rawHeaders).toEqual(['test0','value0','test','newValue','test2','value2']);
    expect(rawHeaders.toHeaderPairs()).toEqual([['test0','value0'],['test','newValue'],['test2','value2']]);

    expect(rawHeaders.remove('test')).toBeUndefined();

    expect(rawHeaders).toEqual(['test0','value0','test2','value2']);
    expect(rawHeaders.toHeaderPairs()).toEqual([['test0','value0'],['test2','value2']]);

    expect(rawHeaders.set('newKey','newValue')).toBeUndefined();
    expect(rawHeaders).toEqual(['test0','value0','test2','value2','newKey','newValue']);

});

test('duplicate values', async () => {
    const rawHeaders = new RawHeaders('ok','valueok','test','value','TEST','VALUE','TeSt','VaLuE');
    expect(rawHeaders).toEqual(['ok','valueok','test','value','TEST','VALUE','TeSt','VaLuE']);
    expect(rawHeaders.has('ok')).toEqual(true);
    expect(rawHeaders.get('ok')).toEqual('valueok');
    expect(() => rawHeaders.has('tEsT')).toThrow();
    expect(() => rawHeaders.get('tEsT')).toThrow();
    expect(() => rawHeaders.set('tEsT','newValue')).toThrow();
    expect(() => rawHeaders.remove('tEsT')).toThrow();
    expect(rawHeaders).toEqual(['ok','valueok','test','value','TEST','VALUE','TeSt','VaLuE']);
});

test('fromHeaderPairs', async () => {
    const rawHeaders = RawHeaders.fromHeaderPairs([['ok','valueok'],['test','value'],['TEST','VALUE'],['TeSt','VaLuE']]);
    expect(rawHeaders).toEqual(['ok','valueok','test','value','TEST','VALUE','TeSt','VaLuE']);
});

test('fromHeadersRecord', async () => {
    const rawHeaders = new RawHeaders(
        'someHeader',
        'someValue',
        'duplicated1',
        'value11',
        'DUPLICATED1',
        'value12',
        'duplicated2',
        'value21',
        'duplicated2',
        'value22',
        'duplicated2',
        'value23',
        'empty',
        '',
    );
    expect(rawHeaders.toHeadersRecord()).toEqual({
        someHeader: 'someValue',
        duplicated1: 'value11',
        DUPLICATED1: 'value12',
        duplicated2: [ 'value21', 'value22', 'value23' ],
        empty: ''
    });
});

test('fromHeadersRecord', async () => {
    const rawHeaders = RawHeaders.fromHeadersRecord({
        someHeader: 'someValue',
        duplicated1: 'value11',
        DUPLICATED1: 'value12',
        duplicated2: ['value21','value22'],
        empty: undefined,
    });
    expect(rawHeaders).toEqual([
        'someHeader',
        'someValue',
        'duplicated1',
        'value11',
        'DUPLICATED1',
        'value12',
        'duplicated2',
        'value21',
        'duplicated2',
        'value22',
        'empty',
        '',
    ]);
});