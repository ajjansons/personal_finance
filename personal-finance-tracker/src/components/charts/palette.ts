export const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ab', '#6b5b95', '#88b04b',
  '#f6c85f', '#7b6888'
];

export function colorAt(i: number) {
  return PALETTE[i % PALETTE.length];
}
