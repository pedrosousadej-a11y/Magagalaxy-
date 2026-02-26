import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "magagalaxy-secret-key-123";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.get("/api/user", (req: any, res: any) => {
    const token = req.cookies.auth_token;
    if (!token) return res.json({ user: null });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ user: decoded });
    } catch (err) {
      res.json({ user: null });
    }
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("auth_token", {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    });
    res.json({ success: true });
  });

  // OAuth URLs
  app.get("/api/auth/:provider/url", (req, res) => {
    const { provider } = req.params;
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/auth/callback/${provider}`;

    // Check if we have credentials, otherwise use demo mode
    const hasCreds = (provider === 'google' && process.env.GOOGLE_CLIENT_ID) ||
                     (provider === 'facebook' && process.env.FACEBOOK_CLIENT_ID) ||
                     (provider === 'apple' && process.env.APPLE_CLIENT_ID);

    if (!hasCreds) {
      // Return a special demo URL that points directly to our callback with a dummy code
      return res.json({ url: `${appUrl}/auth/callback/${provider}?code=demo_mode_active` });
    }

    let authUrl = "";
    if (provider === "google") {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile email",
        access_type: "offline",
        prompt: "select_account",
      });
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else if (provider === "facebook") {
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID!,
        redirect_uri: redirectUri,
        scope: "email,public_profile",
        response_type: "code",
      });
      authUrl = `https://www.facebook.com/v12.0/dialog/oauth?${params}`;
    } else if (provider === "apple") {
      const params = new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "name email",
        response_mode: "form_post",
      });
      authUrl = `https://appleid.apple.com/auth/authorize?${params}`;
    }

    res.json({ url: authUrl });
  });

  // OAuth Callbacks
  app.get("/auth/callback/:provider", async (req, res) => {
    const { provider } = req.params;
    const { code } = req.query;

    // In a real app, you would exchange the code for tokens here
    // For this demo, we'll simulate a successful login
    const user = {
      id: `id_${Math.random().toString(36).substr(2, 9)}`,
      name: `Usuário ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
      email: `user@${provider}.com`,
      provider,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

    res.cookie("auth_token", token, {
      secure: true,
      sameSite: "none",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(user)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação bem-sucedida. Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);
  });

  // Handle Apple's form_post
  app.post("/auth/callback/apple", async (req, res) => {
    // Similar to above but handling POST data
    const user = { id: "apple_user", name: "Apple User", provider: "apple" };
    const token = jwt.sign(user, JWT_SECRET);
    res.cookie("auth_token", token, { secure: true, sameSite: "none", httpOnly: true });
    res.send("<script>window.opener.postMessage({type:'OAUTH_AUTH_SUCCESS'}, '*');window.close();</script>");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
