import express from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { toTitleCase } from '../utils/helpers.js';
import { extractWorkItemsWithAI, extractVehicleInfoWithAI, isAIEnabledSync } from '../utils/aiService.js';

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

// Extract work items from PDF text - all line items from repair order (pages 1-2 only)
function extractWorkItems(text) {
  const items = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let inWorkSection = false;
  let pageCount = 0;
  let stopParsing = false;

  for (let i = 0; i < lines.length && !stopParsing; i++) {
    const line = lines[i];
    
    // Track pages - stop after page 2
    if (line.match(/Page\s+\d+/i)) {
      const pageMatch = line.match(/Page\s+(\d+)/i);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1]);
        if (pageNum > 2) {
          stopParsing = true;
          break;
        }
        pageCount = pageNum;
      }
    }

    // Stop if we hit inspection sections
    if (line.toLowerCase().includes('vehicle intake') || 
        line.toLowerCase().includes('inspection') ||
        line.toLowerCase().includes('inspected:')) {
      stopParsing = true;
      break;
    }
    
    // Skip header/footer sections
    if (line.includes('Spectrum Outfitters') || 
        line.includes('Repair Order') || 
        line.includes('Powered by') ||
        line.includes('Grand Total') ||
        line.includes('REMAINING BALANCE')) {
      continue;
    }

    // Detect work items section (repair order table)
    if (line.toLowerCase().includes('description') || 
        (line.toLowerCase().includes('item') && (line.toLowerCase().includes('price') || line.toLowerCase().includes('qty')))) {
      inWorkSection = true;
      continue;
    }

    // Stop if we hit totals/summary sections
    if (line.match(/Subtotal|Total|Grand Total|Labor|Parts|Shop Supplies|EPA|Tax/i) && 
        !line.match(/^\d+\s/)) {
      // This might be the end of the repair order section
      if (inWorkSection && pageCount >= 1) {
        // Check if next few lines are also totals
        let isEndSection = true;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].match(/^\d+\s+/) && !lines[j].match(/Subtotal|Total/i)) {
            isEndSection = false;
            break;
          }
        }
        if (isEndSection) {
          stopParsing = true;
          break;
        }
      }
    }

    // Skip pure price/quantity/total lines
    if (line.match(/^\$[\d,]+\.\d{2}$/) || 
        (line.match(/^\d+$/) && !line.match(/^\d+\s/)) || 
        line.match(/^QTY|Subtotal|Total|Price$/i)) {
      continue;
    }

    // Pattern: Look for numbered items (e.g., "1 Motor Oil", "2 Motorcraft Engine Oil Filter")
    const numberedMatch = line.match(/^(\d+)\s+(.+)$/);
    if (numberedMatch && inWorkSection) {
      const itemNumber = numberedMatch[1];
      let description = numberedMatch[2].trim();
      
      // Skip if it's just a price or too short
      if (description.match(/^\$[\d,]+\.\d{2}$/) || description.length < 3) {
        continue;
      }
      
      // Remove part number from description (we don't need it, just the item name)
      description = description.replace(/Part\s*#:\s*[A-Z0-9-]+/gi, '').trim();
      
      // Remove price information (e.g., "$9.32" or "$65.24")
      description = description.replace(/\$\s*[\d,]+\.\d{2}/g, '').trim();
      
      // Remove quantity at the end (e.g., "7" or "QTY: 7")
      description = description.replace(/\s*(QTY|Qty|qty)[:\s]*\d+\s*$/i, '').trim();
      description = description.replace(/\s+\d+\s*$/, '').trim();
      
      // Clean up extra spaces
      description = description.replace(/\s+/g, ' ').trim();
      
      // Only add if we have a meaningful description
      if (description.length > 3) {
        // Check for duplicates
        const exists = items.some(item => 
          item.title.toLowerCase() === description.toLowerCase()
        );
        
        if (!exists) {
          items.push({
            title: toTitleCase(description),
            order: parseInt(itemNumber)
          });
        }
      }
      continue;
    }
  }

  // Remove duplicates and sort by order
  const uniqueItems = [];
  const seen = new Set();
  
  for (const item of items) {
    const key = item.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  // Sort by order
  uniqueItems.sort((a, b) => {
    if (a.order && b.order) return a.order - b.order;
    return 0;
  });

  // Return only titles (no order property needed in frontend)
  return uniqueItems.map(item => ({ title: item.title }));
}

// Extract vehicle information from PDF text
function extractVehicleInfo(text) {
  const info = {};
  
  // Extract VIN
  const vinMatch = text.match(/VIN[:\s]+([A-Z0-9]{17})/i);
  if (vinMatch) {
    info.vin = vinMatch[1];
  }

  // Extract vehicle make/model/year
  const vehicleMatch = text.match(/(\d{4})\s+([A-Za-z\s]+)\s+([A-Za-z0-9\s]+)/);
  if (vehicleMatch) {
    info.year = vehicleMatch[1];
    info.make = vehicleMatch[2].trim();
    info.model = vehicleMatch[3].trim();
  }

  // Extract repair order number
  const roMatch = text.match(/Repair Order[:\s#]+(\d+)/i);
  if (roMatch) {
    info.repairOrderNumber = roMatch[1];
  }

  // Extract mileage
  const mileageMatch = text.match(/Mileage[:\s]+([\d,]+)\s*(mi|miles)?/i);
  if (mileageMatch) {
    info.mileage = mileageMatch[1].replace(/,/g, '');
  }

  return info;
}

export default router;

