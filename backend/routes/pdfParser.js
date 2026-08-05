import express from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { extractWorkItemsWithAI, extractVehicleInfoWithAI, isAIEnabledSync } from '../utils/aiService.js';
import { extractWorkItems, extractVehicleInfo } from '../utils/pdfRepairOrderExtract.js';

// pdf-parse supports ES modules, use dynamic import
let PDFParse;

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// POST /api/pdf/parse - Parse PDF and extract work items
router.post('/parse', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Lazy load pdf-parse (dynamic import for ES module)
    if (!PDFParse) {
      const pdfParseModule = await import('pdf-parse');
      PDFParse = pdfParseModule.PDFParse || pdfParseModule.default;
    }

    // Parse PDF using the class-based API
    const parser = new PDFParse({ data: req.file.buffer });
    try {
      const textResult = await parser.getText();
      const text = textResult.text;

      // Try AI extraction first, fallback to regex
      let workItems = null;
      let vehicleInfo = null;
      
      if (isAIEnabledSync()) {
        try {
          console.log('Attempting AI-powered extraction...');
          workItems = await extractWorkItemsWithAI(text);
          vehicleInfo = await extractVehicleInfoWithAI(text);
          if (workItems && workItems.length > 0) {
            console.log(`AI extracted ${workItems.length} work items`);
          }
        } catch (aiError) {
          console.warn('AI extraction failed, falling back to regex:', aiError.message);
        }
      }
      
      // Fallback to regex if AI didn't work or is disabled
      if (!workItems || workItems.length === 0) {
        workItems = extractWorkItems(text);
      }
      if (!vehicleInfo || Object.keys(vehicleInfo).length === 0) {
        vehicleInfo = extractVehicleInfo(text);
      }

      // Clean up parser
      await parser.destroy();

      res.json({
        workItems,
        vehicleInfo,
        rawText: text.substring(0, 1000), // First 1000 chars for debugging
        aiUsed: isAIEnabledSync() && workItems && workItems.length > 0
      });
    } catch (parseError) {
      // Clean up parser on error
      await parser.destroy().catch(() => {});
      throw parseError;
    }
  } catch (error) {
    console.error('PDF parsing error:', error);
    res.status(500).json({ error: 'Failed to parse PDF: ' + error.message });
  }
});

export default router;

