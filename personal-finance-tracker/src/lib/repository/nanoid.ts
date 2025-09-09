let counter = 0;
export function nanoid(prefix = ''): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${counter}`;
}

