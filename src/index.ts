#!/usr/bin/env node
import { CLI } from './core/CLI.js';

console.log('DEBUG: CLI ENTRY POINT HIT', process.argv);

const app = new CLI();
app.start();
