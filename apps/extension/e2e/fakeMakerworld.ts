/**
 * Stand-in for a makerworld.com model page, mirroring the markup and behaviour observed on 2026-10-20:
 * a green main button plus a chevron that mounts a MUI popper menu; "Open in Bambu Studio" fetches a signed URL,
 * then clicks a hidden <a href="bambustudio://open?file=…">. Logged in, "Download 3MF" is the main button.
 */
export function fakeMakerworldPage(signedUrl: string, loggedIn: boolean, confirmDialog = false): string {
  const main = loggedIn ? 'Download 3MF' : 'Open in Bambu Studio';
  const rows = loggedIn ? ['Open in Bambu Studio', 'Download STL/CAD Files'] : ['Download 3MF', 'Download STL/CAD Files'];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { background: #1e1e1e; color: #ddd; font: 16px system-ui; padding: 24px; }
    .bar { display: flex; background: #5bbd31; border-radius: 8px; width: 480px; color: #111; font-weight: 700; }
    .primaryButton { flex: 1; text-align: center; padding: 14px; cursor: pointer; }
    .icon-box { padding: 14px; cursor: pointer; border-left: 1px solid #0003; }
    .menu-row { padding: 12px; text-align: center; cursor: pointer; border-radius: 8px; }
    .menu-row:hover { background: #333; }
    .dialog { position: fixed; inset: 80px auto auto 80px; width: 440px; background: #262626; border-radius: 10px; padding: 24px; color: #eee; }
    .dialog h2 { margin: 0 0 16px; } .import { background: #5bbd31; color: #111; font-weight: 700; padding: 14px; text-align: center; cursor: pointer; }
  </style></head><body>
  <div class="bar"><span class="primaryButton"><div><span>${main}</span></div></span><div class="icon-box">⌄</div></div>
  <div id="mount"></div>
  <script>
    window.studioOpened = [];
    async function openInStudio() {
      if (${confirmDialog} && !window.confirmed) {
        const d = document.createElement('div');
        d.className = 'dialog'; d.setAttribute('role', 'dialog');
        d.innerHTML = '<h2>Import into Bambu Studio</h2><div><div class="import">Import into Bambu Studio</div></div><p>Do not show this again</p>';
        d.querySelector('.import').addEventListener('click', () => { window.confirmed = true; d.remove(); openInStudio(); });
        document.body.append(d);
        return;
      }
      await new Promise((r) => setTimeout(r, 30));
      const a = document.createElement('a');
      a.href = 'bambustudio://open?file=' + encodeURIComponent(${JSON.stringify(signedUrl)} + '&name=Test_Cube');
      document.body.appendChild(a); window.studioOpened.push(a.href); a.click(); a.remove();
    }
    function closeMenu() { document.getElementById('mount').replaceChildren(); }
    document.querySelector('.primaryButton').addEventListener('click', () => ${loggedIn ? '0' : 'openInStudio()'});
    document.querySelector('.icon-box').addEventListener('click', (e) => {
      e.stopPropagation();
      const popper = document.createElement('div');
      popper.className = 'MuiPopper-root'; popper.setAttribute('role', 'tooltip');
      popper.innerHTML = '<div style="background:#252525;border:1px solid #444;border-radius:8px;width:480px;padding:4px"><div class="rows">' +
        ${JSON.stringify(rows)}.map((t) => '<div class="menu-row">' + t + '</div>').join('') + '</div></div>';
      popper.querySelectorAll('.menu-row').forEach((r) => r.addEventListener('click', () => { closeMenu(); if (r.textContent === 'Open in Bambu Studio') openInStudio(); }));
      document.getElementById('mount').append(popper);
    });
    document.body.addEventListener('click', closeMenu);
  </script></body></html>`;
}
