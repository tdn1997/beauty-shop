import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Kiểm thử kiến trúc: tầng `domain/` phải thuần TypeScript.
 * Nếu nó import Nest / Prisma / HTTP client thì nghiệp vụ đã dính hạ tầng —
 * test này chặn ngay thay vì đợi người review phát hiện.
 */
const FORBIDDEN_IN_DOMAIN = [
  '@nestjs/',
  '@prisma/',
  'prisma',
  'express',
  'axios',
  'node-fetch',
  'typeorm',
];

const MODULES_ROOT = join(__dirname, 'modules');
const IMPORT_PATTERN = /(?:from|require\()\s*['"]([^'"]+)['"]/g;

function listTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listTypeScriptFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * File của tầng `api/` và `application/`. Bỏ qua `*.spec.ts`: test được phép
 * cắm cài đặt cụ thể vào, đó chính là việc của nó.
 */
function listInwardFiles(): string[] {
  return readdirSync(MODULES_ROOT)
    .flatMap((moduleName) =>
      ['api', 'application'].map((layer) => join(MODULES_ROOT, moduleName, layer)),
    )
    .filter((layerDir) => {
      try {
        return statSync(layerDir).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap(listTypeScriptFiles)
    .filter((file) => !file.endsWith('.spec.ts'));
}

function listDomainFiles(): string[] {
  return readdirSync(MODULES_ROOT)
    .map((moduleName) => join(MODULES_ROOT, moduleName, 'domain'))
    .filter((domainDir) => {
      try {
        return statSync(domainDir).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap(listTypeScriptFiles);
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] as string);
}

describe('architecture - domain purity', () => {
  it('should find domain files to check', () => {
    // arrange
    const modulesRoot = MODULES_ROOT;

    // confirm
    expect(statSync(modulesRoot).isDirectory()).toBe(true);

    // act
    const files = listDomainFiles();

    // assert
    expect(files.length).toBeGreaterThan(0);
  });

  it('should keep every domain file free of framework and infrastructure imports', () => {
    // arrange
    const files = listDomainFiles();

    // confirm
    expect(files.length).toBeGreaterThan(0);

    // act
    const violations = files.flatMap((file) =>
      importsOf(file)
        .filter((specifier) =>
          FORBIDDEN_IN_DOMAIN.some(
            (banned) => specifier === banned || specifier.startsWith(banned),
          ),
        )
        .map((specifier) => `${file.replace(MODULES_ROOT, 'modules')} → ${specifier}`),
    );

    // assert
    expect(violations).toEqual([]);
  });

  it('should keep domain files from reaching into another module', () => {
    // arrange
    const files = listDomainFiles().filter((file) => !file.includes('/shared/'));

    // confirm
    expect(files.length).toBeGreaterThan(0);

    // act
    const violations = files.flatMap((file) => {
      const owningModule = file.replace(`${MODULES_ROOT}/`, '').split('/')[0] as string;
      return importsOf(file)
        .filter((specifier) => specifier.startsWith('..'))
        .filter((specifier) => {
          const target = specifier.split('/').filter((part) => part !== '..' && part !== '.');
          const targetModule = target[0];
          return (
            targetModule !== undefined && targetModule !== owningModule && targetModule !== 'shared'
          );
        })
        .map((specifier) => `${owningModule} → ${specifier}`);
    });

    // assert
    expect(violations).toEqual([]);
  });
});

/**
 * Phụ thuộc chỉ đi vào trong. `api/` và `application/` **khai báo** cổng;
 * `infrastructure/` cài đặt chúng. Nếu chiều này đảo lại thì kiểu của Prisma
 * (hàng trong bảng, `Decimal`, enum sinh ra) sẽ bò lên tới DTO trả cho client,
 * và đổi ORM biến thành đổi hợp đồng API.
 */
describe('architecture - dependencies point inward', () => {
  it('should find api and application files to check', () => {
    // arrange
    const modulesRoot = MODULES_ROOT;

    // confirm
    expect(statSync(modulesRoot).isDirectory()).toBe(true);

    // act
    const files = listInwardFiles();

    // assert
    expect(files.length).toBeGreaterThan(0);
  });

  it('should keep api and application from importing infrastructure', () => {
    // arrange
    const files = listInwardFiles();

    // confirm
    expect(files.length).toBeGreaterThan(0);

    // act
    const violations = files.flatMap((file) =>
      importsOf(file)
        .filter((specifier) => specifier.split('/').includes('infrastructure'))
        .map((specifier) => `${file.replace(MODULES_ROOT, 'modules')} → ${specifier}`),
    );

    // assert
    expect(violations).toEqual([]);
  });
});
