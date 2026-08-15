import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { generateDirectionsService, generatePromptsService } from './src/lib/geminiService';

dotenv.config();

const serverDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3100;

app.use(express.json({ limit: '50mb' }));

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Favicon & Browser Manifest handlers
app.get(['/favicon.ico', '/favicon.png', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎬</text></svg>');
});

app.get('/site.webmanifest', (_req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.json({ name: "HEVI Visual Production Studio", short_name: "HEVI Studio", icons: [], start_url: "/", display: "standalone" });
});

// Phase 2: Generate Scene Directions via Server-Side Gemini API
app.post('/api/generate-directions', async (req, res) => {
  try {
    const result = await generateDirectionsService(req.body);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/generate-directions:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate scene directions'
    });
  }
});

// Phase 3: Generate T2V Prompts via Server-Side Gemini API
app.post('/api/generate-prompts', async (req, res) => {
  try {
    const result = await generatePromptsService(req.body);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/generate-prompts:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate T2V prompts'
    });
  }
});

// Vite Middleware (Development) or Static File Serving (Production)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HEVI Studio Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
