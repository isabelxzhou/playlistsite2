# Playlist Site

A full-stack web application for managing playlists with React frontend and Express.js backend.

## Deployment to Render

### Prerequisites
1. A Render account
2. A PostgreSQL database (you can use Neon, Supabase, or Render's PostgreSQL service)

### Environment Variables Required
- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: A random string for session encryption
- `OPENROUTER_API_KEY`: (Optional) For AI features

### Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```

2. **Create a new Web Service on Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository with your playlist site

3. **Configure the service**
   - **Name**: `playlist-site` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if you prefer)

4. **Add Environment Variables**
   - Click on "Environment" tab
   - Add the following variables:
     - `NODE_ENV`: `production`
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `SESSION_SECRET`: A random string (e.g., `my-super-secret-key-123`)
     - `OPENROUTER_API_KEY`: (Optional) Your OpenRouter API key

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your application

### Database Setup
If you haven't set up your database yet:
1. Create a PostgreSQL database (Neon, Supabase, or Render PostgreSQL)
2. Get your connection string
3. Add it as the `DATABASE_URL` environment variable
4. The application will automatically create tables on first run

### Local Development
```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`

### Environment Variables
- `PORT`: Server port (defaults to 3000 for local development, Render will set this automatically)
- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: A random string for session encryption
- `OPENROUTER_API_KEY`: (Optional) For AI features 