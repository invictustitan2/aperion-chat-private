import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function migrate(options: { confirm?: boolean }) {
  if (!options.confirm) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'This will apply database migrations. Are you sure?',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Migration cancelled.'));
      return;
    }
  }

  console.log(chalk.blue('Running migrations...'));

  // Assuming we are running from tools/cli, we need to point to apps/api-worker
  // But wrangler needs to be run where wrangler.toml is, or with --config
  
  const child = spawn('npx', ['wrangler', 'd1', 'migrations', 'apply', 'aperion-db', '--remote'], {
    cwd: '../../apps/api-worker', // Adjust path to api-worker
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green('✓ Migrations applied successfully.'));
    } else {
      console.error(chalk.red(`❌ Migration failed with code ${code}`));
      process.exit(code || 1);
    }
  });
}
