var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  folders: () => folders,
  insertFolderSchema: () => insertFolderSchema,
  insertPlaylistFolderSchema: () => insertPlaylistFolderSchema,
  insertPlaylistSchema: () => insertPlaylistSchema,
  insertUserSchema: () => insertUserSchema,
  playlistFolders: () => playlistFolders,
  playlists: () => playlists,
  users: () => users
});
import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  parentId: integer("parent_id"),
  path: text("path").notNull(),
  // Full path for breadcrumb navigation
  tags: text("tags").array()
});
var playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  spotifyUrl: text("spotify_url").notNull(),
  tags: text("tags").array()
});
var playlistFolders = pgTable("playlist_folders", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlist_id").notNull(),
  folderId: integer("folder_id").notNull()
});
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer")
  // viewer, admin
});
var insertFolderSchema = createInsertSchema(folders).omit({
  id: true
});
var insertPlaylistSchema = createInsertSchema(playlists).omit({
  id: true
});
var insertPlaylistFolderSchema = createInsertSchema(playlistFolders).omit({
  id: true
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, isNull, inArray, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
var PostgresSessionStore = connectPg(session);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getFolders(parentId) {
    if (parentId) {
      return await db.select().from(folders).where(eq(folders.parentId, parentId));
    } else {
      return await db.select().from(folders).where(isNull(folders.parentId));
    }
  }
  async getFolderById(id) {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder || void 0;
  }
  async createFolder(folder) {
    const [newFolder] = await db.insert(folders).values(folder).returning();
    return newFolder;
  }
  async updateFolder(id, updates) {
    const [updatedFolder] = await db.update(folders).set(updates).where(eq(folders.id, id)).returning();
    return updatedFolder;
  }
  async deleteFolder(id) {
    await db.delete(playlistFolders).where(eq(playlistFolders.folderId, id));
    await db.delete(folders).where(eq(folders.id, id));
  }
  async getFolderPath(folderId) {
    const path3 = [];
    let currentId = folderId;
    while (currentId !== null) {
      const folder = await this.getFolderById(currentId);
      if (folder) {
        path3.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    return path3;
  }
  async getPlaylists(folderId) {
    if (folderId) {
      const playlistIds = await db.select({ playlistId: playlistFolders.playlistId }).from(playlistFolders).where(eq(playlistFolders.folderId, folderId));
      if (playlistIds.length === 0) return [];
      return await db.select().from(playlists).where(inArray(playlists.id, playlistIds.map((p) => p.playlistId)));
    } else {
      return await db.select().from(playlists);
    }
  }
  async getPlaylistById(id) {
    const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
    return playlist || void 0;
  }
  async createPlaylist(playlist, folderIds) {
    const [newPlaylist] = await db.insert(playlists).values(playlist).returning();
    if (folderIds && folderIds.length > 0) {
      const playlistFolderInserts = folderIds.map((folderId) => ({
        playlistId: newPlaylist.id,
        folderId
      }));
      await db.insert(playlistFolders).values(playlistFolderInserts);
    }
    return newPlaylist;
  }
  async searchPlaylists(query) {
    const searchTerm = `%${query.toLowerCase()}%`;
    const allPlaylists = await db.select().from(playlists);
    return allPlaylists.filter(
      (playlist) => playlist.name.toLowerCase().includes(query.toLowerCase()) || playlist.description && playlist.description.toLowerCase().includes(query.toLowerCase()) || playlist.tags && playlist.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    );
  }
  async searchFolders(query) {
    const searchTerm = query.toLowerCase();
    const allFolders = await db.select().from(folders);
    return allFolders.filter(
      (folder) => folder.name.toLowerCase().includes(searchTerm) || folder.description && folder.description.toLowerCase().includes(searchTerm)
    );
  }
  async getAllPlaylists() {
    return await db.select().from(playlists);
  }
  async updatePlaylist(id, updates) {
    const [updatedPlaylist] = await db.update(playlists).set(updates).where(eq(playlists.id, id)).returning();
    return updatedPlaylist;
  }
  async deletePlaylist(id) {
    await db.delete(playlistFolders).where(eq(playlistFolders.playlistId, id));
    await db.delete(playlists).where(eq(playlists.id, id));
  }
  async addPlaylistToFolder(playlistId, folderId) {
    await db.insert(playlistFolders).values({ playlistId, folderId });
  }
  async removePlaylistFromFolder(playlistId, folderId) {
    await db.delete(playlistFolders).where(eq(playlistFolders.playlistId, playlistId));
  }
  async searchPlaylistsByTag(tag) {
    const result = await db.select().from(playlists).where(sql`${playlists.tags} @> ARRAY[${tag}]::text[]`);
    return result;
  }
  async searchFoldersByTag(tag) {
    const result = await db.select().from(folders).where(sql`${folders.tags} @> ARRAY[${tag}]::text[]`);
    return result;
  }
  async getAllTags() {
    const playlistTags = await db.select({ tags: playlists.tags }).from(playlists).where(sql`${playlists.tags} IS NOT NULL`);
    const folderTags = await db.select({ tags: folders.tags }).from(folders).where(sql`${folders.tags} IS NOT NULL`);
    const allTags = /* @__PURE__ */ new Set();
    playlistTags.forEach((item) => {
      if (item.tags) {
        item.tags.forEach((tag) => allTags.add(tag));
      }
    });
    folderTags.forEach((item) => {
      if (item.tags) {
        item.tags.forEach((tag) => allTags.add(tag));
      }
    });
    return Array.from(allTags).sort();
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !await comparePasswords(password, user.password)) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });
  app2.post("/api/auth/login", async (req, res, next) => {
    const { username, password } = req.body;
    if (username === "viewer" && password === "moonshot") {
      const user = await storage.getUserByUsername("viewer") || await storage.createUser({
        username: "viewer",
        password: await hashPassword("moonshot"),
        role: "viewer"
      });
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json({ user, role: user.role });
      });
      return;
    }
    if (username === "admin" && password === "letsgotospace") {
      const user = await storage.getUserByUsername("admin") || await storage.createUser({
        username: "admin",
        password: await hashPassword("letsgotospace"),
        role: "admin"
      });
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json({ user, role: user.role });
      });
      return;
    }
    passport.authenticate("local", (err, user) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      req.login(user, (err2) => {
        if (err2) return next(err2);
        res.status(200).json({ user, role: user.role });
      });
    })(req, res, next);
  });
  app2.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json({ user: req.user, role: req.user?.role });
  });
}

