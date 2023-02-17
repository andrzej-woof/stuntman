import type { RecursivePartial, Config } from '.';
import configModule from 'config';

export const config = configModule.get<RecursivePartial<Config>>('stuntman');
