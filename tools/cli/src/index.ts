#!/usr/bin/env node
import { Command } from 'commander';
import { verify } from './commands/verify.js';
import { migrate } from './commands/migrate.js';
import { seed } from './commands/seed.js';
import { exportData } from './commands/export.js';
import { hashRunbook } from './commands/hash-runbook.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const program = new Command();

program
  .name('aperion')
  .description('CLI for Aperion Chat operator workflows')
  .version('0.0.1');

program
  .command('verify')
  .description('Checks env, connectivity, auth, DB schema version')
  .action(verify);

program
  .command('migrate')
  .description('Runs D1 migrations via wrangler')
  .option('--confirm', 'Skip confirmation prompt')
  .action(migrate);

program
  .command('seed')
  .description('Loads example identity memory from a local YAML')
  .argument('<file>', 'Path to YAML seed file')
  .option('--confirm', 'Skip confirmation prompt')
  .action(seed);

program
  .command('export')
  .description('Exports episodic/semantic/identity to a local JSONL with hashes')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .action(exportData);

program
  .command('hash-runbook')
  .description('Hashes a markdown runbook file into task IDs')
  .argument('<file>', 'Path to markdown runbook file')
  .action(hashRunbook);

program.parse();
