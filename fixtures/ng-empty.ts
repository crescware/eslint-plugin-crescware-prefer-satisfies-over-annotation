// Empty literals are unusable with `satisfies` (`[] satisfies T` infers
// `never[]`, `{} satisfies T` infers `{}`), so they are allowed by default.
// With `allowEmptyLiteral: false` they fall back to the standard messages; with
// `allowEmptyLiteral: { message }` they are reported with that custom message.

// No annotation.
const emptyObj = {};
const emptyArr = [];

// Type annotation.
const annotatedEmptyObj: Record<string, number> = {};
const annotatedEmptyArr: number[] = [];

// `as` assertion, including a multi-step `as` chain.
const asEmptyObj = {} as Record<string, number>;
const asEmptyArr = [] as number[];
const chainedEmptyObj = {} as unknown as Record<string, number>;