// server/routes.ts
import { eq as eq2 } from "drizzle-orm";

// server/openrouter.ts
function getLocalRecommendations(query, availablePlaylistsData) {
  const lowercaseQuery = query.toLowerCase();
  const keywords = lowercaseQuery.split(/\s+/);
  const scoredPlaylists = availablePlaylistsData.map((playlist) => {
    let score = 0;
    const searchText = `${playlist.name} ${playlist.description || ""} ${(playlist.tags || []).join(" ")}`.toLowerCase();
    keywords.forEach((keyword) => {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    });
    if (playlist.name.toLowerCase().includes(lowercaseQuery)) {
      score += 3;
    }
    (playlist.tags || []).forEach((tag) => {
      if (keywords.some((keyword) => tag.toLowerCase().includes(keyword))) {
        score += 2;
      }
    });
    return { ...playlist, score };
  });
  const recommendations = scoredPlaylists.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (recommendations.length === 0) {
    const shuffled = [...availablePlaylistsData].sort(() => 0.5 - Math.random());
    return {
      explanation: "I couldn't find exact matches for your request, so here are some popular playlists from your collection:",
      recommendations: shuffled.slice(0, 3)
    };
  }
  return {
    explanation: `Based on your request "${query}", here are some playlists that might interest you:`,
    recommendations
  };
}
async function getPlaylistRecommendations(query, availablePlaylistsData) {
  try {
    console.log("Making OpenRouter API request with key:", process.env.OPENROUTER_API_KEY ? "Key exists" : "No key found");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Playlist Recommendation System"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a music recommendation AI. You have access to a collection of playlists with their names, descriptions, and tags. Based on the user's request, recommend 2-3 playlists from the available collection that best match their needs.

Available playlists:
${availablePlaylistsData.map((p) => `- ID:${p.id} "${p.name}": ${p.description || "No description"} [Tags: ${p.tags?.join(", ") || "None"}]`).join("\n")}

Respond with a JSON object in this exact format:
{
  "explanation": "Brief explanation of why these playlists match the request",
  "recommendations": [
    {
      "id": playlist_id,
      "name": "playlist_name",
      "reason": "why this playlist fits the request"
    }
  ]
}`
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 1e3,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText);
      console.log("Falling back to local recommendations");
      return getLocalRecommendations(query, availablePlaylistsData);
    }
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.log("No response from AI, falling back to local recommendations");
      return getLocalRecommendations(query, availablePlaylistsData);
    }
    try {
      let cleanContent = content;
      if (cleanContent.includes("```json")) {
        cleanContent = cleanContent.replace(/```json\s*/, "").replace(/```\s*$/, "");
      }
      const parsed = JSON.parse(cleanContent);
      const fullRecommendations = parsed.recommendations.map((rec) => {
        const fullPlaylist = availablePlaylistsData.find((p) => p.id === rec.id);
        return fullPlaylist ? { ...fullPlaylist, reason: rec.reason } : null;
      }).filter(Boolean);
      return {
        explanation: parsed.explanation,
        recommendations: fullRecommendations
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("AI response was:", content);
      return getLocalRecommendations(query, availablePlaylistsData);
    }
  } catch (error) {
    console.error("OpenRouter API error:", error);
    return getLocalRecommendations(query, availablePlaylistsData);
  }
}

