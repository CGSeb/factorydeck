import {
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';
import { type SelectOption, useSelect } from './select-state.ts';
import './controls.css';

export type { SelectOption } from './select-state.ts';

export type SelectAlign = 'start' | 'end';

export interface SelectProps<T extends string> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  id?: string;
  ariaLabel?: string;
  labelId?: string;
  title?: string;
  className?: string;
  align?: SelectAlign;
  defaultOpen?: boolean | undefined;
  onClose?: (() => void) | undefined;
}

function Chevron(): ReactElement {
  return (
    <svg
      className="fd-select-chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check(): ReactElement {
  return (
    <svg
      className="fd-select-check"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 7.5 5.8 10 11 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SelectItem<T extends string>({
  id,
  index,
  option,
  active,
  selected,
  onActive,
  onChoose,
}: {
  id: string;
  index: number;
  option: SelectOption<T>;
  active: boolean;
  selected: boolean;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
}): ReactElement {
  return (
    <li
      id={id}
      role="option"
      data-index={index}
      data-value={option.value}
      data-active={active}
      aria-selected={selected}
      className="fd-select-option"
      onPointerDown={(event) => {
        event.preventDefault();
      }}
      onPointerMove={() => {
        if (!active) onActive(index);
      }}
      onClick={() => {
        onChoose(index);
      }}
    >
      <span className="fd-select-option-label">{option.label}</span>
      <Check />
    </li>
  );
}

function SelectList<T extends string>({
  id,
  optionId,
  labelProps,
  options,
  active,
  selectedIndex,
  onActive,
  onChoose,
}: {
  id: string;
  optionId: (index: number) => string;
  labelProps: { 'aria-label'?: string; 'aria-labelledby'?: string };
  options: readonly SelectOption<T>[];
  active: number;
  selectedIndex: number;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
}): ReactElement {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${String(active)}"]`,
    );
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      {...labelProps}
      className="fd-select-list"
      tabIndex={-1}
    >
      {options.map((option, index) => (
        <SelectItem
          key={option.value}
          id={optionId(index)}
          index={index}
          option={option}
          active={index === active}
          selected={index === selectedIndex}
          onActive={onActive}
          onChoose={onChoose}
        />
      ))}
    </ul>
  );
}

function listLabel(
  ariaLabel: string | undefined,
  labelId: string,
): { 'aria-label'?: string; 'aria-labelledby'?: string } {
  return ariaLabel === undefined
    ? { 'aria-labelledby': labelId }
    : { 'aria-label': ariaLabel };
}

function useOpenLifecycle(
  open: boolean,
  defaultOpen: boolean,
  onClose: (() => void) | undefined,
): RefObject<HTMLButtonElement | null> {
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (defaultOpen) trigger.current?.focus();
  }, [trigger, defaultOpen]);
  useEffect(() => {
    if (wasOpen.current && !open) onClose?.();
    wasOpen.current = open;
  }, [open, onClose]);
  return trigger;
}

/**
 * A select-only combobox (WAI-ARIA APG pattern): focus stays on the trigger
 * and the active option is announced through `aria-activedescendant`.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  id,
  ariaLabel,
  labelId,
  title,
  className = 'fd-control fd-select-trigger',
  align = 'start',
  defaultOpen = false,
  onClose,
}: SelectProps<T>): ReactElement {
  const ownId = useId();
  const triggerId = id ?? ownId;
  const select = useSelect(options, value, onChange, defaultOpen);
  const { rootRef, listId, optionId, open, active } = select;
  const trigger = useOpenLifecycle(open, defaultOpen, onClose);

  return (
    <div ref={rootRef} className="fd-select" data-align={align}>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        className={className}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        data-value={value}
        title={title}
        onClick={select.toggle}
        onKeyDown={select.onKeyDown}
        onBlur={select.close}
      >
        <span className="fd-select-value">
          {options[select.selectedIndex]?.label}
        </span>
        <Chevron />
      </button>
      {open ? (
        <SelectList
          id={listId}
          optionId={optionId}
          labelProps={listLabel(ariaLabel, labelId ?? triggerId)}
          options={options}
          active={active}
          selectedIndex={select.selectedIndex}
          onActive={select.setActive}
          onChoose={select.choose}
        />
      ) : null}
    </div>
  );
}
