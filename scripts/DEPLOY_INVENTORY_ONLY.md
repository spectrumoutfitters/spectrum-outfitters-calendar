# Deploy only the inventory scan improvements to main

Use this when you want to push **only** the inventory barcode/QR changes to the main site, and leave all other uncommitted updates for later.

## Files included (inventory only)

- `frontend/src/components/Inventory/BarcodeScannerModal.jsx` — manual barcode entry, QR code support, item description in scan modal
- `frontend/src/components/Admin/InventoryManagement.jsx` — “Look up” on add form, pending context for scanner
- `frontend/src/pages/Inventory.jsx` — “Look up” button, alphanumeric input, helper text

## Option A: New branch → merge to master (recommended)

Run these from the project root in order.

1. **Create a branch with only the inventory changes**
   ```powershell
   git checkout -b inventory-scan-improvements
   ```

2. **Stage only the 3 inventory files**
   ```powershell
   git add frontend/src/components/Inventory/BarcodeScannerModal.jsx frontend/src/components/Admin/InventoryManagement.jsx frontend/src/pages/Inventory.jsx
   ```

3. **Commit**
   ```powershell
   git commit -m "Inventory: manual barcode/SKU entry, Look up button, alphanumeric input, QR code support"
   ```

4. **Push the branch**
   ```powershell
   git push -u origin inventory-scan-improvements
   ```

5. **Merge into master and push (to update main site)**
   ```powershell
   git checkout master
   git merge inventory-scan-improvements
   git push origin master
   ```

6. **Go back to your working state** (all your other changes are still there)
   ```powershell
   git checkout master
   ```
   You’re already on master after step 5. Your other modified files were never committed, so they’re still in your working directory.

After this, **master** (and whatever you deploy from it) has only this inventory commit added. Deploy from master as you normally do for the main site.

---

## Option B: Deploy from the branch once (no merge)

If you’d rather not change `master` yet:

1. Do steps 1–4 from Option A (create `inventory-scan-improvements`, commit the 3 files, push).
2. On the **main site server** (or in your deploy config), deploy from the branch `inventory-scan-improvements` this one time instead of `master`.
3. When you’re ready for the rest of your updates, merge everything into `master` and go back to deploying from `master`.

---

## If you don’t use Git on the server

1. Build the frontend locally after committing only the 3 files (Option A steps 1–3).
2. Copy **only** the built assets (e.g. `frontend/dist/`) to the main site, or copy only the changed built files if you know which ones changed.

This is less precise than deploying from a branch that contains only the inventory commit; Option A is simpler and keeps history clear.
