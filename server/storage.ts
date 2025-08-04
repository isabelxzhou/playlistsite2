import { folders, playlists, users, playlistFolders, type Folder, type Playlist, type InsertFolder, type InsertPlaylist, type User, type InsertUser, type InsertPlaylistFolder } from "@shared/schema";
import { db } from "./db";
import { eq, like, or, isNull, inArray, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Folders
  getFolders(parentId?: number): Promise<Folder[]>;
  getFolderById(id: number): Promise<Folder | undefined>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: number, updates: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: number): Promise<void>;
  getFolderPath(folderId: number): Promise<Folder[]>;
  
  // Playlists
  getPlaylists(folderId?: number): Promise<Playlist[]>;
  getPlaylistById(id: number): Promise<Playlist | undefined>;
  createPlaylist(playlist: InsertPlaylist, folderIds?: number[]): Promise<Playlist>;
  searchPlaylists(query: string): Promise<Playlist[]>;
  searchFolders(query: string): Promise<Folder[]>;
  searchPlaylistsByTag(tag: string): Promise<Playlist[]>;
  searchFoldersByTag(tag: string): Promise<Folder[]>;
  getAllPlaylists(): Promise<Playlist[]>;
  getAllTags(): Promise<string[]>;
  updatePlaylist(id: number, updates: Partial<Playlist>): Promise<Playlist>;
  deletePlaylist(id: number): Promise<void>;
  addPlaylistToFolder(playlistId: number, folderId: number): Promise<void>;
  removePlaylistFromFolder(playlistId: number, folderId: number): Promise<void>;
  
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getFolders(parentId?: number): Promise<Folder[]> {
    if (parentId) {
      return await db.select().from(folders).where(eq(folders.parentId, parentId));
    } else {
      return await db.select().from(folders).where(isNull(folders.parentId));
    }
  }

  async getFolderById(id: number): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder || undefined;
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [newFolder] = await db.insert(folders).values(folder).returning();
    return newFolder;
  }

  async updateFolder(id: number, updates: Partial<Folder>): Promise<Folder> {
    const [updatedFolder] = await db.update(folders)
      .set(updates)
      .where(eq(folders.id, id))
      .returning();
    return updatedFolder;
  }

  async deleteFolder(id: number): Promise<void> {
    // First remove all playlist-folder relationships for this folder
    await db.delete(playlistFolders).where(eq(playlistFolders.folderId, id));
    
    // Then delete the folder
    await db.delete(folders).where(eq(folders.id, id));
  }

  async getFolderPath(folderId: number): Promise<Folder[]> {
    const path: Folder[] = [];
    let currentId: number | null = folderId;
    
    while (currentId !== null) {
      const folder = await this.getFolderById(currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    
    return path;
  }

  async getPlaylists(folderId?: number): Promise<Playlist[]> {
    if (folderId) {
      // Get playlists that belong to this folder through playlist_folders junction table
      const playlistIds = await db
        .select({ playlistId: playlistFolders.playlistId })
        .from(playlistFolders)
        .where(eq(playlistFolders.folderId, folderId));
      
      if (playlistIds.length === 0) return [];
      
      return await db
        .select()
        .from(playlists)
        .where(inArray(playlists.id, playlistIds.map(p => p.playlistId)));
    } else {
      // Get all playlists when no folder is specified
      return await db.select().from(playlists);
    }
  }

  async getPlaylistById(id: number): Promise<Playlist | undefined> {
    const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
    return playlist || undefined;
  }

  async createPlaylist(playlist: InsertPlaylist, folderIds?: number[]): Promise<Playlist> {
    const [newPlaylist] = await db.insert(playlists).values(playlist).returning();
    
    // Add playlist to folders if folderIds are provided
    if (folderIds && folderIds.length > 0) {
      const playlistFolderInserts = folderIds.map(folderId => ({
        playlistId: newPlaylist.id,
        folderId: folderId
      }));
      await db.insert(playlistFolders).values(playlistFolderInserts);
    }
    
    return newPlaylist;
  }

  async searchPlaylists(query: string): Promise<Playlist[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const allPlaylists = await db.select().from(playlists);
    
    // Filter playlists that match in name, description, or tags
    return allPlaylists.filter(playlist => 
      playlist.name.toLowerCase().includes(query.toLowerCase()) ||
      (playlist.description && playlist.description.toLowerCase().includes(query.toLowerCase())) ||
      (playlist.tags && playlist.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())))
    );
  }

  async searchFolders(query: string): Promise<Folder[]> {
    const searchTerm = query.toLowerCase();
    const allFolders = await db.select().from(folders);
    
    // Filter folders that match in name or description
    return allFolders.filter(folder => 
      folder.name.toLowerCase().includes(searchTerm) ||
      (folder.description && folder.description.toLowerCase().includes(searchTerm))
    );
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    return await db.select().from(playlists);
  }

  async updatePlaylist(id: number, updates: Partial<Playlist>): Promise<Playlist> {
    const [updatedPlaylist] = await db
      .update(playlists)
      .set(updates)
      .where(eq(playlists.id, id))
      .returning();
    return updatedPlaylist;
  }

  async deletePlaylist(id: number): Promise<void> {
    // First delete from playlist_folders junction table
    await db.delete(playlistFolders).where(eq(playlistFolders.playlistId, id));
    // Then delete the playlist itself
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  async addPlaylistToFolder(playlistId: number, folderId: number): Promise<void> {
    await db.insert(playlistFolders).values({ playlistId, folderId });
  }

  async removePlaylistFromFolder(playlistId: number, folderId: number): Promise<void> {
    await db.delete(playlistFolders)
      .where(eq(playlistFolders.playlistId, playlistId));
  }

  async searchPlaylistsByTag(tag: string): Promise<Playlist[]> {
    const result = await db.select()
      .from(playlists)
      .where(sql`${playlists.tags} @> ARRAY[${tag}]::text[]`);
    return result;
  }

  async searchFoldersByTag(tag: string): Promise<Folder[]> {
    const result = await db.select()
      .from(folders)
      .where(sql`${folders.tags} @> ARRAY[${tag}]::text[]`);
    return result;
  }

  async getAllTags(): Promise<string[]> {
    const playlistTags = await db.select({ tags: playlists.tags })
      .from(playlists)
      .where(sql`${playlists.tags} IS NOT NULL`);
    
    const folderTags = await db.select({ tags: folders.tags })
      .from(folders)
      .where(sql`${folders.tags} IS NOT NULL`);

    const allTags = new Set<string>();
    
    playlistTags.forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => allTags.add(tag));
      }
    });
    
    folderTags.forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }
}

