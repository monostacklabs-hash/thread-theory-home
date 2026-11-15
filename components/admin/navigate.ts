/**
 * Full-page navigations for the admin area. The pages are static files, so
 * moving between signed-in and signed-out states needs a real load, not a
 * client-side route change. Kept in one place so tests can stub it.
 */

export function replaceLocation(url: string): void {
  window.location.replace(url);
}

export function assignLocation(url: string): void {
  window.location.assign(url);
}
