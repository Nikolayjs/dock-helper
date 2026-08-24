/** id of the AppShell root element — with `mode="static"` it's the actual scrolling container
 * (header/navbar become `position: sticky` inside it instead of `position: fixed` to the
 * viewport), so anything that used to track/control `window` scroll must target this element
 * instead. Shared between AppLayout (route-change scroll reset) and ScrollToTopButton. */
export const SCROLL_ROOT_ID = 'app-shell-scroll-root';
