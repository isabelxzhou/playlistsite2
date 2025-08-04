import { useLocation } from "wouter";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit3, Trash2, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { Folder } from "@shared/schema";

interface FolderCardProps {
  folder: Folder;
  onTagClick?: (tag: string) => void;
}

export default function FolderCard({ folder, onTagClick }: FolderCardProps) {
  const [, setLocation] = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: folder.name,
    description: folder.description || "",
    imageUrl: folder.imageUrl || "",
    tags: (folder.tags || []).join(", ")
  });
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest("PATCH", `/api/folders/${folder.id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setIsEditOpen(false);
      toast({
        title: "Folder updated",
        description: "Your folder has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update folder",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/folders/${folder.id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder deleted",
        description: "Your folder has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete folder",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleClick = () => {
    if (!isEditOpen) {
      setLocation(`/folder/${folder.id}`);
    }
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name: editForm.name,
      description: editForm.description,
      imageUrl: editForm.imageUrl,
      tags: editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this folder?")) {
      deleteMutation.mutate();
    }
  };

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  return (
    <div
      className="bg-card rounded-lg p-4 hover:bg-card/80 transition-colors group cursor-pointer relative"
      onClick={handleClick}
    >
      {/* Admin Controls - positioned in front of the image */}
      {role === "admin" && (
        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit folder
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit folder</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleEdit} className="space-y-4">
                    <div>
                      <Label htmlFor="folder-name">Name</Label>
                      <Input
                        id="folder-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="folder-description">Description</Label>
                      <Textarea
                        id="folder-description"
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="folder-image">Image URL</Label>
                      <Input
                        id="folder-image"
                        value={editForm.imageUrl}
                        onChange={(e) => setEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="folder-tags">Tags (comma-separated)</Label>
                      <Input
                        id="folder-tags"
                        value={editForm.tags}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="electronic, house, chill"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <DropdownMenuItem onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="relative mb-4">
        <img
          src={folder.imageUrl}
          alt={`${folder.name} folder`}
          className="w-full aspect-square object-cover rounded-md group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent rounded-md" />
      </div>
      
      <div>
        <h3 className="font-bold text-sm mb-1 line-clamp-1">{folder.name}</h3>
        {folder.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{folder.description}</p>
        )}
        {folder.tags && folder.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {folder.tags.slice(0, 2).map((tag, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-xs px-1 py-0 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={(e) => handleTagClick(tag, e)}
              >
                {tag}
              </Badge>
            ))}
            {folder.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                +{folder.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
