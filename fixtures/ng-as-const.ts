// `as const` on a non-empty literal freezes the type but declares no type to
// check against, so by default it is reported -- for both objects and arrays.
// Allowed only when the `allowAsConst` option is enabled. (`{} as const` is
// empty, so it follows the `allowEmptyLiteral` policy instead and is covered by
// ng-empty.ts, not here.)
const frozen = { a: 1 } as const;
const frozenArr = [1, 2, 3] as const;
