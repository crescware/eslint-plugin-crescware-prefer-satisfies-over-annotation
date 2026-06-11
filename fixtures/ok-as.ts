// `as const` freezes the literal type and is categorically different from
// `as T`, so it stays allowed -- for both objects and arrays.
const frozen = { a: 1 } as const;
const frozenArr = [1, 2, 3] as const;

// `as` on a non-literal: the root of the `as` chain is a CallExpression, not a
// `{}` / `[]` literal, so it is out of scope.
const parsed = JSON.parse("{}") as { a: number };
