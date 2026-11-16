import { type RefObject, useEffect } from 'react';
import { Platform, type ScrollView } from 'react-native';

/** How far the mouse moves before a press becomes a drag, so a click still clicks. */
const DRAG_THRESHOLD_PX = 4;
/** Pixels in a wheel "line", for mice that report lines rather than pixels. */
const WHEEL_LINE_PX = 16;

/**
 * Lets a mouse scroll a horizontal `ScrollView` on the web. With its scrollbar
 * hidden, a sideways strip there only moves with a trackpad's sideways swipe or
 * a finger: a mouse wheel scrolls the page past it, and dragging does nothing.
 *
 * - The wheel scrolls the strip sideways while it has further to go that way,
 *   then hands back to the page, so the strip never traps the page's scroll.
 * - A press dragged past a few pixels pans the strip, and the click that ends
 *   the drag is swallowed, so a drag over a tab does not also pick it.
 *
 * Native swipes already; this does nothing there.
 */
export function useWebHorizontalScroll(ref: RefObject<ScrollView | null>) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: HTMLElement | undefined = ref.current?.getScrollableNode?.();
    if (!node || typeof node.addEventListener !== 'function') return;

    const maxScroll = () => node.scrollWidth - node.clientWidth;

    const onWheel = (event: WheelEvent) => {
      // Pinch-zoom, or a sideways swipe the browser already scrolls.
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = maxScroll();
      if (max <= 0) return;
      const delta =
        event.deltaMode === 1
          ? event.deltaY * WHEEL_LINE_PX
          : event.deltaMode === 2
            ? event.deltaY * node.clientWidth
            : event.deltaY;
      // At either end the page takes the scroll.
      if ((delta < 0 && node.scrollLeft <= 0) || (delta > 0 && node.scrollLeft >= max - 1)) return;
      event.preventDefault();
      node.scrollLeft = Math.min(max, Math.max(0, node.scrollLeft + delta));
    };

    let drag: { pointerId: number; startX: number; startLeft: number; dragging: boolean } | null =
      null;
    let swallowClick = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || maxScroll() <= 0) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startLeft: node.scrollLeft,
        dragging: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      if (!drag.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        drag.dragging = true;
        node.setPointerCapture(event.pointerId);
        node.style.cursor = 'grabbing';
        node.style.userSelect = 'none';
      }
      node.scrollLeft = drag.startLeft - dx;
    };

    const endDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.dragging) {
        swallowClick = true;
        // No click follows a cancelled or off-strip release: don't eat the next real one.
        setTimeout(() => {
          swallowClick = false;
        }, 0);
        if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
        node.style.cursor = '';
        node.style.userSelect = '';
      }
      drag = null;
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    // The browser's own image drag would take the pointer away mid-pan.
    const onDragStart = (event: DragEvent) => event.preventDefault();

    // Pointer events in the capture phase, so the strip sees a drag that starts
    // on a tab whatever the tab's own handlers do with the event.
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onPointerDown, true);
    node.addEventListener('pointermove', onPointerMove, true);
    node.addEventListener('pointerup', endDrag, true);
    node.addEventListener('pointercancel', endDrag, true);
    node.addEventListener('click', onClickCapture, true);
    node.addEventListener('dragstart', onDragStart);

    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onPointerDown, true);
      node.removeEventListener('pointermove', onPointerMove, true);
      node.removeEventListener('pointerup', endDrag, true);
      node.removeEventListener('pointercancel', endDrag, true);
      node.removeEventListener('click', onClickCapture, true);
      node.removeEventListener('dragstart', onDragStart);
    };
  }, [ref]);
}
