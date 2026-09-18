/** Path gates for employee FABs (chat / quick notify / clock / inventory scan). */

export function isPublicCustomerPath(pathname) {
  const path = String(pathname || '').toLowerCase();
  return (
    path === '/book' ||
    path === '/new-client' ||
    path === '/new-customer' ||
    path === '/quote' ||
    path.startsWith('/pay/')
  );
}

export function shouldShowClockFab(pathname) {
  const path = String(pathname || '').toLowerCase();
  return path !== '/login' && !path.startsWith('/status') && path !== '/dispatch';
}

export function isInventoryPath(pathname, search = '') {
  const path = String(pathname || '').toLowerCase();
  const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab');
  const onAdminInventory = path.includes('admin') && tab === 'inventory';
  return path.includes('inventory') || onAdminInventory;
}
