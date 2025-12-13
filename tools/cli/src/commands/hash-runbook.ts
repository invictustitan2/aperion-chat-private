import fs from 'fs/promises';
import chalk from 'chalk';
import path from 'path';
import { hashRunbookTask } from '@aperion/shared';

export async function hashRunbook(file: string) {
  const filePath = path.resolve(process.cwd(), file);
  console.log(chalk.blue(`Reading runbook: ${filePath}`));

  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    console.error(chalk.red(`❌ Failed to read file: ${error.message}`));
    process.exit(1);
  }

  // Simple parsing: split by headers or bullet points?
  // The prompt says "Hashes a markdown runbook file into task IDs".
  // Let's assume tasks are defined as bullet points starting with "- [ ]" or just "- ".
  // Or maybe headers.
  // Let's assume headers (##) define tasks for now, or just hash the whole file if it's a single task?
  // "Each runbook should have stable task hashes." implies multiple tasks.
  
  // Let's parse H2 headers as task titles and the content below as the task body.
  
  const lines = content.split('\n');
  const tasks: { title: string; content: string[] }[] = [];
  let currentTask: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = { title: line.replace('## ', '').trim(), content: [] };
    } else if (currentTask) {
      currentTask.content.push(line);
    }
  }
  if (currentTask) {
    tasks.push(currentTask);
  }

  if (tasks.length === 0) {
    console.log(chalk.yellow('No tasks found (looking for ## headers). Hashing full file as one task.'));
    const hash = hashRunbookTask(content);
    console.log(chalk.green(`File Hash: ${hash}`));
    return;
  }

  console.log(chalk.blue(`Found ${tasks.length} tasks.`));
  
  for (const task of tasks) {
    const taskBody = task.content.join('\n').trim();
    const fullTask = `## ${task.title}\n${taskBody}`;
    const hash = hashRunbookTask(fullTask);
    console.log(`${chalk.bold(task.title)}: ${chalk.green(hash)}`);
  }
}