export class MemStorage implements IStorage {
  private folders: Map<number, Folder>;
  private playlists: Map<number, Playlist>;
  private users: Map<number, User>;
  private currentFolderId: number;
  private currentPlaylistId: number;
  private currentUserId: number;
  sessionStore: any;

  constructor() {
    this.folders = new Map();
    this.playlists = new Map();
    this.users = new Map();
    this.currentFolderId = 1;
    this.currentPlaylistId = 1;
    this.currentUserId = 1;
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
    this.initializeMockData();
  }

  private initializeMockData() {
    // Create root folders
    const rootFolders = [
      { name: "Electronic", description: "Electronic music and beats", imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: null, path: "Electronic", tags: ["Electronic", "Music", "Digital"] },
      { name: "Rock", description: "Rock music from classic to modern", imageUrl: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: null, path: "Rock", tags: ["Rock", "Guitar", "Classic"] },
      { name: "Jazz", description: "Smooth jazz and instrumental", imageUrl: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: null, path: "Jazz", tags: ["Jazz", "Smooth", "Instrumental"] },
      { name: "Hip-Hop", description: "Hip-hop and rap tracks", imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: null, path: "Hip-Hop", tags: ["Hip-Hop", "Rap", "Urban"] }
    ];

    rootFolders.forEach(folder => {
      const id = this.currentFolderId++;
      this.folders.set(id, { ...folder, id });
    });

    // Create subfolders
    const subFolders = [
      { name: "Deep House", description: "Deep house electronic music", imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: 1, path: "Electronic/Deep House", tags: ["Deep House", "Electronic", "Groovy"] },
      { name: "Techno", description: "Techno and dance music", imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: 1, path: "Electronic/Techno", tags: ["Techno", "Dance", "High Energy"] },
      { name: "Ambient", description: "Ambient and atmospheric sounds", imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300", parentId: 1, path: "Electronic/Ambient", tags: ["Ambient", "Atmospheric", "Chill"] }
    ];

    subFolders.forEach(folder => {
      const id = this.currentFolderId++;
      this.folders.set(id, { ...folder, id });
    });

    // Create playlists
    const mockPlaylists = [
      {
        name: "Deep House Vibes",
        description: "Smooth and groovy deep house tracks",
        coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX692WcMwL2yW",
        tags: ["Deep House", "Electronic", "Chill"],
        folderId: 5,
        trackCount: 120,
        duration: "8h 30m"
      },
      {
        name: "Synthwave Nights",
        description: "Retro electronic synthwave journey",
        coverUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM",
        tags: ["Synthwave", "Retro", "80s"],
        folderId: 1,
        trackCount: 85,
        duration: "6h 15m"
      },
      {
        name: "Progressive Journey",
        description: "Uplifting progressive house tracks",
        coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX8tZsk68tuDw",
        tags: ["Progressive", "Trance", "Uplifting"],
        folderId: 1,
        trackCount: 95,
        duration: "7h 45m"
      },
      {
        name: "Techno Underground",
        description: "Dark and driving techno beats",
        coverUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675",
        tags: ["Techno", "Underground", "Dark"],
        folderId: 6,
        trackCount: 110,
        duration: "9h 20m"
      },
      {
        name: "Ambient Waves",
        description: "Peaceful ambient soundscapes",
        coverUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ",
        tags: ["Ambient", "Relaxing", "Meditation"],
        folderId: 7,
        trackCount: 75,
        duration: "5h 30m"
      },
      {
        name: "DnB Energy",
        description: "High-energy drum and bass",
        coverUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
        tags: ["Drum & Bass", "High Energy", "Workout"],
        folderId: 1,
        trackCount: 140,
        duration: "10h 15m"
      }
    ];

    mockPlaylists.forEach(playlist => {
      const id = this.currentPlaylistId++;
      this.playlists.set(id, { ...playlist, id });
    });

    // Create default users
    const defaultUsers = [
      { username: "viewer", password: "nothingnowhere", role: "viewer" },
      { username: "admin", password: "mathrock", role: "admin" }
    ];

    defaultUsers.forEach(user => {
      const id = this.currentUserId++;
      this.users.set(id, { ...user, id });
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const newUser: User = { ...insertUser, id, role: insertUser.role || "viewer" };
    this.users.set(id, newUser);
    return newUser;
  }

  async getFolders(parentId?: number): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(folder => folder.parentId === parentId);
  }

  async getFolderById(id: number): Promise<Folder | undefined> {
    return this.folders.get(id);
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const id = this.currentFolderId++;
    const newFolder: Folder = { 
      ...folder, 
      id, 
      parentId: folder.parentId ?? null,
      description: folder.description ?? null,
      tags: folder.tags ?? null
    };
    this.folders.set(id, newFolder);
    return newFolder;
  }

  async updateFolder(id: number, updates: Partial<Folder>): Promise<Folder> {
    const folder = this.folders.get(id);
    if (!folder) {
      throw new Error("Folder not found");
    }
    const updatedFolder = { ...folder, ...updates };
    this.folders.set(id, updatedFolder);
    return updatedFolder;
  }

  async deleteFolder(id: number): Promise<void> {
    this.folders.delete(id);
    // No need to clean up playlist-folder relationships in memory storage
    // as they don't exist in this implementation
  }

  async getFolderPath(folderId: number): Promise<Folder[]> {
    const path: Folder[] = [];
    let currentId: number | null = folderId;
    
    while (currentId !== null) {
      const folder = this.folders.get(currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    
    return path;
  }

  async getPlaylists(folderId?: number): Promise<Playlist[]> {
    if (folderId === undefined) {
      return Array.from(this.playlists.values());
    }
    return Array.from(this.playlists.values()).filter(playlist => playlist.folderId === folderId);
  }

  async getPlaylistById(id: number): Promise<Playlist | undefined> {
    return this.playlists.get(id);
  }

  async createPlaylist(playlist: InsertPlaylist): Promise<Playlist> {
    const id = this.currentPlaylistId++;
    const newPlaylist: Playlist = { 
      ...playlist, 
      id, 
      folderId: playlist.folderId ?? null,
      description: playlist.description ?? null,
      coverUrl: playlist.coverUrl ?? null,
      tags: playlist.tags ?? null
    };
    this.playlists.set(id, newPlaylist);
    return newPlaylist;
  }

  async searchPlaylists(query: string): Promise<Playlist[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.playlists.values()).filter(playlist => 
      playlist.name.toLowerCase().includes(searchTerm) ||
      (playlist.tags && playlist.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    return Array.from(this.playlists.values());
  }

  async updatePlaylist(id: number, updates: Partial<Playlist>): Promise<Playlist> {
    const existingPlaylist = this.playlists.get(id);
    if (!existingPlaylist) {
      throw new Error(`Playlist with id ${id} not found`);
    }
    const updatedPlaylist = { ...existingPlaylist, ...updates };
    this.playlists.set(id, updatedPlaylist);
    return updatedPlaylist;
  }

  async deletePlaylist(id: number): Promise<void> {
    this.playlists.delete(id);
  }

  async searchPlaylistsByTag(tag: string): Promise<Playlist[]> {
    return Array.from(this.playlists.values()).filter(playlist => 
      playlist.tags && playlist.tags.includes(tag)
    );
  }

  async searchFoldersByTag(tag: string): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(folder => 
      folder.tags && folder.tags.includes(tag)
    );
  }

  async getAllTags(): Promise<string[]> {
    const allTags = new Set<string>();
    
    // Get playlist tags
    Array.from(this.playlists.values()).forEach(playlist => {
      if (playlist.tags) {
        playlist.tags.forEach(tag => allTags.add(tag));
      }
    });
    
    // Get folder tags
    Array.from(this.folders.values()).forEach(folder => {
      if (folder.tags) {
        folder.tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }
}

export const storage = new DatabaseStorage();
