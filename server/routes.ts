import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { setupAuth } from "./auth";
import { insertFolderSchema, insertPlaylistSchema, playlistFolders } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { getPlaylistRecommendations } from "./openrouter";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Middleware to check if user is authenticated
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Middleware to check if user is admin
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };
  // Get folders by parent ID
  app.get("/api/folders", requireAuth, async (req, res) => {
    try {
      const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : undefined;
      const folders = await storage.getFolders(parentId);
      res.json(folders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  // Create a new folder (admin only)
  app.post("/api/folders", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFolderSchema.parse(req.body);
      const folder = await storage.createFolder(validatedData);
      res.status(201).json(folder);
    } catch (error) {
      res.status(400).json({ error: "Invalid folder data" });
    }
  });

  // Get folder by ID
  app.get("/api/folders/:id", requireAuth, async (req, res) => {
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

  // Update folder (admin only)
  app.patch("/api/folders/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const folder = await storage.updateFolder(id, req.body);
      res.json(folder);
    } catch (error) {
      console.error("Error updating folder:", error);
      res.status(400).json({ error: "Failed to update folder" });
    }
  });

  // Delete folder (admin only)
  app.delete("/api/folders/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFolder(id);
      res.json({ message: "Folder deleted successfully" });
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  // Get folder path for breadcrumb navigation
  app.get("/api/folders/:id/path", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const path = await storage.getFolderPath(id);
      res.json(path);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folder path" });
    }
  });

  // Get playlists by folder ID
  app.get("/api/playlists", requireAuth, async (req, res) => {
    try {
      const folderId = req.query.folderId ? parseInt(req.query.folderId as string) : undefined;
      const playlists = await storage.getPlaylists(folderId);
      res.json(playlists);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch playlists" });
    }
  });

  // Get individual playlist by ID
  app.get("/api/playlists/:id", requireAuth, async (req, res) => {
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

  // Create a new playlist (admin only)
  app.post("/api/playlists", requireAdmin, async (req, res) => {
    try {
      const { folderIds, ...playlistData } = req.body;
      const validatedData = insertPlaylistSchema.parse(playlistData);
      
      // Check for duplicate Spotify URLs
      if (validatedData.spotifyUrl) {
        const existingPlaylists = await storage.getAllPlaylists();
        const duplicate = existingPlaylists.find(p => p.spotifyUrl === validatedData.spotifyUrl);
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

  // Update playlist (admin only)
  app.put("/api/playlists/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { folderIds, ...updates } = req.body;
      
      // Update playlist basic info
      const playlist = await storage.updatePlaylist(id, updates);
      
      // Update folder relationships if provided
      if (folderIds !== undefined) {
        // Remove existing relationships
        await db.delete(playlistFolders)
          .where(eq(playlistFolders.playlistId, id));
        
        // Add new relationships
        if (folderIds.length > 0) {
          await db.insert(playlistFolders)
            .values(folderIds.map((folderId: number) => ({ playlistId: id, folderId })));
        }
      }
      
      res.json(playlist);
    } catch (error) {
      console.error("Error updating playlist:", error);
      res.status(400).json({ error: "Failed to update playlist" });
    }
  });

  // Delete playlist (admin only)
  app.delete("/api/playlists/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlaylist(id);
      res.json({ message: "Playlist deleted successfully" });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ error: "Failed to delete playlist" });
    }
  });

  // Search playlists and folders
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const tag = req.query.tag as string || "";
      
      if (!query && !tag) {
        return res.json({ playlists: [], folders: [] });
      }

      let playlists, folders;
      
      if (tag) {
        // Handle multiple tags (comma-separated)
        const tags = tag.split(',');
        let filteredPlaylists: any[] = [];
        let filteredFolders: any[] = [];
        
        for (const singleTag of tags) {
          const tagPlaylists = await storage.searchPlaylistsByTag(singleTag.trim());
          const tagFolders = await storage.searchFoldersByTag(singleTag.trim());
          filteredPlaylists = [...filteredPlaylists, ...tagPlaylists];
          filteredFolders = [...filteredFolders, ...tagFolders];
        }
        
        // Remove duplicates
        playlists = filteredPlaylists.filter((playlist, index, self) => 
          index === self.findIndex(p => p.id === playlist.id)
        );
        folders = filteredFolders.filter((folder, index, self) => 
          index === self.findIndex(f => f.id === folder.id)
        );
        
        // Additional text search if provided
        if (query) {
          playlists = playlists.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
          );
          folders = folders.filter(f => 
            f.name.toLowerCase().includes(query.toLowerCase()) ||
            (f.description && f.description.toLowerCase().includes(query.toLowerCase()))
          );
        }
      } else {
        // Regular search
        playlists = await storage.searchPlaylists(query);
        folders = await storage.searchFolders(query);
      }

      res.json({ playlists, folders });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  });

  // Get all tags endpoint
  app.get("/api/tags", requireAuth, async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Tags error:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  // Search playlists (keep for backward compatibility)
  app.get("/api/playlists/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: "Query parameter is required" });
        return;
      }
      const playlists = await storage.searchPlaylists(query);
      res.json(playlists);
    } catch (error) {
      res.status(500).json({ error: "Failed to search playlists" });
    }
  });

  // SYNC DISABLED TO PREVENT DELETION
  app.post("/api/playlists/sync", requireAdmin, async (req, res) => {
    // EMERGENCY: Sync disabled to prevent playlist deletion
    res.json({ message: 'Sync temporarily disabled to prevent data loss', results: [] });
    return;
    try {
      const playlists = await storage.getAllPlaylists();
      const results = [];
      
      for (const playlist of playlists) {
        try {
          const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(playlist.spotifyUrl)}`;
          const response = await fetch(oembedUrl);
          
          if (!response.ok) {
            // Skip unavailable playlists, don't delete them
            results.push({ id: playlist.id, status: 'skipped', reason: 'spotify_unavailable' });
            continue;
          }
          
          const data = await response.json();
          
          // Only update name and cover image, preserve everything else
          await storage.updatePlaylist(playlist.id, {
            name: data.title || playlist.name,
            coverUrl: data.thumbnail_url || playlist.coverUrl
          });
          
          results.push({ 
            id: playlist.id, 
            status: 'updated', 
            name: data.title || playlist.name,
            oldName: playlist.name,
            imageUpdated: !!(data.thumbnail_url && data.thumbnail_url !== playlist.coverUrl)
          });
        } catch (error) {
          results.push({ 
            id: playlist.id, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      res.json({ 
        message: `Sync completed - updated ${results.filter(r => r.status === 'updated').length} playlists`, 
        results 
      });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Failed to sync playlists" });
    }
  });

  // AI Playlist Recommendations
  app.post("/api/playlists/recommend", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query is required" });
      }

      // Get all available playlists
      const playlists = await storage.getAllPlaylists();
      
      if (playlists.length === 0) {
        return res.json({
          explanation: "No playlists available for recommendations.",
          recommendations: []
        });
      }

      // Get AI recommendations
      const recommendations = await getPlaylistRecommendations(query, playlists);
      res.json(recommendations);
    } catch (error) {
      console.error("AI recommendation error:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  // Get playlist by ID
  app.get("/api/playlists/:id", requireAuth, async (req, res) => {
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

  // Get playlist-folder relationships for a specific playlist
  app.get("/api/playlist-folders/:playlistId", requireAuth, async (req, res) => {
    try {
      const playlistId = parseInt(req.params.playlistId);
      const relationships = await db
        .select()
        .from(playlistFolders)
        .where(eq(playlistFolders.playlistId, playlistId));
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching playlist folders:", error);
      res.status(500).json({ error: "Failed to fetch playlist folders" });
    }
  });

  // Spotify URL parser for admin
  app.post("/api/spotify/parse", requireAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.includes("spotify.com/playlist/")) {
        return res.status(400).json({ error: "Invalid Spotify playlist URL" });
      }

      // Extract playlist ID from URL
      const playlistId = url.split("/playlist/")[1]?.split("?")[0];
      if (!playlistId) {
        return res.status(400).json({ error: "Could not extract playlist ID" });
      }

      // Mock data for Spotify API response (in real implementation, you'd call Spotify API)
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

  const httpServer = createServer(app);
  return httpServer;
}
