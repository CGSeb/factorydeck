import {
  type MouseEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useDialogFocus } from './dialog-focus.ts';
import { Icon } from './Icon.tsx';
import {
  useAfterPointer,
  useFold,
  useNarrow,
  useScrollLock,
  useTip,
} from './sidebar-state.ts';
import {
  Brand,
  NO_TIP,
  SidebarPanel,
  type SidebarProject,
  type SidebarProps,
  SidebarTip,
  type TipFor,
} from './SidebarPanel.tsx';

export type {
  ProjectSlotControl,
  SidebarLink,
  SidebarProject,
  SidebarProps,
  SidebarRefresh,
} from './SidebarPanel.tsx';

function useFocusAfterPeek(
  peeking: boolean,
  target: RefObject<HTMLButtonElement | null>,
): void {
  const peeked = useRef(false);
  useEffect(() => {
    if (peeking) {
      peeked.current = true;
      return;
    }
    if (!peeked.current) return;
    peeked.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) target.current?.focus();
  }, [peeking, target]);
}

function FoldedProject({
  project,
  button,
  onPeek,
  tipFor,
}: {
  project: SidebarProject;
  button: RefObject<HTMLButtonElement | null>;
  onPeek: () => void;
  tipFor: TipFor;
}): ReactElement {
  const name = `Project: ${project.label}`;
  return (
    <div className="fd-sidebar-project">
      <button
        ref={button}
        type="button"
        className="fd-control fd-sidebar-icon-button"
        aria-label={name}
        onClick={onPeek}
        {...tipFor(name)}
      >
        <Icon name="project" />
      </button>
    </div>
  );
}

function FoldButton({
  controls,
  folded,
  onClick,
  tipFor,
}: {
  controls: string;
  folded: boolean;
  onClick: () => void;
  tipFor: TipFor;
}): ReactElement {
  const name = folded ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <button
      type="button"
      className="fd-control fd-sidebar-icon-button fd-sidebar-fold"
      aria-label={name}
      aria-expanded={!folded}
      aria-controls={controls}
      onClick={onClick}
      {...(folded ? tipFor(name) : {})}
    >
      <Icon name={folded ? 'expand' : 'collapse'} />
    </button>
  );
}

function WideSidebar(props: SidebarProps): ReactElement {
  const id = useId();
  const [folded, toggle] = useFold();
  const [peeking, setPeeking] = useState(false);
  const afterPointer = useAfterPointer();
  const projectButton = useRef<HTMLButtonElement>(null);
  useFocusAfterPeek(peeking, projectButton);
  const { tip, tipFor } = useTip();
  const shownFolded = folded && !peeking;
  const { project } = props;
  const projectSlot =
    project === undefined ? null : shownFolded ? (
      <FoldedProject
        project={project}
        button={projectButton}
        onPeek={() => {
          setPeeking(true);
        }}
        tipFor={tipFor}
      />
    ) : (
      <div className="fd-sidebar-project">
        {project.render({
          defaultOpen: peeking,
          onClose: peeking
            ? () => {
                afterPointer(() => {
                  setPeeking(false);
                });
              }
            : undefined,
        })}
      </div>
    );
  return (
    <>
      <SidebarPanel
        {...props}
        id={id}
        folded={shownFolded}
        tipFor={shownFolded ? tipFor : NO_TIP}
        projectSlot={projectSlot}
        bottom={
          <FoldButton
            controls={id}
            folded={shownFolded}
            onClick={() => {
              if (peeking) setPeeking(false);
              else toggle();
            }}
            tipFor={tipFor}
          />
        }
      />
      {shownFolded && <SidebarTip tip={tip} />}
    </>
  );
}

function closeOnLink(onClose: () => void) {
  return (event: MouseEvent<HTMLElement>): void => {
    if (event.target instanceof Element && event.target.closest('a[href]')) {
      onClose();
    }
  };
}

function Drawer({
  id,
  onClose,
  ...props
}: SidebarProps & { id: string; onClose: () => void }): ReactElement {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useDialogFocus(onClose, dialog);
  useScrollLock();
  const { project } = props;
  return (
    <div
      className="fd-drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        id={id}
        className="fd-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        onClick={closeOnLink(onClose)}
      >
        <SidebarPanel
          {...props}
          folded={false}
          tipFor={NO_TIP}
          top={
            <button
              ref={close}
              type="button"
              className="fd-control fd-sidebar-icon-button"
              aria-label="Close navigation"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          }
          projectSlot={
            project === undefined ? null : (
              <div className="fd-sidebar-project">
                {project.render({ defaultOpen: false, onClose: undefined })}
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

function NarrowNavigation(props: SidebarProps): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  return (
    <>
      <header className="fd-mobilebar">
        <button
          ref={menu}
          type="button"
          className="fd-control fd-sidebar-icon-button"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => {
            setOpen(true);
          }}
        >
          <Icon name="menu" />
        </button>
        <Brand folded={false} />
      </header>
      {open && (
        <Drawer
          {...props}
          id={id}
          onClose={() => {
            setOpen(false);
            menu.current?.focus();
          }}
        />
      )}
    </>
  );
}

export function Sidebar(props: SidebarProps): ReactElement {
  return useNarrow() ? (
    <NarrowNavigation {...props} />
  ) : (
    <WideSidebar {...props} />
  );
}
