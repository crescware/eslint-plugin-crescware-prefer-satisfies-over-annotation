import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const oxlintBin = resolve(repoRoot, "node_modules/.bin/oxlint");
const fixturesDir = resolve(repoRoot, "fixtures");
const defaultConfig = resolve(fixturesDir, "oxlintrc.default.json");
const allowConfig = resolve(fixturesDir, "oxlintrc.allow.json");
const allowAsConfig = resolve(fixturesDir, "oxlintrc.allow-as.json");
const emptyStrictConfig = resolve(fixturesDir, "oxlintrc.empty-strict.json");
const emptyMessageConfig = resolve(fixturesDir, "oxlintrc.empty-message.json");

type Diagnostic = {
  message: string;
  filename: string;
  severity: string;
};

type OxlintReport = { diagnostics: Diagnostic[] };

const runFixtures = (configPath: string): Diagnostic[] => {
  const result = spawnSync(
    oxlintBin,
    ["-c", configPath, "--no-ignore", "-f", "json", resolve(fixturesDir) + "/"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.error !== undefined && result.error !== null) {
    throw result.error;
  }
  const parsed = JSON.parse(result.stdout ?? "") as OxlintReport;
  return parsed.diagnostics;
};

const messagesFor = (diagnostics: Diagnostic[], filename: string): string[] => {
  return diagnostics
    .filter((v) => v.filename.endsWith(`/${filename}`))
    .map((v) => v.message);
};

const annotatedMessage = (name: string): string => {
  return `Const '${name}' has a type annotation on a literal initializer. Move the type into a 'satisfies' clause: write 'const ${name} = ... satisfies T' instead of 'const ${name}: T = ...'.`;
};

const annotationlessMessage = (name: string): string => {
  return `Const '${name}' has a literal initializer with no declared type. Add a 'satisfies' clause: write 'const ${name} = ... satisfies T'.`;
};

const asAssertionMessage = (name: string): string => {
  return `Const '${name}' uses an 'as' assertion on a literal initializer. Move the type into a 'satisfies' clause: write 'const ${name} = ... satisfies T' instead of 'const ${name} = ... as T'. ('as const' is allowed.)`;
};

// Must match the `message` in fixtures/oxlintrc.empty-message.json exactly.
const emptyCustomMessage =
  "Empty literal: 'satisfies' cannot type it; declare the type with an explicit annotation instead.";

let defaultDiagnostics: Diagnostic[] = [];
let allowDiagnostics: Diagnostic[] = [];
let allowAsDiagnostics: Diagnostic[] = [];
let emptyStrictDiagnostics: Diagnostic[] = [];
let emptyMessageDiagnostics: Diagnostic[] = [];

beforeAll(() => {
  const probe = spawnSync(oxlintBin, ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    throw new Error(`oxlint not runnable: ${probe.stderr ?? ""}`);
  }
  defaultDiagnostics = runFixtures(defaultConfig);
  allowDiagnostics = runFixtures(allowConfig);
  allowAsDiagnostics = runFixtures(allowAsConfig);
  emptyStrictDiagnostics = runFixtures(emptyStrictConfig);
  emptyMessageDiagnostics = runFixtures(emptyMessageConfig);
});

const okFiles = [
  "ok-satisfies.ts",
  "ok-as.ts",
  "ok-out-of-scope.ts",
  "ok-let-var.ts",
] satisfies string[];

describe("default options", () => {
  test("annotated literals are reported", () => {
    expect(messagesFor(defaultDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
  });

  test("annotationless literals are reported", () => {
    expect(messagesFor(defaultDiagnostics, "ng-annotationless.ts")).toEqual([
      annotationlessMessage("obj"),
      annotationlessMessage("arr"),
    ]);
  });

  test("'as' assertions on literals are reported", () => {
    expect(messagesFor(defaultDiagnostics, "ng-as.ts")).toEqual([
      asAssertionMessage("origin"),
      asAssertionMessage("nums"),
      asAssertionMessage("forced"),
      asAssertionMessage("forcedArr"),
    ]);
  });

  test("empty literals are allowed by default", () => {
    expect(messagesFor(defaultDiagnostics, "ng-empty.ts")).toEqual([]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(defaultDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(defaultDiagnostics.length).toBe(8);
  });
});

describe("allowWithoutAnnotation: true", () => {
  test("annotated literals are still reported", () => {
    expect(messagesFor(allowDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
  });

  test("annotationless literals are ignored", () => {
    expect(messagesFor(allowDiagnostics, "ng-annotationless.ts")).toEqual([]);
  });

  test("'as' assertions on literals are still reported", () => {
    expect(messagesFor(allowDiagnostics, "ng-as.ts")).toEqual([
      asAssertionMessage("origin"),
      asAssertionMessage("nums"),
      asAssertionMessage("forced"),
      asAssertionMessage("forcedArr"),
    ]);
  });

  test("empty literals are allowed by default", () => {
    expect(messagesFor(allowDiagnostics, "ng-empty.ts")).toEqual([]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(allowDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(allowDiagnostics.length).toBe(6);
  });
});

describe("allowAsAssertion: true", () => {
  test("annotated literals are still reported", () => {
    expect(messagesFor(allowAsDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
  });

  test("annotationless literals are still reported", () => {
    expect(messagesFor(allowAsDiagnostics, "ng-annotationless.ts")).toEqual([
      annotationlessMessage("obj"),
      annotationlessMessage("arr"),
    ]);
  });

  test("'as' assertions on literals are ignored", () => {
    expect(messagesFor(allowAsDiagnostics, "ng-as.ts")).toEqual([]);
  });

  test("empty literals are allowed by default", () => {
    expect(messagesFor(allowAsDiagnostics, "ng-empty.ts")).toEqual([]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(allowAsDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(allowAsDiagnostics.length).toBe(4);
  });
});

describe("allowEmptyLiteral: false", () => {
  test("empty literals fall back to the standard messages", () => {
    expect(messagesFor(emptyStrictDiagnostics, "ng-empty.ts")).toEqual([
      annotationlessMessage("emptyObj"),
      annotationlessMessage("emptyArr"),
      annotatedMessage("annotatedEmptyObj"),
      annotatedMessage("annotatedEmptyArr"),
      asAssertionMessage("asEmptyObj"),
      asAssertionMessage("asEmptyArr"),
      asAssertionMessage("chainedEmptyObj"),
    ]);
  });

  test("non-empty literals are reported as usual", () => {
    expect(messagesFor(emptyStrictDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
    expect(messagesFor(emptyStrictDiagnostics, "ng-annotationless.ts")).toEqual(
      [annotationlessMessage("obj"), annotationlessMessage("arr")],
    );
    expect(messagesFor(emptyStrictDiagnostics, "ng-as.ts")).toEqual([
      asAssertionMessage("origin"),
      asAssertionMessage("nums"),
      asAssertionMessage("forced"),
      asAssertionMessage("forcedArr"),
    ]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(emptyStrictDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(emptyStrictDiagnostics.length).toBe(15);
  });
});

describe("allowEmptyLiteral: { message }", () => {
  test("empty literals are reported with the custom message", () => {
    expect(messagesFor(emptyMessageDiagnostics, "ng-empty.ts")).toEqual([
      emptyCustomMessage,
      emptyCustomMessage,
      emptyCustomMessage,
      emptyCustomMessage,
      emptyCustomMessage,
      emptyCustomMessage,
      emptyCustomMessage,
    ]);
  });

  test("non-empty literals keep their standard messages", () => {
    expect(messagesFor(emptyMessageDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
    expect(messagesFor(emptyMessageDiagnostics, "ng-as.ts")).toEqual([
      asAssertionMessage("origin"),
      asAssertionMessage("nums"),
      asAssertionMessage("forced"),
      asAssertionMessage("forcedArr"),
    ]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(emptyMessageDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(emptyMessageDiagnostics.length).toBe(15);
  });
});
