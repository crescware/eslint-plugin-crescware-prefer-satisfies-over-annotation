type Point = { x: number; y: number };

// Single `as` on a literal.
const origin = { x: 0, y: 0 } as Point;
const nums = [1, 2, 3] as number[];

// Multiple `as` on a non-empty literal: still reported -- the literal sits at
// the root of the `as` chain.
const forced = { x: 1, y: 2 } as unknown as Point;
const forcedArr = [1, 2] as unknown as number[];
