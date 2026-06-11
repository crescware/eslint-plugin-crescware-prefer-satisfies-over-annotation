# @crescware/eslint-plugin-crescware-prefer-satisfies-over-annotation

An [oxlint](https://oxc.rs/docs/guide/usage/linter) JS plugin that prefers `satisfies` over a binding type annotation for object and array literals.

## Rule: `prefer-satisfies-over-annotation`

A `const` whose initializer is a plain object or array literal should declare its type with `satisfies`, not with a binding annotation. `satisfies` keeps excess-property checking strict while preserving the literal's narrow inferred type, instead of widening it to the annotation.

```ts
// NG: a type annotation on the literal (always reported)
const obj: Something = { ... };
const arr: Something[] = [ ... ];

// NG: a literal with no declared type (reported unless `allowWithoutAnnotation` is enabled)
const obj = { ... };
const arr = [ ... ];

// OK
const obj = { ... } satisfies Something;
const arr = [ ... ] satisfies Something[];
```

### Scope

The rule fires only when the initializer is a plain object or array literal (`ObjectExpression` / `ArrayExpression`). Object and array literals are treated the same.

- With a type annotation (`const x: T = {}`): always reported.
- Without a type annotation (`const x = {}`): reported by default, ignored when `allowWithoutAnnotation` is `true`.
- Out of scope: initializers that are not plain object/array literals — `const x = {} satisfies T`, `const x = {} as T`, `const x = {} as const`, `const v: unknown = JSON.parse(...)`, `const n: number = 1`.
- Out of scope: `let` / `var` declarations.

The rule does not autofix; it reports only.

### Options

```jsonc
"crescware-prefer-satisfies-over-annotation/prefer-satisfies-over-annotation": [
  "error",
  {
    // false (default): a literal without a type annotation is reported.
    // true: only annotated literals are reported; annotationless ones pass.
    "allowWithoutAnnotation": false
  }
]
```

| Option                   | Type      | Default | Effect                                                                                                            |
| ------------------------ | --------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `allowWithoutAnnotation` | `boolean` | `false` | When `true`, suppresses reports for literals that have no type annotation. Annotated literals are still reported. |

## Usage

Register the plugin in your `.oxlintrc.json` and enable the rule:

```json
{
  "jsPlugins": [
    "@crescware/eslint-plugin-crescware-prefer-satisfies-over-annotation"
  ],
  "rules": {
    "crescware-prefer-satisfies-over-annotation/prefer-satisfies-over-annotation": "error"
  }
}
```

## Stack

- **Runtime**: Node.js 24 (via [mise](https://mise.jdx.dev/))
- **Package manager**: pnpm (via corepack)
- **Language**: TypeScript ([native preview](https://github.com/microsoft/typescript-go))
- **Test**: [Vitest](https://vitest.dev/)
- **Lint**: [oxlint](https://oxc.rs/docs/guide/usage/linter)
- **Format**: [oxfmt](https://github.com/oxc-project/oxc)
- **Unused code**: [Knip](https://knip.dev/)

## Setup

```sh
mise install
corepack enable
pnpm install
```

## Scripts

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm build`       | Compile `src` to `dist`                  |
| `pnpm check`       | Run all checks (types, lint, knip, test) |
| `pnpm check:types` | Type check                               |
| `pnpm check:lint`  | Lint and format check                    |
| `pnpm check:knip`  | Unused files/exports check               |
| `pnpm test`        | Run fixture integration tests            |
| `pnpm format`      | Fix lint and format                      |
