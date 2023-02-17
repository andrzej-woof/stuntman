#!/usr/bin/env node

import { Mock } from '../mock';
import { serverConfig } from '@stuntman/shared';

const mock = new Mock(serverConfig);

mock.start();
