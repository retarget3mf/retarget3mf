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
      // "Download STL/CAD Files" sits two levels deeper, next to an info icon (markup seen 2026-10-20 evening).
      const row = (t) => t === 'Download STL/CAD Files'
        ? '<div class="menu-row sub_download"><div class="MuiStack-root" style="display:flex;justify-content:center;gap:6px"><span>' + t + '</span><div aria-label="STL files are generated from the print profile"><svg width="14" height="14"><circle cx="7" cy="7" r="6" stroke="#aaa" fill="none"/></svg></div></div></div>'
        : '<div class="menu-row">' + t + '</div>';
      popper.innerHTML = '<div style="background:#252525;border:1px solid #444;border-radius:8px;width:480px;padding:4px"><div class="rows">' +
        ${JSON.stringify(rows)}.map(row).join('') + '</div></div>';
      popper.querySelectorAll('.menu-row').forEach((r) => r.addEventListener('click', () => { closeMenu(); if (r.textContent.trim() === 'Open in Bambu Studio') openInStudio(); }));
      document.getElementById('mount').append(popper);
    });
    document.body.addEventListener('click', closeMenu);
  </script></body></html>`;
}

/** Creality Cloud (2026-10-20): "Download 3MF" + chevron; the list holds "Open in Creality Print", which clicks a hidden crealityprintlink:// link. */
export function fakeCrealityPage(signedUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#fff;font:16px system-ui;padding:24px">
  <div class="action-btn-box"><div class="all-operate-btn" style="display:flex;width:420px;background:#17cc5f;border-radius:8px">
    <div class="operate-box" style="flex:1;padding:12px;text-align:center">Download 3MF</div><div class="choose-operate" style="padding:12px;cursor:pointer">▾</div></div></div>
  <script>
    document.querySelector('.choose-operate').addEventListener('click', () => {
      if (document.querySelector('.operate-box-list')) return;
      const list = document.createElement('div');
      list.className = 'operate-box-list';
      for (const t of ['Download 3MF', 'View STL/CAD Files', 'Open in Creality Print']) {
        const row = document.createElement('div'); row.className = 'open operate-item'; row.style.cssText = 'padding:10px;width:400px;cursor:pointer'; row.textContent = t;
        if (t === 'Open in Creality Print') row.addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = 'crealityprintlink://open?file=' + encodeURIComponent(${JSON.stringify(signedUrl)}) + '&name=' + encodeURIComponent('Skip Bo Case') + '&code=SECRET&lang=en';
          a.click();
        });
        list.append(row);
      }
      document.querySelector('.action-btn-box').append(list);
    });
  </script></body></html>`;
}

/** Snapmaker Space (2026-10-20): a role="menu" of icon buttons; "Open in Snapmaker Orca" assigns location.href. */
export function fakeSnapmakerPage(signedUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#111;color:#eee;font:16px system-ui;padding:24px">
  <div style="display:flex;width:420px"><button type="button" style="flex:1">Download 3MF</button><button type="button" aria-haspopup="menu" id="more">▾</button></div>
  <div id="mount"></div>
  <script>
    document.getElementById('more').addEventListener('click', () => {
      const menu = document.createElement('div'); menu.setAttribute('role', 'menu');
      for (const t of ['Download 3MF', 'Open in Snapmaker Orca']) {
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.style.cssText = 'display:block;width:420px;padding:10px';
        b.innerHTML = '<svg width="12" height="12"></svg>' + t;
        if (t === 'Open in Snapmaker Orca') b.addEventListener('click', async () => {
          await new Promise((r) => setTimeout(r, 30));
          window.location.href = 'snapmaker-orca://open?' + new URLSearchParams({ file: ${JSON.stringify(signedUrl)}, name: 'Jumping Spider' });
        });
        menu.append(b);
      }
      document.getElementById('mount').replaceChildren(menu);
    });
  </script></body></html>`;
}

/**
 * Printables (2026-10-20): each file row (.download-item with a type .badge) has a "Slice" chevron that mounts a
 * floating role="menu" outside the row. "Open in PrusaSlicer" first shows a "PrusaSlicer Integration" dialog whose
 * "Open file in PrusaSlicer" button clicks a prusaslicer://open?file=<enc url> link.
 */
export function fakePrintablesPage(fileUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#1d1d1d;color:#eee;font:16px system-ui;padding:24px">
  ${['3mf', 'stl'].map((t) => `<div class="download-item" style="display:flex;gap:12px;width:520px;padding:8px">
    <div class="shrink">model_${t}</div><span class="badge">${t}</span>
    <div class="slicer-download-wrapper"><button class="btn slicer-download">Slice</button><div class="toggle" data-type="${t}" style="cursor:pointer">⌄</div></div></div>`).join('')}
  <div id="floating"></div>
  <script>
    function dialog() {
      const d = document.createElement('div'); d.setAttribute('role', 'dialog');
      d.innerHTML = '<h3>PrusaSlicer Integration</h3><p>Open 3D models automatically in PrusaSlicer.</p><button class="btn btn-primary">Open file in PrusaSlicer</button><label><input type="checkbox"> Don\\'t show this again</label>';
      d.querySelector('button').addEventListener('click', () => {
        const a = document.createElement('a'); a.href = 'prusaslicer://open?file=' + encodeURIComponent(${JSON.stringify(fileUrl)}); a.click(); d.remove();
      });
      document.body.append(d);
    }
    document.querySelectorAll('.toggle').forEach((t) => t.addEventListener('click', () => {
      const menu = document.createElement('div'); menu.setAttribute('role', 'menu'); menu.className = 'dropdown-menu';
      for (const s of ['PrusaSlicer', 'OrcaSlicer', 'Ultimaker Cura', 'Bambu Studio']) {
        const b = document.createElement('button'); b.className = 'btn slicer-option-button'; b.style.cssText = 'display:block;width:200px';
        b.innerHTML = '<img alt="" width="12" height="12">Open in ' + s;
        if (s === 'PrusaSlicer') b.addEventListener('click', () => { document.getElementById('floating').replaceChildren(); dialog(); });
        menu.append(b);
      }
      document.getElementById('floating').replaceChildren(menu);
    }));
  </script></body></html>`;
}
