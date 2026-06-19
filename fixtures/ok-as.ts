// `as` on a non-literal: the root of the `as` chain is a CallExpression, not a
// `{}` / `[]` literal, so it is out of scope.
const parsed = JSON.parse("{}") as { a: number };
