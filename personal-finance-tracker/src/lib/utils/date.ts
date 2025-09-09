export function formatCurrency(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

export function formatEur(n: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n);
}