// server/routes.ts
async function registerRoutes(app2) {
  setupAuth(app2);
  const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };
  const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated() || req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };
  app2.get("/api/folders", requireAuth, async (req, res) => {
    try {
      const parentId = req.query.parentId ? parseInt(req.query.parentId) : void 0;
      const folders2 = await storage.getFolders(parentId);
      res.json(folders2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });
  app2.post("/api/folders", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFolderSchema.parse(req.body);
      const folder = await storage.createFolder(validatedData);
      res.status(201).json(folder);
    } catch (error) {
      res.status(400).json({ error: "Invalid folder data" });
    }
  });
  app2.get("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const folder = await storage.getFolderById(id);
      if (!folder) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folder" });
    }
  });
  app2.patch("/api/folders/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const folder = await storage.updateFolder(id, req.body);
      res.json(folder);
    } catch (error) {
      console.error("Error updating folder:", error);
      res.status(400).json({ error: "Failed to update folder" });
    }
  });
  app2.delete("/api/folders/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFolder(id);
      res.json({ message: "Folder deleted successfully" });
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });
  app2.get("/api/folders/:id/path", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const path3 = await storage.getFolderPath(id);
      res.json(path3);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folder path" });
    }
  });
  app2.get("/api/playlists", requireAuth, async (req, res) => {
    try {
      const folderId = req.query.folderId ? parseInt(req.query.folderId) : void 0;
      const playlists2 = await storage.getPlaylists(folderId);
      res.json(playlists2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch playlists" });
    }
  });
  app2.get("/api/playlists/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playlist = await storage.getPlaylistById(id);
      if (!playlist) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch playlist" });
    }
  });
  app2.post("/api/playlists", requireAdmin, async (req, res) => {
    try {
      const { folderIds, ...playlistData } = req.body;
      const validatedData = insertPlaylistSchema.parse(playlistData);
      if (validatedData.spotifyUrl) {
        const existingPlaylists = await storage.getAllPlaylists();
        const duplicate = existingPlaylists.find((p) => p.spotifyUrl === validatedData.spotifyUrl);
        if (duplicate) {
          return res.status(409).json({ error: "This playlist already exists in your collection" });
        }
      }
      const playlist = await storage.createPlaylist(validatedData, folderIds);
      res.status(201).json(playlist);
    } catch (error) {
      console.error("Error creating playlist:", error);
      res.status(400).json({ error: "Invalid playlist data" });
    }
  });
  app2.put("/api/playlists/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { folderIds, ...updates } = req.body;
      const playlist = await storage.updatePlaylist(id, updates);
      if (folderIds !== void 0) {
        await db.delete(playlistFolders).where(eq2(playlistFolders.playlistId, id));
        if (folderIds.length > 0) {
          await db.insert(playlistFolders).values(folderIds.map((folderId) => ({ playlistId: id, folderId })));
        }
      }
      res.json(playlist);
    } catch (error) {
      console.error("Error updating playlist:", error);
      res.status(400).json({ error: "Failed to update playlist" });
    }
  });
  app2.delete("/api/playlists/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlaylist(id);
      res.json({ message: "Playlist deleted successfully" });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ error: "Failed to delete playlist" });
    }
  });
  app2.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q || "";
      const tag = req.query.tag || "";
      if (!query && !tag) {
        return res.json({ playlists: [], folders: [] });
      }
      let playlists2, folders2;
      if (tag) {
        const tags = tag.split(",");
        let filteredPlaylists = [];
        let filteredFolders = [];
        for (const singleTag of tags) {
          const tagPlaylists = await storage.searchPlaylistsByTag(singleTag.trim());
          const tagFolders = await storage.searchFoldersByTag(singleTag.trim());
          filteredPlaylists = [...filteredPlaylists, ...tagPlaylists];
          filteredFolders = [...filteredFolders, ...tagFolders];
        }
        playlists2 = filteredPlaylists.filter(
          (playlist, index, self) => index === self.findIndex((p) => p.id === playlist.id)
        );
        folders2 = filteredFolders.filter(
          (folder, index, self) => index === self.findIndex((f) => f.id === folder.id)
        );
        if (query) {
          playlists2 = playlists2.filter(
            (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.description && p.description.toLowerCase().includes(query.toLowerCase())
          );
          folders2 = folders2.filter(
            (f) => f.name.toLowerCase().includes(query.toLowerCase()) || f.description && f.description.toLowerCase().includes(query.toLowerCase())
          );
        }
      } else {
        playlists2 = await storage.searchPlaylists(query);
        folders2 = await storage.searchFolders(query);
      }
      res.json({ playlists: playlists2, folders: folders2 });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  });
  app2.get("/api/tags", requireAuth, async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Tags error:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });
  app2.get("/api/playlists/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        res.status(400).json({ error: "Query parameter is required" });
        return;
      }
      const playlists2 = await storage.searchPlaylists(query);
      res.json(playlists2);
    } catch (error) {
      res.status(500).json({ error: "Failed to search playlists" });
    }
  });
  app2.post("/api/playlists/sync", requireAdmin, async (req, res) => {
    res.json({ message: "Sync temporarily disabled to prevent data loss", results: [] });
    return;
    try {
      const playlists2 = await storage.getAllPlaylists();
      const results = [];
      for (const playlist of playlists2) {
        try {
          const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(playlist.spotifyUrl)}`;
          const response = await fetch(oembedUrl);
          if (!response.ok) {
            results.push({ id: playlist.id, status: "skipped", reason: "spotify_unavailable" });
            continue;
          }
          const data = await response.json();
          await storage.updatePlaylist(playlist.id, {
            name: data.title || playlist.name,
            coverUrl: data.thumbnail_url || playlist.coverUrl
          });
          results.push({
            id: playlist.id,
            status: "updated",
            name: data.title || playlist.name,
            oldName: playlist.name,
            imageUpdated: !!(data.thumbnail_url && data.thumbnail_url !== playlist.coverUrl)
          });
        } catch (error) {
          results.push({
            id: playlist.id,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      res.json({
        message: `Sync completed - updated ${results.filter((r) => r.status === "updated").length} playlists`,
        results
      });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Failed to sync playlists" });
    }
  });
  app2.post("/api/playlists/recommend", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }
      const playlists2 = await storage.getAllPlaylists();
      if (playlists2.length === 0) {
        return res.json({
          explanation: "No playlists available for recommendations.",
          recommendations: []
        });
      }
      const recommendations = await getPlaylistRecommendations(query, playlists2);
      res.json(recommendations);
    } catch (error) {
      console.error("AI recommendation error:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });
  app2.get("/api/playlists/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playlist = await storage.getPlaylistById(id);
      if (!playlist) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch playlist" });
    }
  });
  app2.get("/api/playlist-folders/:playlistId", requireAuth, async (req, res) => {
    try {
      const playlistId = parseInt(req.params.playlistId);
      const relationships = await db.select().from(playlistFolders).where(eq2(playlistFolders.playlistId, playlistId));
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching playlist folders:", error);
      res.status(500).json({ error: "Failed to fetch playlist folders" });
    }
  });
  app2.post("/api/spotify/parse", requireAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.includes("spotify.com/playlist/")) {
        return res.status(400).json({ error: "Invalid Spotify playlist URL" });
      }
      const playlistId = url.split("/playlist/")[1]?.split("?")[0];
      if (!playlistId) {
        return res.status(400).json({ error: "Could not extract playlist ID" });
      }
      const mockData = {
        name: "New Playlist",
        description: "A great playlist",
        coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        trackCount: Math.floor(Math.random() * 100) + 20,
        duration: `${Math.floor(Math.random() * 5) + 2}h ${Math.floor(Math.random() * 60)}m`
      };
      res.json(mockData);
    } catch (error) {
      res.status(500).json({ error: "Failed to parse Spotify URL" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
var vite_config_default = defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = process.env.PORT || 3e3;
  server.listen({
    port,
    host: "0.0.0.0"
  }, () => {
    log(`serving on port ${port}`);
  });
})();
