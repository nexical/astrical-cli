#!/usr/bin/env node
import { CLI } from './core/CLI.js';

import { logger } from './utils/logger.js';

logger.debug('CLI ENTRY POINT HIT', process.argv);

const app = new CLI();
app.start();
