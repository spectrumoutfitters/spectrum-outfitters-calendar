# Local AI Setup Guide (Ollama)

This guide explains how to set up local AI using Ollama as a free, offline alternative to Claude API.

## Why Use Local AI?

- **Free** - No API costs
- **Private** - Data never leaves your computer
- **Reliable** - Works even without internet
- **Fast** - No network latency
- **Fallback** - Automatic fallback when Claude API is unavailable

## Quick Setup

### Step 1: Install Ollama

1. Download Ollama from https://ollama.com
2. Install it (Windows/Mac/Linux supported)
3. Ollama will start automatically as a service

### Step 2: Download a Model

Open a terminal and run:

```bash
# Recommended models (choose one based on your RAM):

# Small & Fast (4GB RAM) - Good for simple tasks
ollama pull llama3.2

# Medium (8GB RAM) - Better quality
ollama pull llama3.1:8b

# Large (16GB+ RAM) - Best quality
ollama pull llama3.1:70b
```

### Step 3: Configure Your Application

Add to `backend/.env`:

```env
# Use local AI instead of Claude (or as fallback)
USE_LOCAL_AI=auto

# Ollama settings (optional - defaults shown)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### Step 4: Restart Backend Server

```bash
cd backend
npm start
```

## Configuration Options

### USE_LOCAL_AI

- `false` - Only use Claude API (default)
- `true` - Only use local AI (ignore Claude)
- `auto` - Use Claude if available, fallback to local AI

### OLLAMA_BASE_URL

Default: `http://localhost:11434`

If Ollama is running on a different machine:
```env
OLLAMA_BASE_URL=http://192.168.1.100:11434
```

### OLLAMA_MODEL

Default: `llama3.2`

Available models:
- `llama3.2` - Fast, 3B parameters (recommended)
- `llama3.1:8b` - Better quality, 8B parameters
- `llama3.1:70b` - Best quality, 70B parameters (needs 16GB+ RAM)
- `mistral` - Alternative model
- `codellama` - Good for code/technical tasks

## How It Works

1. **Claude First** (if configured):
   - Tries Claude API first
   - Falls back to local AI if Claude fails or balance is low

2. **Local AI Fallback**:
   - Automatically uses Ollama if Claude unavailable
   - No configuration needed if Ollama is running

3. **Local AI Only**:
   - Set `USE_LOCAL_AI=true` to only use local AI
   - Useful for privacy or cost savings

## Testing Local AI

Test if Ollama is working:

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Test a simple prompt
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello, how are you?"
}'
```

Or test from Node.js:

```bash
cd backend
node -e "import('./utils/aiService.js').then(async m => { console.log('AI Enabled:', await m.isAIEnabled()); });"
```

## Model Recommendations

### For Small Tasks (PDF parsing, categorization)
- **llama3.2** - Fast, uses ~4GB RAM
- Good enough for structured data extraction

### For Complex Tasks (time estimation, recommendations)
- **llama3.1:8b** - Better reasoning, uses ~8GB RAM
- More accurate for complex analysis

### For Best Quality
- **llama3.1:70b** - Best quality, uses ~40GB RAM
- Requires powerful hardware

## Performance Tips

1. **Use smaller models** for faster responses
2. **Keep Ollama running** - First request is slower (model loading)
3. **Use GPU** - Ollama automatically uses GPU if available (much faster)
4. **Close other apps** - Free up RAM for larger models

## Troubleshooting

### "Local AI not available"

1. **Check Ollama is running**:
   ```bash
   # Windows
   tasklist | findstr ollama
   
   # Mac/Linux
   ps aux | grep ollama
   ```

2. **Start Ollama**:
   - Windows: Open Ollama app
   - Mac/Linux: `ollama serve`

3. **Check model is downloaded**:
   ```bash
   ollama list
   ```

4. **Verify connection**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### "Model not found"

Download the model:
```bash
ollama pull llama3.2
```

### Slow Performance

1. Use a smaller model (llama3.2 instead of llama3.1:70b)
2. Ensure GPU is available (check Ollama logs)
3. Close other applications to free RAM
4. Use `USE_LOCAL_AI=auto` to prefer Claude when available

### Out of Memory

1. Use a smaller model
2. Close other applications
3. Reduce `maxTokens` in AI calls
4. Use Claude API instead (set `USE_LOCAL_AI=false`)

## Cost Comparison

### Claude API
- ~$0.01-0.03 per PDF parse
- ~$0.001-0.003 per time estimate
- Monthly costs vary with usage

### Local AI (Ollama)
- **$0** - Completely free
- One-time hardware cost (if upgrading RAM)
- No ongoing costs

## Security & Privacy

### Local AI Benefits:
- ✅ Data never leaves your computer
- ✅ No API keys needed
- ✅ Works offline
- ✅ No usage tracking
- ✅ GDPR compliant (data stays local)

### When to Use Each:

**Use Claude API when:**
- You need best quality
- You don't have powerful hardware
- You want fastest responses
- Internet is reliable

**Use Local AI when:**
- Privacy is critical
- API costs are a concern
- Internet is unreliable
- You have sufficient hardware

## Advanced: Running Ollama on Different Machine

If you have a powerful server, run Ollama there:

1. **On server**: Start Ollama (it listens on all interfaces by default)
2. **In .env**: Set `OLLAMA_BASE_URL=http://server-ip:11434`
3. **Security**: Consider firewall rules or VPN

## Next Steps

1. Install Ollama
2. Download a model
3. Set `USE_LOCAL_AI=auto` in `.env`
4. Restart server
5. Test AI features - they'll automatically use local AI if Claude fails!

For more information, visit: https://ollama.com

