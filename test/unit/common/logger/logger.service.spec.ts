import * as fs from 'fs';
import * as path from 'path';
import { AppLogger } from '../../../../src/common/logger/logger.service';

describe('AppLogger', () => {
  const testLogDir = path.join(process.cwd(), 'tmp-test-logs');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const logFilePath = path.join(testLogDir, `app-${dateStamp}.log`);

  const originalLogDir = process.env.LOG_DIR;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
    process.env.LOG_DIR = testLogDir;
    process.env.LOG_LEVEL = 'info';
  });

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }

    if (originalLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = originalLogDir;
    }

    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  it('writes application logs into a daily file for the current date', async () => {
    const logger = new AppLogger();

    logger.log('daily file logging test', 'LoggerServiceSpec');
    logger.error('daily file error test', 'stack trace', 'LoggerServiceSpec');

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(fs.existsSync(logFilePath)).toBe(true);

    const logContent = fs.readFileSync(logFilePath, 'utf8');
    expect(logContent).toContain('daily file logging test');
    expect(logContent).toContain('daily file error test');
  });
});
