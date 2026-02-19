import db from './db.js';

const addAIFields = async () => {
  try {
    // Add AI-related columns to tasks table
    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN ai_estimated_time INTEGER
    `).catch(() => {
      console.log('ai_estimated_time column may already exist');
    });

    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN ai_suggested_category TEXT
    `).catch(() => {
      console.log('ai_suggested_category column may already exist');
    });

    await db.runAsync(`
      ALTER TABLE tasks ADD COLUMN ai_confidence_score TEXT
    `).catch(() => {
      console.log('ai_confidence_score column may already exist');
    });

    // Create AI usage log table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS ai_usage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature TEXT NOT NULL,
        task_id INTEGER REFERENCES tasks(id),
        user_id INTEGER REFERENCES users(id),
        tokens_used INTEGER,
        cost_estimate DECIMAL(10, 6),
        success BOOLEAN DEFAULT 1,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster queries
    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_feature 
      ON ai_usage_log(feature)
    `).catch(() => {
      console.log('Index may already exist');
    });

    await db.runAsync(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_task 
      ON ai_usage_log(task_id)
    `).catch(() => {
      console.log('Index may already exist');
    });

    console.log('AI fields and usage log table added successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding AI fields:', error);
    process.exit(1);
  }
};

addAIFields();

