/**
 * AI Service using Anthropic Claude with Ollama local fallback
 * Provides AI-powered features for task management, parsing, and optimization
 * Falls back to local Ollama if Claude API is unavailable or balance is low
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory (server.js already loads it, but ensure it's loaded here too)
// The path should be relative to this file's location (utils/) to backend root
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Initialize clients
let anthropic = null;
let useLocalAI = false;
let localAIBaseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
let localAIModel = process.env.OLLAMA_MODEL || 'llama3.2';

/**
 * Initialize Anthropic client
 */
function initializeAnthropic() {
  if (anthropic) return anthropic;
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    console.warn('Anthropic API key not configured. Will try local AI fallback.');
    return null;
  }
  
  try {
    anthropic = new Anthropic({ apiKey });
    return anthropic;
  } catch (error) {
    console.warn('Failed to initialize Anthropic client:', error.message);
    return null;
  }
}

/**
 * Check if local AI (Ollama) is available and model exists
 */
async function checkLocalAI() {
  try {
    const response = await fetch(`${localAIBaseURL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    if (response.ok) {
      const data = await response.json();
      const hasModel = data.models?.some(m => m.name.includes(localAIModel.split(':')[0]));
      return hasModel;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if AI is enabled (Claude or local)
 */
export async function isAIEnabled() {
  const enabled = process.env.AI_ENABLED !== 'false';
  
  // Check Claude first
  const claudeClient = initializeAnthropic();
  if (claudeClient) {
    useLocalAI = false;
    return enabled;
  }
  
  // Check local AI as fallback
  if (process.env.USE_LOCAL_AI === 'true' || process.env.USE_LOCAL_AI === 'auto') {
    const localAvailable = await checkLocalAI();
    if (localAvailable) {
      useLocalAI = true;
      console.log(`Using local AI (Ollama) with model: ${localAIModel}`);
      return enabled;
    }
  }
  
  return false;
}

/**
 * Synchronous check (for quick checks without async)
 */
export function isAIEnabledSync() {
  const enabled = process.env.AI_ENABLED !== 'false';
  const claudeClient = initializeAnthropic();
  return enabled && (claudeClient !== null || process.env.USE_LOCAL_AI === 'true');
}

/**
 * Call local AI (Ollama) - OpenAI-compatible API
 */
async function callLocalAI(prompt, options = {}) {
  const model = options.model || localAIModel;
  const systemPrompt = options.systemPrompt || 'You are a helpful assistant for an automotive service shop management system.';
  
  try {
    // Combine system prompt with user prompt for Ollama
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    // Try /api/chat first (newer Ollama versions)
    let response = await fetch(`${localAIBaseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: options.maxTokens || 1024  // Reduced to 1024 for faster responses
        }
      }),
      signal: AbortSignal.timeout(300000) // 5 minutes for local AI (slower than Claude)
    });
    
    // If /api/chat returns 404 or error, try /api/generate (older format)
    if (!response.ok || response.status === 404) {
      const errorText = await response.text().catch(() => '');
      console.log('Trying /api/generate endpoint instead of /api/chat');
      
      response = await fetch(`${localAIBaseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: options.maxTokens || 1024  // Reduced to 1024 for faster responses
          }
        }),
        signal: AbortSignal.timeout(300000) // 5 minutes for local AI (slower than Claude)
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Local AI error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
        
        // Handle specific errors
        if (errorJson.error && (errorJson.error.includes('memory') || errorJson.error.includes('Memory') || errorJson.error.includes('allocate'))) {
          // Suggest models based on what's likely available
          throw new Error(`Model "${model}" needs more free RAM. Try: ollama pull gemma3:12b (then set OLLAMA_MODEL=gemma3:12b in .env)`);
        }
        if (errorJson.error && errorJson.error.includes('not found')) {
          throw new Error(`Model "${model}" not found. Download it with: ollama pull ${model}`);
        }
      } catch (parseError) {
        // Not JSON, use raw text
        if (errorText.includes('memory')) {
          throw new Error(`Model "${model}" requires more RAM. Try a smaller model like gemma3:4b. Download with: ollama pull gemma3:4b`);
        }
      }
      
      console.error('Ollama API error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Handle both response formats
    const content = data.message?.content || data.response || '';
    
    if (!content) {
      throw new Error('Empty response from local AI. The model may need more time or memory.');
    }
    
    return {
      text: content,
      usage: { 
        input_tokens: data.prompt_eval_count || 0, 
        output_tokens: data.eval_count || 0 
      },
      model: model,
      source: 'local'
    };
  } catch (error) {
    console.error('Local AI error:', error);
    
    // Provide helpful error messages
    if (error.message.includes('memory') || error.message.includes('Memory')) {
      throw new Error(`Model "${model}" is too large for available RAM. Please download a smaller model: ollama pull gemma3:4b (then set OLLAMA_MODEL=gemma3:4b in .env)`);
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      throw new Error(`Model "${model}" not found. Please download it with: ollama pull ${model}`);
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed') || error.message.includes('NetworkError')) {
      throw new Error('Ollama is not running. Please start Ollama and try again.');
    } else if (error.message.includes('TimeoutError') || error.message.includes('timeout') || error.message.includes('aborted')) {
      throw new Error('Local AI request timed out. The model may be too slow or Ollama may not be responding. Try restarting Ollama or using a smaller model.');
    }
    
    throw new Error(`Local AI service error: ${error.message}`);
  }
}

/**
 * Generic function to call AI (Claude or local fallback)
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options (system prompt, max tokens, etc.)
 * @returns {Promise<Object>} - The response from AI
 */
export async function callClaude(prompt, options = {}) {
  const enabled = await isAIEnabled();
  if (!enabled) {
    throw new Error('AI is not enabled. Configure Claude API key or set up local Ollama.');
  }
  
  // Try Claude first if available
  const client = initializeAnthropic();
  let claudeFailed = false;
  
  if (client && !useLocalAI) {
    const model = options.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const maxTokens = options.maxTokens || 4096;
    const systemPrompt = options.systemPrompt || 'You are a helpful assistant for an automotive service shop management system.';
    
    try {
      const message = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      // Extract text content from response
      const textContent = message.content.find(block => block.type === 'text');
      return {
        text: textContent?.text || '',
        usage: message.usage,
        model: message.model,
        source: 'claude'
      };
    } catch (error) {
      console.warn('Claude API error, falling back to local AI:', error.message);
      claudeFailed = true;
      // Fall through to local AI
    }
  }
  
  // Use local AI as fallback (always try if Claude failed, or if explicitly enabled)
  if (claudeFailed || useLocalAI || process.env.USE_LOCAL_AI === 'true' || process.env.USE_LOCAL_AI === 'auto') {
    try {
      console.log('Attempting local AI fallback...');
      // Reduce max tokens for local AI to speed up responses
      const localOptions = {
        ...options,
        maxTokens: Math.min(options.maxTokens || 1024, 1024) // Cap at 1024 for faster responses
      };
      return await callLocalAI(prompt, localOptions);
    } catch (error) {
      console.error('Both Claude and local AI failed:', error);
      throw new Error(`AI service error: ${error.message}`);
    }
  }
  
  throw new Error('No AI service available. Configure Claude API key or set up local Ollama.');
}

/**
 * Extract work items from PDF text using AI
 * @param {string} text - PDF text content
 * @returns {Promise<Array>} - Array of work items with titles
 */
export async function extractWorkItemsWithAI(text) {
  if (!(await isAIEnabled())) {
    return null; // Return null to trigger fallback
  }
  
  const prompt = `Extract work items (parts and labor) from this repair order data. 
This could be PDF text or ShopMonkey API JSON data.

Return ONLY a JSON array of objects with this exact format:
[
  {"title": "Item name here", "order": 1},
  {"title": "Another item", "order": 2}
]

Rules:
- Only include actual work items (parts, labor, services)
- Exclude prices, totals, taxes, fees
- Clean up item names (remove part numbers, quantities, prices)
- If you see "complaint" or "recommendation" fields, extract work items from those
- If you see inspection status, include inspection-related work
- If you see cost breakdowns (laborCents, partsCents, shopSuppliesCents), infer work items from those
- Sort by order number if present
- Return valid JSON only, no other text

Repair Order Data:
${text.substring(0, 50000)}`; // Limit to 50k chars to avoid token limits
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are a PDF parser that extracts structured data from repair orders. Always return valid JSON.',
      maxTokens: 2048
    });
    
    // Parse JSON from response
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[0]);
      return items.map(item => ({ title: item.title || item.name || '', order: item.order || 0 }));
    }
    
    return null;
  } catch (error) {
    console.error('AI work items extraction error:', error);
    return null; // Fallback to regex
  }
}

/**
 * Extract vehicle information from PDF text using AI
 * @param {string} text - PDF text content
 * @returns {Promise<Object>} - Vehicle info object
 */
export async function extractVehicleInfoWithAI(text) {
  if (!(await isAIEnabled())) {
    return null;
  }
  
  const prompt = `Extract vehicle information from this repair order PDF text.
Return ONLY a JSON object with this exact format:
{
  "year": "2020",
  "make": "Ford",
  "model": "F-150",
  "vin": "1FTFW1E50LFA12345",
  "mileage": "45000",
  "repairOrderNumber": "12345",
  "customerName": "John Doe"
}

Extract:
- Year, Make, Model
- VIN (17 characters)
- Mileage (numbers only, no commas)
- Repair Order Number
- Customer Name (if available)

PDF Text:
${text.substring(0, 20000)}`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are a PDF parser that extracts structured vehicle data. Always return valid JSON.',
      maxTokens: 1024
    });
    
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('AI vehicle info extraction error:', error);
    return null;
  }
}

/**
 * Estimate task time based on task data and historical data
 * @param {Object} taskData - Task information
 * @param {Array} historicalTasks - Historical task data for learning
 * @returns {Promise<Object>} - Estimated time in minutes with confidence
 */
export async function estimateTaskTime(taskData, historicalTasks = []) {
  if (!(await isAIEnabled())) {
    return null;
  }
  
  const historicalContext = historicalTasks.length > 0
    ? `\n\nHistorical similar tasks and their actual completion times:\n${JSON.stringify(historicalTasks.slice(0, 10), null, 2)}`
    : '';
  
  const prompt = `Estimate the time needed to complete this automotive service task.

Task Details:
- Title: ${taskData.title || 'N/A'}
- Description: ${taskData.description || 'N/A'}
- Category: ${taskData.category || 'N/A'}
- Work Items: ${taskData.subtasks?.map(s => s.title || s).join(', ') || 'N/A'}
- Vehicle: ${taskData.description?.match(/\d{4}\s+\w+\s+\w+/)?.[0] || 'N/A'}${historicalContext}

Return ONLY a JSON object:
{
  "estimatedMinutes": 120,
  "confidence": "high",
  "reasoning": "Brief explanation"
}

Confidence levels: "high", "medium", "low"
Provide realistic estimates based on typical automotive service times.`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are an expert at estimating automotive service task completion times.',
      maxTokens: 512
    });
    
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('AI time estimation error:', error);
    return null;
  }
}

/**
 * Suggest task assignment based on employee data and task requirements
 * @param {Object} taskData - Task information
 * @param {Array} employees - Available employees with their data
 * @returns {Promise<Object>} - Suggested assignment with reasoning
 */
export async function suggestTaskAssignment(taskData, employees) {
  if (!(await isAIEnabled()) || !employees || employees.length === 0) {
    return null;
  }
  
  const employeesContext = employees.map(emp => ({
    id: emp.id,
    name: emp.full_name,
    currentTasks: emp.currentTasks || 0,
    skills: emp.skills || [],
    availability: emp.availability || 'available'
  }));
  
  const prompt = `Suggest the best employee assignment for this automotive service task.

Task Details:
- Title: ${taskData.title || 'N/A'}
- Description: ${taskData.description || 'N/A'}
- Category: ${taskData.category || 'N/A'}
- Priority: ${taskData.priority || 'medium'}
- Work Items: ${taskData.subtasks?.map(s => s.title || s).join(', ') || 'N/A'}

Available Employees:
${JSON.stringify(employeesContext, null, 2)}

Return ONLY a JSON object:
{
  "suggestedEmployeeId": 1,
  "suggestedEmployeeName": "John Doe",
  "confidence": "high",
  "reasoning": "Brief explanation of why this employee is best suited",
  "alternatives": [
    {"id": 2, "name": "Jane Smith", "reason": "Also skilled in this area"}
  ]
}

Consider: skills, current workload, availability, task complexity.`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are an expert at matching tasks to employees based on skills, workload, and availability.',
      maxTokens: 1024
    });
    
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('AI assignment suggestion error:', error);
    return null;
  }
}

/**
 * Categorize task based on description
 * @param {string} title - Task title
 * @param {string} description - Task description
 * @returns {Promise<Object>} - Suggested category with confidence
 */
export async function categorizeTask(title, description) {
  if (!(await isAIEnabled())) {
    return null;
  }
  
  const categories = ['PPF', 'Tinting', 'Wraps', 'Maintenance', 'Upfitting', 'Signs', 'Body Work', 'Admin', 'Other'];
  
  const prompt = `Categorize this automotive service task into one of these categories: ${categories.join(', ')}.

Task Title: ${title || 'N/A'}
Task Description: ${description || 'N/A'}

Return ONLY a JSON object:
{
  "category": "PPF",
  "confidence": "high",
  "reasoning": "Brief explanation"
}

Confidence levels: "high", "medium", "low"
Choose the most appropriate category based on the work described.`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are an expert at categorizing automotive service tasks.',
      maxTokens: 256
    });
    
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      // Validate category is in our list
      if (categories.includes(result.category)) {
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.error('AI categorization error:', error);
    return null;
  }
}

/**
 * Generate quality check suggestions for a task
 * @param {Object} taskData - Task information
 * @param {Array} similarTasks - Similar completed tasks for reference
 * @returns {Promise<Array>} - Array of quality check suggestions
 */
export async function generateQualityChecks(taskData, similarTasks = []) {
  if (!(await isAIEnabled())) {
    return null;
  }
  
  const similarContext = similarTasks.length > 0
    ? `\n\nSimilar completed tasks and common issues:\n${JSON.stringify(similarTasks.slice(0, 5), null, 2)}`
    : '';
  
  const prompt = `Generate quality check suggestions for this automotive service task before final submission.

Task Details:
- Title: ${taskData.title || 'N/A'}
- Description: ${taskData.description || 'N/A'}
- Category: ${taskData.category || 'N/A'}
- Work Items: ${taskData.subtasks?.map(s => s.title || s).join(', ') || 'N/A'}${similarContext}

Return ONLY a JSON array of quality check items:
[
  "Check item 1",
  "Check item 2",
  "Check item 3"
]

Focus on:
- Common issues for this type of work
- Safety checks
- Quality standards
- Things that are often missed

Return 5-10 specific, actionable check items.`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are a quality control expert for automotive services.',
      maxTokens: 1024
    });
    
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('AI quality checks error:', error);
    return null;
  }
}

/**
 * Optimize schedule based on tasks and employee availability
 * @param {Array} tasks - Current tasks
 * @param {Array} schedule - Current schedule entries
 * @param {Array} employees - Available employees
 * @returns {Promise<Object>} - Optimization suggestions
 */
export async function optimizeSchedule(tasks, schedule, employees) {
  if (!(await isAIEnabled())) {
    return null;
  }
  
  const prompt = `Optimize the task schedule for an automotive service shop.

Current Tasks:
${JSON.stringify(tasks.slice(0, 20), null, 2)}

Current Schedule:
${JSON.stringify(schedule.slice(0, 20), null, 2)}

Available Employees:
${JSON.stringify(employees.map(e => ({ id: e.id, name: e.full_name })), null, 2)}

Return ONLY a JSON object:
{
  "suggestions": [
    {
      "taskId": 1,
      "suggestedDate": "2024-01-15",
      "suggestedEmployeeId": 2,
      "reasoning": "Brief explanation"
    }
  ],
  "bottlenecks": ["Potential issue 1", "Potential issue 2"],
  "optimizations": ["Optimization suggestion 1"]
}

Consider: task dependencies, employee availability, workload balance, deadlines.`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are an expert at optimizing automotive service shop schedules.',
      maxTokens: 2048
    });
    
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('AI schedule optimization error:', error);
    return null;
  }
}

/**
 * Generate parts and labor recommendations for a task
 * @param {Object} taskData - Task information
 * @returns {Promise<Object>} - Recommendations for parts, labor, tools
 */
export async function generateRecommendations(taskData) {
  if (!(await isAIEnabled())) {
    return null;
  }
  
  const prompt = `Generate parts, labor, and tool recommendations for this automotive service task.

Task Details:
- Title: ${taskData.title || 'N/A'}
- Description: ${taskData.description || 'N/A'}
- Category: ${taskData.category || 'N/A'}
- Vehicle: ${taskData.description?.match(/\d{4}\s+\w+\s+\w+/)?.[0] || 'N/A'}
- Work Items: ${taskData.subtasks?.map(s => s.title || s).join(', ') || 'N/A'}

Return ONLY a JSON object:
{
  "parts": [
    {"name": "Part name", "quantity": 1, "notes": "Optional notes"}
  ],
  "labor": {
    "estimatedHours": 2.5,
    "skillLevel": "intermediate",
    "notes": "Brief labor notes"
  },
  "tools": ["Tool 1", "Tool 2"],
  "notes": "General recommendations"
}

Provide realistic recommendations based on the work described.`;
  
  try {
    const response = await callClaude(prompt, {
      systemPrompt: 'You are an expert at recommending parts, labor, and tools for automotive services.',
      maxTokens: 2048
    });
    
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('AI recommendations error:', error);
    return null;
  }
}

