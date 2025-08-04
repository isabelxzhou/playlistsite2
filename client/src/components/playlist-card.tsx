import { ExternalLink, Edit, Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Playlist } from "@shared/schema";

interface PlaylistCardProps {
  playlist: Playlist;
  onTagClick?: (tag: string) => void;
  isHomepage?: boolean; // Whether this card is displayed on homepage
  folders?: any[]; // Available folders for editing
}

export default function PlaylistCard({ playlist, onTagClick, isHomepage = false }: PlaylistCardProps) {
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: playlist.name,
    description: playlist.description || "",
    tags: playlist.tags?.join(", ") || "",
    folderIds: [] as number[]
  });
  
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);
  
  // Fetch folders for the dropdown
  const { data: folders = [] } = useQuery({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
    enabled: isEditOpen
  });

  // Fetch current playlist-folder relationships
  const { data: playlistFolders = [] } = useQuery({
    queryKey: ["/api/playlist-folders", playlist.id],
    queryFn: async () => {
      const response = await fetch(`/api/playlist-folders/${playlist.id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isEditOpen
  });

  useEffect(() => {
    if (playlistFolders.length > 0) {
      setEditForm(prev => ({
        ...prev,
        folderIds: playlistFolders.map((pf: any) => pf.folderId)
      }));
    }
  }, [playlistFolders]);

  const updatePlaylistMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest("PUT", `/api/playlists/${playlist.id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setIsEditOpen(false);
      toast({
        title: "Playlist updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/playlists/${playlist.id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Playlist deleted",
        description: "The playlist has been removed from your collection.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlaylistMutation.mutate({
      name: editForm.name,
      description: editForm.description,
      tags: editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      folderIds: editForm.folderIds
    });
  };

  const toggleFolder = (folderId: number) => {
    setEditForm(prev => ({
      ...prev,
      folderIds: prev.folderIds.includes(folderId)
        ? prev.folderIds.filter(id => id !== folderId)
        : [...prev.folderIds, folderId]
    }));
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Navigate to playlist detail page
    if (!isEditOpen) {
      setLocation(`/playlist/${playlist.id}`);
    }
  };

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  return (
    <div className="bg-card rounded-lg p-3 hover:bg-card/80 transition-colors group cursor-pointer">
      <div className="relative" onClick={handleCardClick}>
        <img
          src={playlist.coverUrl || (playlist as any).cover_url || 'https://via.placeholder.com/200x200?text=No+Cover'}
          alt={`${playlist.name} playlist cover`}
          className="w-full aspect-square object-cover rounded-md mb-3 group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-2">
            {role === "admin" && (
              <>
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Edit Playlist</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleEdit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={editForm.tags}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="rock, indie, chill"
                      />
                    </div>
                    
                    <div>
                      <Label>Folders</Label>
                      <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={folderPopoverOpen}
                            className="w-full justify-between"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {editForm.folderIds.length > 0 
                              ? `${editForm.folderIds.length} folder(s) selected`
                              : "Select folders..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" onClick={(e) => e.stopPropagation()}>
                          <Command>
                            <CommandInput placeholder="Search folders..." />
                            <CommandEmpty>No folders found.</CommandEmpty>
                            <CommandGroup>
                              {folders.map((folder) => (
                                <CommandItem
                                  key={folder.id}
                                  onSelect={() => toggleFolder(folder.id)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      editForm.folderIds.includes(folder.id) ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {folder.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                      {editForm.folderIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {editForm.folderIds.map(folderId => {
                            const folder = folders.find(f => f.id === folderId);
                            return folder ? (
                              <Badge key={folderId} variant="secondary" className="text-xs">
                                {folder.name}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFolder(folderId);
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
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={updatePlaylistMutation.isPending}>
                        {updatePlaylistMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this playlist?')) {
                      deletePlaylistMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <ExternalLink className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
      
      <div className="playlist-content">
        <h3 className="font-bold text-xs mb-1 line-clamp-1">{playlist.name}</h3>
        {playlist.description && (
          <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">{playlist.description}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {playlist.tags?.slice(0, 2).map((tag) => (
            <button
              key={tag}
              onClick={(e) => handleTagClick(tag, e)}
              className="px-1.5 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
