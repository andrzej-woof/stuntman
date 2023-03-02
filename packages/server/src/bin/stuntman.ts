#!/usr/bin/env node

import { Mock } from '../mock';
import { stuntmanConfig } from '@stuntman/shared';

const mock = new Mock(stuntmanConfig);

mock.start();
