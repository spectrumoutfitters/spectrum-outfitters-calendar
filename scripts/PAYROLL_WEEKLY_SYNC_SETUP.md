# Payroll Weekly Auto Sync Setup

Use this once on the **Windows PC that runs the Payroll app**.

This makes Calendar auto-import payroll history every Saturday, so reimbursements update without manual uploads.

## 1) Test once now

From PowerShell:

```powershell
cd "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\scripts"
powershell -ExecutionPolicy Bypass -File ".\payroll-weekly-sync.ps1" `
  -BaseUrl "https://login.spectrumoutfitters.com" `
  -Username "YOUR_ADMIN_USERNAME" `
  -Password "YOUR_ADMIN_PASSWORD" `
  -RunAnyDay
```

Expected output includes:

- `Loaded N record(s)`
- `Sync complete. Imported X new pay run(s). Server total: Y.`

## 2) Schedule weekly on Saturday

Open **Task Scheduler** -> **Create Basic Task**:

- Name: `Spectrum Payroll Weekly Sync`
- Trigger: `Weekly`, Saturday, choose time (for example 7:00 AM)
- Action: `Start a program`
- Program/script: `powershell.exe`
- Add arguments:

```text
-ExecutionPolicy Bypass -File "C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\scripts\payroll-weekly-sync.ps1" -BaseUrl "https://login.spectrumoutfitters.com" -Username "YOUR_ADMIN_USERNAME" -Password "YOUR_ADMIN_PASSWORD"
```

## 3) What file is synced

By default the script reads:

`%AppData%\SpectrumOutfitters-Payroll-System\PayrollData\payroll-history.json`

Override with `-PayrollHistoryPath` if needed.

