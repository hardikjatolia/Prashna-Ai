# Vercel Deployment Guide

This guide will help you deploy Prashna AI to Vercel for production use.

## Prerequisites

- Vercel account (free tier works)
- Hugging Face API token
- GitHub repository with your code

## Step 1: Prepare Environment Variables

1. **Get Hugging Face API Token**
   - Visit https://huggingface.co/settings/tokens
   - Create a new token with `read` permissions
   - Copy the token (starts with `hf_`)

2. **Set Environment Variables in Vercel**
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add the following variables:

   ```
   HF_TOKEN=hf_your_actual_token_here
   MODEL_ID=baidu/ERNIE-4.5-VL-28B-A3B-PT
   PYTHON_VERSION=3.9
   ```

## Step 2: Deploy to Vercel

### Option A: Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from your project directory**
   ```bash
   cd /path/to/Prashna-Ai
   vercel --prod
   ```

### Option B: Using GitHub Integration

1. **Connect Repository**
   - Go to Vercel dashboard
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect the framework

2. **Configure Build Settings**
   - Framework Preset: Python
   - Build Command: `echo "Build completed"`
   - Output Directory: `frontend`
   - Install Command: `pip install -r requirements.txt`

3. **Set Environment Variables**
   - Add the same variables as in Step 1

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete

## Step 3: Verify Deployment

1. **Check API Health**
   - Visit `https://your-domain.vercel.app/api/health`
   - Should return: `{"status":"ok","model":"baidu/ERNIE-4.5-VL-28B-A3B-PT"}`

2. **Test Chat Functionality**
   - Visit `https://your-domain.vercel.app`
   - Try sending a message
   - Verify AI responses work correctly

## Configuration Files

### vercel.json
- Configures routing and build settings
- Sets up API routes to `api/index.py`
- Configures static file serving from `frontend/`
- Sets CORS headers for API endpoints

### api/index.py
- Serverless API function for Vercel
- Handles chat streaming requests
- Integrates with Hugging Face API
- Includes web search functionality

### package.json
- Defines project metadata
- Configures Vercel build settings
- Sets Node.js version requirement

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify HF_TOKEN is correctly set in Vercel environment
   - Check token has proper permissions
   - Ensure token doesn't have extra spaces

2. **Build Failures**
   - Check Python version compatibility
   - Verify all dependencies in requirements.txt
   - Check for syntax errors in api/index.py

3. **CORS Issues**
   - Verify vercel.json has proper CORS headers
   - Check frontend API calls use correct URLs

4. **Slow Responses**
   - ERNIE model may have rate limits
   - Consider reducing max_tokens for faster responses
   - Monitor Vercel function execution time

### Performance Optimization

1. **Reduce Response Time**
   - Set `max_tokens: 512` for faster responses
   - Use `temperature: 0.3` for consistent output
   - Enable response caching if needed

2. **Monitor Usage**
   - Check Vercel analytics for API usage
   - Monitor Hugging Face API quota
   - Set up alerts for high usage

## Production Tips

1. **Security**
   - Never commit `.env` files to Git
   - Use Vercel environment variables for secrets
   - Enable rate limiting if needed

2. **Scaling**
   - Vercel automatically scales serverless functions
   - Monitor function execution time limits
   - Consider edge caching for static assets

3. **Monitoring**
   - Set up Vercel Analytics
   - Monitor error rates
   - Track response times

## Deployment Commands

```bash
# Local development
vercel dev

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# Remove deployment
vercel rm <deployment-url>
```

## Support

- **Vercel Documentation**: https://vercel.com/docs
- **Hugging Face API**: https://huggingface.co/docs/api-inference
- **GitHub Issues**: https://github.com/hardikjatolia/Prashna-Ai/issues

Your Prashna AI is now ready for production deployment on Vercel!
