/** Trailing-edge debounce: fires once, with the latest arguments, after calls stop. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: number | undefined
  return (...args: A) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), waitMs)
  }
}
