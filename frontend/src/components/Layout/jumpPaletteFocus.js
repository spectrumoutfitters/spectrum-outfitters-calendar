/**
 * Returns the element that should receive focus when Tab navigation reaches a
 * dialog boundary. A null return lets the browser handle normal Tab movement.
 *
 * @template T
 * @param {T[]} focusableElements
 * @param {T | null} activeElement
 * @param {boolean} shiftKey
 * @returns {T | null}
 */
export function getTabWrapTarget(focusableElements, activeElement, shiftKey) {
  if (!Array.isArray(focusableElements) || focusableElements.length === 0) return null;
  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null;
}

/**
 * Restores focus on the next animation frame, provided the opening control is
 * still attached. Returns a cleanup function suitable for a React effect.
 *
 * @param {{ focus: () => void } | null} element
 * @param {{
 *   requestFrame?: (callback: () => void) => number,
 *   cancelFrame?: (id: number) => void,
 *   contains?: (element: object) => boolean,
 * }} [dependencies]
 * @returns {() => void}
 */
export function scheduleFocusRestore(
  element,
  {
    requestFrame = (callback) => window.requestAnimationFrame(callback),
    cancelFrame = (id) => window.cancelAnimationFrame(id),
    contains = (candidate) => document.contains(candidate),
  } = {},
) {
  if (!element) return () => {};
  const frameId = requestFrame(() => {
    try {
      if (contains(element)) element.focus();
    } catch {
      // A removed or otherwise unfocusable opener should not break closing.
    }
  });
  return () => cancelFrame(frameId);
}
