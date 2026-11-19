# Noting Desk – iPhone app + office PC, synced offline

Noting Desk is the offline office tool for notings, circulars and manuals, office orders, e-mails and replies, the work diary, the IBB calculator, history, sports calendar, Member ID and rejection reasons, and learned templates.

This repository turns it into:

| | What | Where |
|---|---|---|
| 📱 **iPhone app** | Installs from Safari to the Home Screen and then runs **fully offline**. Every module is included, with a phone layout: 4 main tabs, a **More** sheet with all tools, dark mode and share-to-Files. | `docs/index.html`, served by GitHub Pages |
| 🖥️ **Office PC file** | The same `Noting_Desk.html` you use today, plus a **🔄 Sync** button. Nothing else changes. | `docs/Noting_Desk.html` (or **Sync ▸ Save Noting_Desk.html** inside the iPhone app) |

The office PC needs **no internet**. Your data never goes to GitHub or any server; it stays in the PC's browser and on the iPhone. GitHub only hosts the app code.

---

## 1. Put the app online (one time, about 2 minutes)

1. On GitHub, open **Settings ▸ General** for this repository and make sure it is **Public**. GitHub Pages is free only for public repositories, and only the app code is in here, never your data.
2. Open **Settings ▸ Pages**. Under **Build and deployment**, set **Source = Deploy from a branch**. Set **Branch = `main`** (or the branch holding this code) and the folder to **`/docs`**, then press **Save**.
3. After about a minute the page shows your link, like `https://<your-user>.github.io/automated-office/`.

## 2. Install on the iPhone

1. Open the link **in Safari**. Other browsers on iPhone cannot install apps.
2. Tap **Share ⬆︎ ▸ Add to Home Screen ▸ Add**.
3. Open **Noting Desk** from the Home Screen once while you're online. From then on it works with no internet at all.
4. To bring your existing data in, tap **More ▸ 🔄 Sync ▸ Open sync / backup file** and pick a `NotingDesk_backup_*.json` or a sync file from Files or your pen drive.

Updates: when a new version is published, the app shows **"A new version is ready – Update now"** the next time it's opened online.

## 3. Update the office PC

1. In the **old** Noting Desk, make a backup first: **Automate ▸ Backup**.
2. Copy the new `Noting_Desk.html` onto the pen drive. You can get it from the iPhone app (**Sync ▸ Save Noting_Desk.html**) or download `docs/Noting_Desk.html` from this repository.
3. On the PC, replace the old `Noting_Desk.html` with the new one **in the same folder**, and open it in the **same browser** (Chrome or Edge) as before. Your data is kept by the browser, so it is all still there.
4. If anything is missing, use **Automate ▸ Restore** with the backup from step 1. Restoring only adds; it never deletes.

PoHW Desk (`PoHW_Desk.html`) stays as a separate file on the PC. Its cases still travel inside the sync file.

## 4. Sync (both directions, no internet)

Open **🔄 Sync**. On the PC it's in the left bar; on the iPhone it's under **More**.

### Pen-drive sync file: everything at once
| Step | Office PC | iPhone |
|---|---|---|
| PC ➜ iPhone | **Create sync file** and save it on the OTG pen drive | Plug in the pen drive ▸ **Open sync / backup file** ▸ pick the file |
| iPhone ➜ PC | **Open sync / backup file** ▸ pick the file from the pen drive | **Create sync file** ▸ **Save to Files** ▸ choose the pen drive |

- Tick **Include the PDFs and attachments** when you want the PDFs too. The file gets bigger.
- Merging never overwrites. New items are added, and when both devices changed the same item **the newer edit wins**. Items deleted on one device stay deleted.
- Old backup files (`NotingDesk_backup_*.json`) open the same way.

### QR quick sync: a few new entries, no cable
1. On the sending device choose what to send, such as *changes since last send* or *last 24 hours*, and tap **Show QR codes**.
2. On the receiving device tap **Scan QR codes** and hold the camera on the screen. The codes loop until every piece is caught, in any order.
3. When done, tap **Received on the other device** on the sender, so the next send only carries newer changes.

- PC ➜ iPhone works with the iPhone camera.
- iPhone ➜ PC needs a webcam on the PC. Without one, use the pen-drive file.
- PDFs are never sent by QR. For large amounts (more than about 100 codes) the pen-drive file is quicker.

---

## For developers

```
src/Noting_Desk_base.html   original Noting Desk (unchanged)
src/addon/nd-sync.js        Sync panel: pen-drive file + QR send/scan (uses ndPack/ndMerge/ndRestore)
src/addon/nd-pwa.js         iPhone layer: service worker, share-sheet saving, More sheet, install hint
src/addon/nd-mobile.css     premium phone layout (safe areas, frosted bars, 16px inputs on iOS)
src/vendor/                 qrcode-generator 1.4.4 (MIT), jsQR 1.4.0 (Apache-2.0) – embedded for offline use
src/sw.template.js          offline cache (version stamped per build)
tools/make_icons.py         draws the app icons
build.py                    builds docs/ (index.html, Noting_Desk.html, sw.js, manifest)
```

Build after any change, then commit `docs/`:

```bash
python3 build.py
```

To update the base app, replace `src/Noting_Desk_base.html` with the newer PC file and rebuild. The add-ons are injected before `</body>` and don't modify the original code.

The sync file uses the same format as the app's own full backup (`app: "NotingDesk", v: 4`) plus a `sync` block, so any Noting Desk version that can restore a backup can read it.
