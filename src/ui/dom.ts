/** Typed getElementById for extension pages, where the id is known to exist. */
export function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}
