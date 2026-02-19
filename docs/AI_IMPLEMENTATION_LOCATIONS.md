# AI Implementation Locations

This document shows where AI is implemented throughout the codebase.

## Core AI Service

**File:** `backend/utils/aiService.js`

This is the main AI service file that handles:
- Claude API integration
- Local Ollama fallback
- All AI function implementations

### Main Functions:

1. **`callClaude(prompt, options)`** - Generic AI call (Claude or local fallback)
2. **`extractWorkItemsWithAI(text)`** - Extract work items from PDF text
3. **`extractVehicleInfoWithAI(text)`** - Extract vehicle info from PDF text
4. **`estimateTaskTime(taskData, historicalTasks)`** - Estimate task completion time
5. **`suggestTaskAssignment(task, employees, historicalTasks)`** - Suggest best employee for task
6. **`categorizeTask(taskData)`** - Auto-categorize tasks
7. **`generateQualityChecks(task)`** - Generate quality check list
8. **`optimizeSchedule(scheduleData)`** - Optimize work schedule
9. **`generateRecommendations(task)`** - Generate parts/labor recommendations

---

## Backend Routes (API Endpoints)

### 1. PDF Parser - `backend/routes/pdfParser.js`

**Endpoint:** `POST /api/pdf/parse`

**AI Usage:**
- Uses `extractWorkItemsWithAI()` for better work item extraction
- Uses `extractVehicleInfoWithAI()` for vehicle information
- Falls back to regex if AI fails

**Lines:** 54-65

```javascript
if (isAIEnabledSync()) {
  workItems = await extractWorkItemsWithAI(text);
  vehicleInfo = await extractVehicleInfoWithAI(text);
}
```

---

### 2. Tasks Routes - `backend/routes/tasks.js`

#### A. Time Estimation
**Endpoint:** `POST /api/tasks/estimate-time`

**AI Usage:**
- Uses `estimateTaskTime()` to predict task duration
- Considers historical tasks and task complexity

**Lines:** ~1282

#### B. Assignment Suggestion
**Endpoint:** `POST /api/tasks/:id/suggest-assignment`

**AI Usage:**
- Uses `suggestTaskAssignment()` to recommend best employee
- Considers employee skills, workload, and task requirements

**Lines:** ~1300-1350

#### C. Auto-Categorization
**Endpoint:** `POST /api/tasks/:id/categorize`

**AI Usage:**
- Uses `categorizeTask()` to automatically assign category
- Categories: PPF, Tinting, Wraps, Maintenance, Upfitting, Signs, Admin, Other

**Lines:** ~1360-1400

#### D. Quality Checks
**Endpoint:** `GET /api/tasks/:id/quality-checks`

**AI Usage:**
- Uses `generateQualityChecks()` to create quality check list
- Generates task-specific quality verification steps

**Lines:** ~1420-1450

#### E. Recommendations
**Endpoint:** `GET /api/tasks/:id/recommendations`

**AI Usage:**
- Uses `generateRecommendations()` for parts and labor suggestions
- Provides recommendations based on task description

**Lines:** ~1460-1500

---

### 3. Schedule Routes - `backend/routes/schedule.js`

**Endpoint:** `POST /api/schedule/optimize`

**AI Usage:**
- Uses `optimizeSchedule()` to optimize work schedule
- Considers employee availability, task priorities, and deadlines

**Lines:** ~200-250

---

## Frontend Components

### 1. Create Task Form - `frontend/src/components/Tasks/CreateTaskForm.jsx`

**AI Features:**
- **AI Estimate Button** - Calls `/api/tasks/estimate-time`
- **Auto-Categorization** - Automatically categorizes on task creation
- **Assignment Suggestions** - Shows AI-suggested employee assignments

**Key Functions:**
- `handleAIEstimate()` - Gets AI time estimate
- `handleAutoCategorize()` - Auto-categorizes task
- `handleSuggestAssignment()` - Gets assignment suggestions

---

### 2. Task Modal - `frontend/src/components/Tasks/TaskModal.jsx`

**AI Features:**
- **Quality Checks Tab** - Displays AI-generated quality checks
- **Recommendations Tab** - Shows parts/labor recommendations
- **AI Estimate Display** - Shows estimated time with confidence

**Key Functions:**
- `loadQualityChecks()` - Fetches AI quality checks
- `loadRecommendations()` - Fetches AI recommendations

---

## Database

### AI Fields in Tasks Table

**Migration:** `backend/database/add_ai_fields.js`

**Columns Added:**
- `ai_estimated_time` - AI-predicted time in minutes
- `ai_suggested_category` - AI-suggested category
- `ai_confidence_score` - Confidence level (0-1)

### AI Usage Log Table

**Table:** `ai_usage_log`

**Tracks:**
- AI requests
- Model used (Claude or local)
- Response time
- Success/failure

---

## Configuration

### Environment Variables - `backend/.env`

```env
# Claude API (Primary)
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
AI_ENABLED=true

# Local AI Fallback (Optional)
USE_LOCAL_AI=auto
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

## AI Features Summary

| Feature | Endpoint | Function | Location |
|---------|----------|----------|----------|
| PDF Parsing | `POST /api/pdf/parse` | `extractWorkItemsWithAI()` | `routes/pdfParser.js` |
| Time Estimation | `POST /api/tasks/estimate-time` | `estimateTaskTime()` | `routes/tasks.js` |
| Assignment Suggestion | `POST /api/tasks/:id/suggest-assignment` | `suggestTaskAssignment()` | `routes/tasks.js` |
| Auto-Categorization | `POST /api/tasks/:id/categorize` | `categorizeTask()` | `routes/tasks.js` |
| Quality Checks | `GET /api/tasks/:id/quality-checks` | `generateQualityChecks()` | `routes/tasks.js` |
| Recommendations | `GET /api/tasks/:id/recommendations` | `generateRecommendations()` | `routes/tasks.js` |
| Schedule Optimization | `POST /api/schedule/optimize` | `optimizeSchedule()` | `routes/schedule.js` |

---

## How It Works

1. **User Action** → Frontend component calls API endpoint
2. **API Route** → Calls AI service function from `aiService.js`
3. **AI Service** → Tries Claude API first, falls back to local Ollama
4. **Response** → Returns AI-generated result to frontend
5. **Display** → Frontend shows result to user

---

## Error Handling

All AI functions:
- ✅ Try Claude API first
- ✅ Automatically fallback to local AI if Claude fails
- ✅ Show clear error messages if both fail
- ✅ Log usage for debugging

---

## Documentation

- **Setup:** `docs/AI_INTEGRATION.md`
- **Local AI:** `docs/LOCAL_AI_SETUP.md`
- **Troubleshooting:** `docs/FIX_TIMEOUT_ERROR.md`

