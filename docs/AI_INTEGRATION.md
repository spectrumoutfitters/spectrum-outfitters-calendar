# AI Integration Guide

This document explains how to set up and use the AI-powered features in Spectrum Outfitters Calendar.

## Overview

The system uses **Anthropic Claude AI** with **local Ollama fallback** to provide intelligent assistance for:
- Enhanced PDF/work order parsing
- Automatic time estimation
- Smart task assignment suggestions
- Auto-categorization
- Quality check suggestions
- Schedule optimization
- Parts and labor recommendations

**Local AI Support**: If Claude API is unavailable or balance is low, the system automatically falls back to free local AI (Ollama). See [Local AI Setup Guide](LOCAL_AI_SETUP.md) for details.

## Setup

### 1. Get Your Anthropic API Key

1. Sign up at https://www.anthropic.com/
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key

### 2. Configure the API Key

Add to `backend/.env`:

```env
# Claude API (primary)
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
AI_ENABLED=true

# Local AI Fallback (optional - free alternative)
USE_LOCAL_AI=auto  # Options: false, true, auto
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

**Local AI Options:**
- `USE_LOCAL_AI=false` - Only use Claude API (default)
- `USE_LOCAL_AI=true` - Only use local AI (free, private)
- `USE_LOCAL_AI=auto` - Use Claude if available, fallback to local AI (recommended)

**Important:** Never commit your API key to version control. The `.env` file is already in `.gitignore`.

### 3. Run Database Migration

The AI features require additional database columns. Run:

```bash
cd backend/database
node add_ai_fields.js
```

### 4. Restart the Server

After adding the API key, restart the backend server for changes to take effect.

## Features

### Enhanced PDF Parsing

When uploading a PDF work order, the system now uses AI to extract information more accurately:

- **Better extraction** of work items, vehicle info, and customer details
- **Handles various formats** - works with ShopMonkey PDFs and custom formats
- **Automatic fallback** - if AI fails, falls back to regex-based parsing
- **No user action required** - works automatically when uploading PDFs

### Intelligent Time Estimation

Get AI-powered time estimates for tasks:

1. Create a new task
2. Fill in title, description, category, and work items
3. Click the **"🤖 AI Estimate"** button next to Estimated Time
4. The system analyzes the task and suggests a time estimate
5. The estimate is automatically filled in (you can adjust if needed)

**How it works:**
- Analyzes task description, category, and work items
- Considers historical completion times for similar tasks
- Provides confidence level (high, medium, low)
- Includes reasoning for the estimate

### Auto-Categorization

Tasks are automatically categorized when created:

- **Automatic** - happens in the background when you enter title/description
- **Smart detection** - analyzes task content to determine category
- **User override** - you can always change the category manually
- **Indicates when AI is categorizing** - shows "AI categorizing..." message

### Smart Task Assignment

Get AI suggestions for the best employee assignment:

1. Open any existing task
2. The system analyzes:
   - Task requirements and complexity
   - Employee skills and current workload
   - Employee availability
3. Suggests the best employee with reasoning
4. Available in task detail view (after task creation)

### Quality Check Suggestions

Before submitting a task for review, get AI-powered quality check suggestions:

1. Open a task that's not yet completed
2. Scroll to see **"🤖 AI Quality Check Suggestions"** section
3. Review the suggested checks
4. Use them as a checklist before submission

**What it suggests:**
- Common issues for the task type
- Safety checks
- Quality standards
- Things that are often missed

### Schedule Optimization

Optimize your shop schedule with AI:

1. Go to Schedule view (Admin only)
2. Use the optimization endpoint: `POST /api/schedule/optimize`
3. Get suggestions for:
   - Task scheduling based on dependencies
   - Employee workload balance
   - Bottleneck identification
   - Optimal task ordering

### Parts and Labor Recommendations

Get AI recommendations for parts, labor, and tools:

1. Open any task
2. Scroll to see **"🤖 AI Recommendations"** section
3. View suggested:
   - Parts needed (with quantities)
   - Labor estimates (hours and skill level)
   - Tools required
   - General notes

## API Endpoints

### Time Estimation
```
POST /api/tasks/estimate-time
Body: { title, description, category, subtasks }
Response: { estimatedMinutes, confidence, reasoning }
```

### Assignment Suggestion
```
POST /api/tasks/:id/suggest-assignment
Response: { suggestedEmployeeId, suggestedEmployeeName, confidence, reasoning, alternatives }
```

### Categorization
```
POST /api/tasks/categorize
Body: { title, description }
Response: { category, confidence, reasoning }
```

### Quality Checks
```
GET /api/tasks/:id/quality-checks
Response: { checks: [...] }
```

### Recommendations
```
GET /api/tasks/:id/recommendations
Response: { parts: [...], labor: {...}, tools: [...], notes: "..." }
```

### Schedule Optimization
```
POST /api/schedule/optimize
Response: { suggestions: [...], bottlenecks: [...], optimizations: [...] }
```

## Cost Considerations

AI API calls have costs. The system is designed to minimize costs:

- **Caching** - Results are cached when possible
- **Fallback** - Non-AI methods used when AI fails
- **Optional** - All AI features can be disabled
- **Efficient** - Only calls AI when beneficial

**Typical costs:**
- PDF parsing: ~$0.01-0.03 per PDF
- Time estimation: ~$0.001-0.003 per estimate
- Categorization: ~$0.0005-0.001 per task
- Quality checks: ~$0.001-0.002 per task

## Disabling AI Features

To disable AI features:

1. Set in `backend/.env`:
   ```env
   AI_ENABLED=false
   ```

2. Or remove the API key (system will gracefully fall back to local AI if configured)

3. Restart the server

When disabled:
- PDF parsing uses regex fallback
- AI buttons are hidden or show error messages
- All other features work normally without AI

## Using Local AI Instead

For a **free, private alternative** to Claude API:

1. **Install Ollama**: https://ollama.com
2. **Download a model**: `ollama pull llama3.2`
3. **Configure**: Set `USE_LOCAL_AI=auto` in `.env`
4. **Restart server**

The system will automatically use local AI when Claude is unavailable. See [Local AI Setup Guide](LOCAL_AI_SETUP.md) for complete instructions.

## Troubleshooting

### "AI is not enabled or API key is not configured"

- Check that `ANTHROPIC_API_KEY` is set in `backend/.env`
- Verify the API key is correct
- Restart the backend server
- Check that `AI_ENABLED=true` (or not set, defaults to true)

### AI features not working

1. **Check API key**: Verify it's set correctly
2. **Check logs**: Look for error messages in backend console
3. **Test connection**: Try a simple AI feature (like categorization)
4. **Check balance**: Ensure your Anthropic account has credits
5. **Check rate limits**: You may be hitting API rate limits

### PDF parsing not using AI

- AI parsing is automatic but falls back to regex if it fails
- Check backend logs for AI parsing errors
- Verify API key is configured
- Large PDFs may timeout - this is normal, regex fallback will work

### Time estimates seem inaccurate

- AI learns from historical data
- More completed tasks = better estimates
- You can always adjust estimates manually
- Check the confidence level (high/medium/low)

## Best Practices

1. **Start with AI enabled** - Let it learn from your data
2. **Review AI suggestions** - Always verify before accepting
3. **Provide good descriptions** - Better input = better AI output
4. **Monitor costs** - Check your Anthropic usage dashboard
5. **Use fallbacks** - System works even if AI is unavailable

## Security & Privacy

- **API keys** stored securely in `.env` (never committed)
- **No sensitive data** sent to AI (unless in task descriptions)
- **Rate limiting** prevents abuse
- **Audit logging** tracks AI usage (in `ai_usage_log` table)

## Future Enhancements

Potential future AI features:
- Customer communication generation
- Predictive maintenance suggestions
- Inventory optimization
- Two-way sync with ShopMonkey using AI
- Advanced analytics and insights

## Support

For issues:
1. Check this documentation
2. Review backend logs
3. Test API key directly with Anthropic
4. Check Anthropic status: https://status.anthropic.com/

