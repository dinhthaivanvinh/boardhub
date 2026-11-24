'use client';

import { useEffect } from 'react';

/**
 * On a big screen, a board screen fills the window and does not scroll as a page: the board stays exactly
 * where it is and only the side panel scrolls (globals.css, `.board-stage`). Render it inside such a screen.
 */
export function BoardStage() {
  useEffect(() => {
    document.documentElement.classList.add('board-stage');
    return () => document.documentElement.classList.remove('board-stage');
  }, []);
  return null;
}
