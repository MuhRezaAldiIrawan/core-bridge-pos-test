import * as fs from 'fs';
import * as path from 'path';

describe('MySQL migration configuration', () => {
  it('should configure Prisma to use MySQL and json-based allowedIps', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    expect(schema).toContain('provider = "mysql"');
    expect(schema).toContain('allowedIps    Json');
    expect(schema).toContain('@default("[]")');
  });
});
