# Vercel Deployment Guide for Prashna AI

Since Node.js/npm are not available on your system, we'll use Vercel's web interface for deployment.

## 🚀 Step-by-Step Deployment

### Step 1: Prepare Your GitHub Repository
✅ **Already Done**: Your code is already pushed to GitHub at `https://github.com/hardikjatolia/Prashna-Ai.git`

### Step 2: Sign Up/Login to Vercel
1. **Visit**: https://vercel.com
2. **Sign Up**: If you don't have an account
3. **Login**: Use your GitHub account for easy integration

### Step 3: Import Your Repository
1. **Go to Vercel Dashboard**
2. **Click "Add New..."** or "New Project"
3. **Select "Import Git Repository"**
4. **Choose**: `hardikjatolia/Prashna-Ai` from your GitHub
5. **Click "Import"**

### Step 4: Configure Project Settings
Vercel will automatically detect your project configuration:

#### **Framework Settings**:
- **Framework**: Python (Auto-detected)
- **Build Command**: `echo "Build completed"` (from package.json)
- **Output Directory**: `frontend` (from vercel.json)
- **Install Command**: `pip install -r requirements.txt`

#### **Environment Variables** (CRITICAL):
Add these in Vercel Dashboard → Settings → Environment Variables:

```
HF_TOKEN=hf_your_huggingface_api_key_here
MODEL_ID=baidu/ERNIE-4.5-VL-28B-A3B-PT
PYTHON_VERSION=3.9
```

**Important**: Use your actual Hugging Face API token that starts with `hf_`

### Step 5: Deploy
1. **Review Settings**: Double-check all configurations
2. **Click "Deploy"**
3. **Wait**: Vercel will build and deploy your application
4. **Get URL**: You'll receive a deployment URL like `https://prashna-ai.vercel.app`

## 🔧 Configuration Files Already Prepared

### **vercel.json** ✅
- Routes API calls to serverless function
- Serves static files correctly
- Proper CORS configuration
- Python 3.9 runtime

### **api/index.py** ✅
- Serverless function ready for Vercel
- ERNIE-4.5-VL model integration
- Chemical accuracy with LaTeX formatting

### **package.json** ✅
- Vercel deployment metadata
- Build and dependency scripts

## 🧪 Post-Deployment Testing

Once deployed, test these URLs:

1. **Main Application**: `https://your-domain.vercel.app`
2. **API Health Check**: `https://your-domain.vercel.app/api/health`
3. **API Chat Endpoint**: `https://your-domain.vercel.app/api/chat/stream`

## 📱 Features Ready for Production

- **🤖 ERNIE-4.5-VL Model**: Advanced AI with 28B parameters
- **🧪 Chemical Accuracy**: LaTeX formatted equations
- **⚡ Optimized Performance**: Fast response times
- **🎨 Beautiful UI**: Modern, responsive design
- **🌙 Dark Mode**: Theme switching support
- **📱 Mobile Friendly**: Works on all devices
- **🔒 Secure**: Environment variable protection

## 🔍 Troubleshooting

### **Common Issues & Solutions**:

1. **Build Failures**
   - Check requirements.txt has all dependencies
   - Verify Python version compatibility
   - Check for syntax errors in api/index.py

2. **API Key Issues**
   - Ensure HF_TOKEN is correctly set in Vercel environment
   - Verify token has proper permissions
   - Check for extra spaces in token value

3. **Static File 404 Errors**
   - Fixed in our vercel.json configuration
   - Routes properly configured for /static/ paths
   - All assets (logo.png, style.css, app.js) should work

4. **CORS Issues**
   - vercel.json includes proper CORS headers
   - API routes configured correctly
   - Frontend should work without CORS errors

## 📊 Monitoring & Analytics

After deployment:
1. **Vercel Dashboard**: Monitor usage and performance
2. **Hugging Face**: Track API usage and quotas
3. **Error Logs**: Check Vercel function logs
4. **Performance**: Monitor response times

## 🔄 Automatic Deployments

Set up GitHub integration for automatic deployments:
- Every push to main branch triggers new deployment
- Preview deployments for testing changes
- Rollback capability if issues arise

## 💡 Pro Tips

1. **Custom Domain**: Add your own domain in Vercel settings
2. **Edge Functions**: Vercel automatically scales based on traffic
3. **Analytics**: Enable Vercel Analytics for insights
4. **Environment**: Use different environment variables for staging/production

## 🎯 Next Steps

1. **Follow this guide** to deploy to Vercel
2. **Test thoroughly** after deployment
3. **Monitor performance** in production
4. **Iterate** based on user feedback

Your Prashna AI is fully prepared for Vercel deployment! 🚀
