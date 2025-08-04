import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, ListMusic, Link, RefreshCw, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { Folder } from "@shared/schema";

interface AdminPanelProps {
  folders: Folder[];
  currentFolderId?: number;
}

export default function AdminPanel({ folders, currentFolderId }: AdminPanelProps) {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [playlistDialog, setPlaylistDialog] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [adminFolderPopoverOpen, setAdminFolderPopoverOpen] = useState(false);
  
  // Playlist form state
  const [playlistForm, setPlaylistForm] = useState({
    name: "",
    description: "",
    spotifyUrl: "",
    coverUrl: "",
    tags: "",
    folderIds: currentFolderId ? [currentFolderId] : []
  });
  
  // Folder form state
  const [folderForm, setFolderForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    parentId: currentFolderId || null
  });

  // Function to fetch Spotify metadata using oEmbed
  const fetchSpotifyMetadata = async (spotifyUrl: string) => {
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
      const response = await fetch(oembedUrl);
      const data = await response.json();
      
      if (data.title && data.thumbnail_url) {
        setPlaylistForm(prev => ({
          ...prev,
          name: data.title,
          coverUrl: data.thumbnail_url
        }));
        toast({
          title: "Metadata extracted",
          description: "Title and cover image loaded from Spotify",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to fetch metadata",
        description: "Could not extract playlist information from Spotify URL",
        variant: "destructive",
      });
    }
  };
  
  // Create playlist mutation
  const createPlaylistMutation = useMutation({
    mutationFn: async (playlist: any) => {
      const res = await apiRequest("POST", "/api/playlists", playlist);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setPlaylistDialog(false);
      setPlaylistForm({
        name: "",
        description: "",
        spotifyUrl: "",
        coverUrl: "",
        tags: "",
        folderIds: currentFolderId ? [currentFolderId] : []
      });
      toast({
        title: "Playlist created",
        description: "Your playlist has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create playlist", 
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folder: any) => {
      const res = await apiRequest("POST", "/api/folders", folder);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setFolderDialog(false);
      setFolderForm({
        name: "",
        description: "",
        imageUrl: "",
        parentId: currentFolderId || null
      });
      toast({
        title: "Folder created",
        description: "Your folder has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create folder",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Sync playlists mutation
  const syncPlaylistsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/playlists/sync", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      const updated = data.results.filter((r: any) => r.status === 'updated').length;
      const deleted = data.results.filter((r: any) => r.status === 'deleted').length;
      const errors = data.results.filter((r: any) => r.status === 'error').length;
      
      toast({
        title: "Sync completed",
        description: `Updated: ${updated}, Deleted: ${deleted}, Errors: ${errors}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistForm.name) {
      toast({
        title: "Error",
        description: "Please enter a Spotify URL to extract the playlist name",
        variant: "destructive",
      });
      return;
    }
    createPlaylistMutation.mutate({
      ...playlistForm,
      tags: playlistForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      folderIds: playlistForm.folderIds
    });
  };

  const handleFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFolderMutation.mutate({
      ...folderForm,
      path: folderForm.parentId ? `${folderForm.parentId}/${folderForm.name}` : folderForm.name
    });
  };

  if (role !== "admin") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex flex-col gap-3">
        {/* Sync Playlists */}
        <Button 
          onClick={() => syncPlaylistsMutation.mutate()}
          disabled={syncPlaylistsMutation.isPending}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-full p-3 shadow-lg"
          title="Sync Playlists"
        >
          <RefreshCw className={`w-5 h-5 ${syncPlaylistsMutation.isPending ? 'animate-spin' : ''}`} />
        </Button>

        {/* Add Playlist */}
        <Dialog open={playlistDialog} onOpenChange={setPlaylistDialog}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full p-3 shadow-lg"
              title="Add Playlist"
            >
              <ListMusic className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-effect border-white/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Playlist</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new playlist by entering a Spotify URL or manual details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePlaylistSubmit} className="space-y-4">
              <div>
                <Label htmlFor="spotify-url" className="text-gray-300">Spotify URL</Label>
                <Input
                  id="spotify-url"
                  value={playlistForm.spotifyUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setPlaylistForm(prev => ({ ...prev, spotifyUrl: url }));
                    if (url.includes('open.spotify.com/playlist/')) {
                      fetchSpotifyMetadata(url);
                    }
                  }}
                  placeholder="https://open.spotify.com/playlist/..."
                  className="glass-effect border-white/20 text-white"
                  required
                />
                {playlistForm.name && (
                  <p className="text-sm text-green-400 mt-1">
                    ✓ Extracted: {playlistForm.name}
                  </p>
                )}
              </div>
              

              
              <div>
                <Label htmlFor="description" className="text-gray-300">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={playlistForm.description}
                  onChange={(e) => setPlaylistForm(prev => ({ ...prev, description: e.target.value }))}
                  className="glass-effect border-white/20 text-white"
                  placeholder="Optional description for the playlist"
                />
              </div>
              
              <div>
                <Label htmlFor="tags" className="text-gray-300">Tags (optional, comma separated)</Label>
                <Input
                  id="tags"
                  value={playlistForm.tags}
                  onChange={(e) => setPlaylistForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Electronic, Deep House, Chill"
                  className="glass-effect border-white/20 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="folders" className="text-gray-300">folders</Label>
                <Popover open={adminFolderPopoverOpen} onOpenChange={setAdminFolderPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={adminFolderPopoverOpen}
                      className="w-full justify-between glass-effect border-white/20 text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {playlistForm.folderIds.length > 0 
                        ? `${playlistForm.folderIds.length} folder(s) selected`
                        : "select folders..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-black/80 backdrop-blur-sm border-white/20" onClick={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder="search folders..." className="text-white" />
                      <CommandEmpty>no folders found.</CommandEmpty>
                      <CommandGroup>
                        {folders.map((folder) => (
                          <CommandItem
                            key={folder.id}
                            onSelect={() => {
                              if (playlistForm.folderIds.includes(folder.id)) {
                                setPlaylistForm(prev => ({ 
                                  ...prev, 
                                  folderIds: prev.folderIds.filter(id => id !== folder.id) 
                                }));
                              } else {
                                setPlaylistForm(prev => ({ 
                                  ...prev, 
                                  folderIds: [...prev.folderIds, folder.id] 
                                }));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-white"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                playlistForm.folderIds.includes(folder.id) ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {folder.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {playlistForm.folderIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {playlistForm.folderIds.map(folderId => {
                      const folder = folders.find(f => f.id === folderId);
                      return folder ? (
                        <Badge key={folderId} variant="secondary" className="text-xs">
                          {folder.name}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistForm(prev => ({ 
                                ...prev, 
                                folderIds: prev.folderIds.filter(id => id !== folderId) 
                              }));
                            }}
                            className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                {playlistForm.folderIds.length === 0 && (
                  <p className="text-sm text-gray-400 mt-1">no folders selected - playlist will appear in root</p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                disabled={createPlaylistMutation.isPending}
              >
                {createPlaylistMutation.isPending ? "Creating..." : "Create Playlist"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Add Folder */}
        <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full p-3 shadow-lg"
              title="Add Folder"
            >
              <FolderPlus className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-effect border-white/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Folder</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new folder to organize your playlists.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFolderSubmit} className="space-y-4">
              <div>
                <Label htmlFor="folder-name" className="text-gray-300">Name</Label>
                <Input
                  id="folder-name"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                  className="glass-effect border-white/20 text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="folder-description" className="text-gray-300">Description</Label>
                <Textarea
                  id="folder-description"
                  value={folderForm.description}
                  onChange={(e) => setFolderForm(prev => ({ ...prev, description: e.target.value }))}
                  className="glass-effect border-white/20 text-white"
                  placeholder="Brief description of this folder"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="image-upload" className="text-gray-300">Folder Image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFolderForm(prev => ({ ...prev, imageUrl: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="glass-effect border-white/20 text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="parent-folder" className="text-gray-300">Parent Folder</Label>
                <Select value={folderForm.parentId?.toString() || "root"} onValueChange={(value) => setFolderForm(prev => ({ ...prev, parentId: value === "root" ? null : parseInt(value) }))}>
                  <SelectTrigger className="glass-effect border-white/20 text-white">
                    <SelectValue placeholder="select parent folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">root</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id.toString()}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                disabled={createFolderMutation.isPending}
              >
                {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}