import db from './db.js';

async function addCleanupMessages() {
  try {
    console.log('Adding cleanup_reminder_messages table...');
    
    // Create messages table if it doesn't exist
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS cleanup_reminder_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if messages already exist
    const existingCount = await db.getAsync('SELECT COUNT(*) as count FROM cleanup_reminder_messages');
    
    if (existingCount.count === 0) {
      // Insert default motivational messages
      const messages = [
        `Great work today! Before you head out, let's finish strong by ensuring our entire shop is clean and ready for tomorrow. 

A clean shop is a professional shop, and it shows pride in our work. Please take a few minutes to:

• Clean and organize your work area
• Put away all tools and equipment in their proper places
• Wipe down surfaces and dispose of any trash
• Check common areas and help keep the shop looking its best
• Ensure everything is safe and secure

Your attention to detail in keeping our shop clean reflects the quality of work we do. Thank you for being part of a team that takes pride in our workspace!`,

        `Excellent work today! As we wrap up, remember that a clean workspace sets us up for success tomorrow. 

Let's work together to:
• Organize tools and equipment
• Clean up work areas and common spaces
• Dispose of waste properly
• Make sure everything is in its place

When we take care of our shop, we're taking care of each other. Thanks for being awesome!`,

        `Outstanding job today! Before you leave, let's make sure our shop looks as good as the work we do. 

A few quick tasks:
• Tidy up your workspace
• Return tools to their proper homes
• Clean surfaces and clear debris
• Help maintain our shared spaces

Your effort to keep things organized shows professionalism and respect for our team. We appreciate you!`,

        `Fantastic work today! Let's end on a high note by leaving the shop better than we found it. 

Take a moment to:
• Clean and organize your area
• Put tools and supplies away
• Wipe down surfaces
• Check that common areas are tidy
• Ensure everything is secure

A clean shop is a reflection of our commitment to excellence. Thank you for your dedication!`,

        `Amazing work today! Before you go, let's make sure tomorrow starts with a clean slate. 

Quick cleanup checklist:
• Organize your workspace
• Store tools and equipment properly
• Clean up any messes
• Help maintain shared spaces
• Double-check everything is safe

Your attention to detail in keeping our shop clean shows the pride you take in your work. We're grateful to have you on the team!`,

        `Incredible work today! As we finish up, remember that a well-maintained shop is a sign of a professional team. 

Let's quickly:
• Clean and organize work areas
• Put everything back where it belongs
• Dispose of trash and debris
• Keep common areas looking great
• Make sure everything is secure

When we care for our workspace, we're showing respect for our craft and our colleagues. Thanks for being part of something great!`
      ];

      for (const message of messages) {
        await db.runAsync(
          'INSERT INTO cleanup_reminder_messages (message, enabled) VALUES (?, ?)',
          [message, 1]
        );
      }

      console.log(`✅ Added ${messages.length} default cleanup reminder messages`);
    } else {
      console.log('✅ Cleanup reminder messages already exist');
    }

    console.log('✅ Cleanup messages migration completed successfully');
  } catch (error) {
    console.error('❌ Error adding cleanup reminder messages:', error);
    throw error;
  }
}

addCleanupMessages()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

