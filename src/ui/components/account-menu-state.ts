import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

const GAP = 8;

function placeMenu(
  button: HTMLElement,
  folded: boolean,
): CSSProperties | undefined {
  const rect = button.getBoundingClientRect();
  const fromBottom = window.innerHeight - rect.bottom;
  const edge =
    button.closest('.fd-sidebar')?.getBoundingClientRect().right ?? rect.right;
  return folded
    ? { left: Math.max(edge, rect.right) + GAP, bottom: fromBottom }
    : {
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + GAP,
      };
}

export function useMenuPlace(
  open: boolean,
  folded: boolean,
  button: RefObject<HTMLButtonElement | null>,
): CSSProperties | undefined {
  const [place, setPlace] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!open) return undefined;
    function update(): void {
      if (button.current !== null) {
        setPlace(placeMenu(button.current, folded));
      }
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, folded, button]);
  return place;
}

export function useDismiss(
  open: boolean,
  root: RefObject<HTMLDivElement | null>,
  onEscape: () => void,
  onOutside: () => unknown,
): void {
  useEffect(() => {
    if (!open) return undefined;
    function keydown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onEscape();
    }
    function pointerdown(event: PointerEvent | MouseEvent): void {
      if (event.target instanceof Node && root.current?.contains(event.target))
        return;
      onOutside();
    }
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointerdown', pointerdown, true);
    document.addEventListener('mousedown', pointerdown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('pointerdown', pointerdown, true);
      document.removeEventListener('mousedown', pointerdown, true);
    };
  }, [open, root, onEscape, onOutside]);
}
