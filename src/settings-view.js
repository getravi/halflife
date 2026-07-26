/**
 * Export and account deletion. Both files are produced in the browser from one
 * export response, so there is a single endpoint and a single shape to keep in
 * step with the schema.
 */
import { API } from './api.js';
import { buildMarkdown } from './export-markdown.js';

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function renderSettings(ctx, me) {
  const status = document.getElementById('export-status');

  async function grab() {
    status.textContent = 'Preparing…';
    try {
      const data = await API.getExport();
      status.textContent = '';
      return data;
    } catch {
      // Exporting the cache would produce a file that looks like a backup and
      // is not one, so this fails loudly instead.
      status.textContent = 'Could not reach the server. Nothing was downloaded.';
      return null;
    }
  }

  document.getElementById('export-json').addEventListener('click', async () => {
    const data = await grab();
    if (!data) return;
    download(`${ctx.pathId}-export-${stamp()}.json`,
      JSON.stringify(data, null, 2), 'application/json');
  });

  document.getElementById('export-md').addEventListener('click', async () => {
    const data = await grab();
    if (!data) return;
    download(`${ctx.pathId}-export-${stamp()}.md`,
      buildMarkdown(data, ctx.path), 'text/markdown');
  });

  // Typing the login rather than a second click. A two-step confirm is
  // proportionate for one card; for an action that destroys a year of
  // hand-written cards and cascades through four tables it is too cheap.
  const input = document.getElementById('delete-confirm');
  const button = document.getElementById('delete-account');
  const login = me.user?.login ?? '';

  input.addEventListener('input', () => {
    button.disabled = input.value !== login;
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Deleting…';
    await API.deleteAccount();
    // Queued writes reference rows that no longer exist, so flushing them
    // later could only produce 404s. Drop them with the account.
    API.clearOutbox();
    // Sessions cascade from users, so the session is already gone.
    window.location.href = '/';
  });
}
