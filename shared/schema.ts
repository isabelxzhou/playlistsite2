import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  parentId: integer("parent_id"),
  path: text("path").notNull(), // Full path for breadcrumb navigation
  tags: text("tags").array(),
});

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  spotifyUrl: text("spotify_url").notNull(),
  tags: text("tags").array(),
});

export const playlistFolders = pgTable("playlist_folders", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlist_id").notNull(),
  folderId: integer("folder_id").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"), // viewer, admin
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
});

export const insertPlaylistSchema = createInsertSchema(playlists).omit({
  id: true,
});

export const insertPlaylistFolderSchema = createInsertSchema(playlistFolders).omit({
  id: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylistFolder = z.infer<typeof insertPlaylistFolderSchema>;
export type PlaylistFolder = typeof playlistFolders.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
