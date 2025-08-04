import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Playlist } from "@shared/schema";

interface AIRecommendationProps {
  onPlaylistClick?: (playlist: Playlist) => void;
}

export default function AIRecommendation({ onPlaylistClick }: AIRecommendationProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const recommendMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/playlists/recommend", { query });
      return response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Recommendation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      recommendMutation.mutate(query.trim());
    }
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    if (onPlaylistClick) {
      onPlaylistClick(playlist);
    }
    setIsOpen(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      {/* Main Search Button */}
      <div className="relative">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-16 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur-md border border-white/20 rounded-2xl"
          variant="ghost"
        >
          <div className="flex items-center justify-center gap-3 text-white">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span className="text-lg font-medium">Ask for playlist recommendations...</span>
          </div>
        </Button>
      </div>

      {/* Expanded Search Interface */}
      {isOpen && (
        <Card className="mt-4 p-6 bg-black/20 backdrop-blur-md border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What kind of playlists would you recommend for studying?"
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!query.trim() || recommendMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                {recommendMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>

          {/* Recommendations */}
          {recommendMutation.data && (
            <div className="mt-6 space-y-3">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Recommendations
              </h3>
              
              {recommendMutation.data.explanation && (
                <p className="text-white/80 text-sm bg-white/5 p-3 rounded-lg">
                  {recommendMutation.data.explanation}
                </p>
              )}

              <div className="grid gap-3">
                {recommendMutation.data.recommendations?.map((playlist: Playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => handlePlaylistClick(playlist)}
                    className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors group"
                  >
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm truncate group-hover:text-blue-300 transition-colors">
                        {playlist.name}
                      </h4>
                      {playlist.description && (
                        <p className="text-white/60 text-xs line-clamp-1">
                          {playlist.description}
                        </p>
                      )}
                      {playlist.tags && playlist.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {playlist.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}