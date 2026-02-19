import db from './db.js';

const addComplianceTables = async () => {
  try {
    // Create compliance_obligations table - defines obligation types
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS compliance_obligations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        jurisdiction TEXT DEFAULT 'federal',
        frequency TEXT CHECK(frequency IN ('monthly', 'quarterly', 'annual', 'custom')) NOT NULL,
        due_day INTEGER,
        due_rule_json TEXT,
        reminder_days_before INTEGER DEFAULT 7,
        enabled INTEGER DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, jurisdiction)
      )
    `);
    console.log('✅ Created compliance_obligations table');

    // Create compliance_instances table - specific period instances
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS compliance_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obligation_id INTEGER NOT NULL REFERENCES compliance_obligations(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        period_label TEXT,
        due_date DATE NOT NULL,
        status TEXT CHECK(status IN ('pending', 'due_soon', 'overdue', 'paid', 'filed')) DEFAULT 'pending',
        amount_due_estimate DECIMAL(10,2),
        amount_paid DECIMAL(10,2),
        notified_due_soon INTEGER DEFAULT 0,
        notified_overdue INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(obligation_id, period_start, period_end)
      )
    `);
    console.log('✅ Created compliance_instances table');

    // Create compliance_payments table - payment/filing records
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS compliance_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id INTEGER NOT NULL REFERENCES compliance_instances(id),
        payment_type TEXT CHECK(payment_type IN ('payment', 'filing')) DEFAULT 'payment',
        paid_at DATETIME NOT NULL,
        amount DECIMAL(10,2),
        confirmation_number TEXT,
        method TEXT,
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created compliance_payments table');

    // Create compliance_attachments table - receipt/document storage
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS compliance_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id INTEGER REFERENCES compliance_instances(id),
        payment_id INTEGER REFERENCES compliance_payments(id),
        filename TEXT NOT NULL,
        original_name TEXT,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created compliance_attachments table');

    // Create sales_daily_summary table - daily sales from terminal
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS sales_daily_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_date DATE NOT NULL UNIQUE,
        gross_sales DECIMAL(10,2) DEFAULT 0,
        taxable_sales DECIMAL(10,2) DEFAULT 0,
        non_taxable_sales DECIMAL(10,2) DEFAULT 0,
        sales_tax_collected DECIMAL(10,2) DEFAULT 0,
        refunds DECIMAL(10,2) DEFAULT 0,
        tips DECIMAL(10,2) DEFAULT 0,
        fees DECIMAL(10,2) DEFAULT 0,
        net_deposit DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        entered_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created sales_daily_summary table');

    // Seed default obligations for Texas + monthly payroll depositor
    const defaultObligations = [
      {
        type: 'sales_tax',
        name: 'Texas Sales Tax',
        jurisdiction: 'TX',
        frequency: 'monthly',
        due_day: 20,
        due_rule_json: JSON.stringify({
          description: 'Due on the 20th of the month following the reporting period',
          offset_months: 1,
          day_of_month: 20
        }),
        reminder_days_before: 7,
        notes: 'Texas Comptroller - Sales and Use Tax'
      },
      {
        type: 'payroll_deposit',
        name: 'Federal Payroll Tax Deposit',
        jurisdiction: 'federal',
        frequency: 'monthly',
        due_day: 15,
        due_rule_json: JSON.stringify({
          description: 'Monthly depositor: Due by the 15th of the following month',
          offset_months: 1,
          day_of_month: 15
        }),
        reminder_days_before: 5,
        notes: 'EFTPS - Federal payroll taxes (Social Security, Medicare, income tax withholding)'
      },
      {
        type: 'form_941',
        name: 'IRS Form 941',
        jurisdiction: 'federal',
        frequency: 'quarterly',
        due_day: null,
        due_rule_json: JSON.stringify({
          description: 'Due last day of month following quarter end',
          quarters: {
            Q1: { period_end: '03-31', due: '04-30' },
            Q2: { period_end: '06-30', due: '07-31' },
            Q3: { period_end: '09-30', due: '10-31' },
            Q4: { period_end: '12-31', due: '01-31' }
          }
        }),
        reminder_days_before: 14,
        notes: 'Employer\'s Quarterly Federal Tax Return'
      },
      {
        type: 'form_940',
        name: 'IRS Form 940',
        jurisdiction: 'federal',
        frequency: 'annual',
        due_day: 31,
        due_rule_json: JSON.stringify({
          description: 'Due January 31 for the prior year',
          due_month: 1,
          due_day: 31
        }),
        reminder_days_before: 21,
        notes: 'Employer\'s Annual Federal Unemployment (FUTA) Tax Return'
      },
      {
        type: 'twc_report',
        name: 'Texas Workforce Commission Report',
        jurisdiction: 'TX',
        frequency: 'quarterly',
        due_day: null,
        due_rule_json: JSON.stringify({
          description: 'Due last day of month following quarter end',
          quarters: {
            Q1: { period_end: '03-31', due: '04-30' },
            Q2: { period_end: '06-30', due: '07-31' },
            Q3: { period_end: '09-30', due: '10-31' },
            Q4: { period_end: '12-31', due: '01-31' }
          }
        }),
        reminder_days_before: 14,
        notes: 'Texas SUTA - Employer\'s Quarterly Report'
      }
    ];

    for (const obligation of defaultObligations) {
      const existing = await db.getAsync(
        'SELECT id FROM compliance_obligations WHERE type = ? AND jurisdiction = ?',
        [obligation.type, obligation.jurisdiction]
      );

      if (!existing) {
        await db.runAsync(`
          INSERT INTO compliance_obligations 
          (type, name, jurisdiction, frequency, due_day, due_rule_json, reminder_days_before, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          obligation.type,
          obligation.name,
          obligation.jurisdiction,
          obligation.frequency,
          obligation.due_day,
          obligation.due_rule_json,
          obligation.reminder_days_before,
          obligation.notes
        ]);
        console.log(`  ✅ Added obligation: ${obligation.name}`);
      } else {
        console.log(`  ⏭️ Obligation already exists: ${obligation.name}`);
      }
    }

    console.log('✅ Compliance tables and defaults added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding compliance tables:', error);
    process.exit(1);
  }
};

addComplianceTables();
