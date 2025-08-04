import type { Folder, Playlist } from "@shared/schema";

export const mockFolders: Folder[] = [
  {
    id: 1,
    name: "Electronic",
    imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
    parentId: null,
    path: "Electronic"
  },
  {
    id: 2,
    name: "Rock",
    imageUrl: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
    parentId: null,
    path: "Rock"
  },
  {
    id: 3,
    name: "Jazz",
    imageUrl: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
    parentId: null,
    path: "Jazz"
  },
  {
    id: 4,
    name: "Hip-Hop",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
    parentId: null,
    path: "Hip-Hop"
  }
];

export const mockPlaylists: Playlist[] = [
  {
    id: 1,
    name: "Deep House Vibes",
    description: "Smooth and groovy deep house tracks",
    coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX692WcMwL2yW",
    tags: ["Deep House", "Electronic", "Chill"],
    folderId: 1,
    trackCount: 120,
    duration: "8h 30m"
  },
  {
    id: 2,
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
    id: 3,
    name: "Progressive Journey",
    description: "Uplifting progressive house tracks",
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX8tZsk68tuDw",
    tags: ["Progressive", "Trance", "Uplifting"],
    folderId: 1,
    trackCount: 95,
    duration: "7h 45m"
  }
];
