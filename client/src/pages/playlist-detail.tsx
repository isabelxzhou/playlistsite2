import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Edit } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Playlist } from "@shared/schema";
import ParticleBackground from "@/components/particle-background";

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: playlist, isLoading, error } = useQuery({
    queryKey: ["/api/playlists", id],
    queryFn: async () => {
      const response = await fetch(`/api/playlists/${id}`);
      if (!response.ok) throw new Error("Failed to fetch playlist");
      return response.json();
    },
    enabled: !!id
  });

  const [editForm, setEditForm] = useState({
    name: playlist?.name || "",
    description: playlist?.description || "",
    tags: playlist?.tags?.join(", ") || ""
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest("PUT", `/api/playlists/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", id] });
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

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlaylistMutation.mutate({
      name: editForm.name,
      description: editForm.description,
      tags: editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  const handleSpotifyClick = () => {
    const url = playlist?.spotifyUrl || (playlist as any)?.spotify_url;
    if (url) {
      window.open(url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <ParticleBackground />
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <ParticleBackground />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Playlist not found</h1>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ParticleBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header with back button */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to playlists
          </Button>
        </div>

        {/* Main content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Cover image */}
              <div className="flex-shrink-0">
                <img
                  src={playlist.coverUrl || (playlist as any).cover_url || 'https://via.placeholder.com/300x300?text=No+Cover'}
                  alt={`${playlist.name} playlist cover`}
                  className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-lg shadow-lg"
                />
              </div>

              {/* Playlist info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-4xl font-bold mb-2">{playlist.name}</h1>
                    <p className="text-lg text-muted-foreground">Playlist</p>
                  </div>
                  
                  <div className="flex gap-2">
                    {role === "admin" && (
                      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="secondary">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
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
                                rows={4}
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
                    )}
                  </div>
                </div>

                {/* Description */}
                {playlist.description && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {playlist.description}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {playlist.tags && playlist.tags.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {playlist.tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="text-sm px-3 py-1"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                  {playlist.totalTracks && (
                    <div>
                      <span className="font-medium">Tracks:</span> {playlist.totalTracks}
                    </div>
                  )}
                  {playlist.duration && (
                    <div>
                      <span className="font-medium">Duration:</span> {playlist.duration}
                    </div>
                  )}
                  {playlist.followers && (
                    <div>
                      <span className="font-medium">Followers:</span> {playlist.followers}
                    </div>
                  )}
                  {playlist.owner && (
                    <div>
                      <span className="font-medium">Owner:</span> {playlist.owner}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Spotify Button at Bottom */}
            <div className="mt-8 flex justify-center">
              <Button 
                onClick={handleSpotifyClick} 
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                size="lg"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Open in Spotify
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}