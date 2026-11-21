import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router';
import './styles.css';

export function Layout(): ReactElement {
  return (
    <>
      <header className="topbar">
        <span className="brand">FactoryDeck</span>
        <nav aria-label="Sections">
          <ul>
            <li>
              <NavLink to="/" end>
                Overview
              </NavLink>
            </li>
            <li>
              <NavLink to="/sessions">Sessions</NavLink>
            </li>
            <li>
              <NavLink to="/skills">Skills</NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
