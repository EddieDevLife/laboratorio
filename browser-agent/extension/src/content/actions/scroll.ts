export function scrollBy(deltaX: number, deltaY: number): void {
  window.scrollBy({ left: deltaX, top: deltaY, behavior: 'smooth' });
}

export function scrollElementIntoView(el: HTMLElement): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
