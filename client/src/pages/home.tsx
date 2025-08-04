import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import headphonesImg from "@assets/13635006_1752434794564.png";
import { apiRequest } from "@/lib/queryClient";
import ParticleBackground from "@/components/particle-background";
import SearchBar from "@/components/search-bar";
import FolderCard from "@/components/folder-card";
import PlaylistCard from "@/components/playlist-card";
import AdminPanel from "@/components/admin-panel";
import BackButton from "@/components/back-button";
import AIRecommendation from "@/components/ai-recommendation";
import { useSearch } from "@/hooks/use-search";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

import type { Folder, Playlist } from "@shared/schema";

export default function Home() {
  const [match, params] = useRoute("/folder/:id");
  const currentFolderId = params?.id ? parseInt(params.id) : undefined;
  const { searchQuery, setSearchQuery, selectedTags, addTag, removeTag, clearTags, searchResults, isSearching } =
    useSearch();
  const { user, role, logoutMutation } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Auto-sync playlists for admins - much less frequently
  const autoSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/playlists/sync", {});
      return response.json();
    },
    onSuccess: () => {
      // Force refresh playlist data after sync
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      queryClient.refetchQueries({ queryKey: ["/api/playlists"] });
      // Clear randomized playlists to force re-shuffle with updated data
      setRandomizedPlaylists([]);
    },
  });

  useEffect(() => {
    if (role === "admin") {
      // Disable automatic sync to prevent data loss
      // User can manually sync with the refresh button
    }
  }, [role]);

  const { data: folders, isLoading: foldersLoading } = useQuery<Folder[]>({
    queryKey: ["/api/folders", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId
        ? `/api/folders?parentId=${currentFolderId}`
        : "/api/folders";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery<Playlist[]>(
    {
      queryKey: ["/api/playlists", currentFolderId],
      queryFn: async () => {
        const url = currentFolderId
          ? `/api/playlists?folderId=${currentFolderId}`
          : "/api/playlists";
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch playlists");
        return response.json();
      },
      enabled: !isSearching,
    },
  );

  // Get all unique tags from playlists and folders
  const playlistTags = playlists?.flatMap((p) => p.tags || []) || [];
  const folderTags = folders?.flatMap((f) => f.tags || []) || [];
  const allTags = Array.from(
    new Set([...playlistTags, ...folderTags])
  ).sort();

  // Store randomized playlists in state to prevent constant re-shuffling
  const [randomizedPlaylists, setRandomizedPlaylists] = useState<Playlist[]>([]);
  
  useEffect(() => {
    if (playlists && playlists.length > 0) {
      // Only shuffle if we don't have shuffled playlists yet or if the count changed significantly
      if (randomizedPlaylists.length === 0 || Math.abs(playlists.length - randomizedPlaylists.length) > 2) {
        const shuffled = [...playlists];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setRandomizedPlaylists(shuffled);
      } else {
        // Update existing randomized playlists with fresh data to get updated images/names
        const updatedPlaylists = randomizedPlaylists.map(randomPlaylist => {
          const freshPlaylist = playlists.find(p => p.id === randomPlaylist.id);
          return freshPlaylist || randomPlaylist;
        }).filter(Boolean); // Remove any null/undefined entries
        
        // Only update if we have actual changes
        if (JSON.stringify(updatedPlaylists) !== JSON.stringify(randomizedPlaylists)) {
          setRandomizedPlaylists(updatedPlaylists);
        }
      }
    }
  }, [playlists]); // Depend on full playlists array to catch updates

  const displayedPlaylists = isSearching ? searchResults.playlists : randomizedPlaylists;
  const displayedFolders = isSearching ? searchResults.folders : folders || [];

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      removeTag(tag);
    } else {
      addTag(tag);
    }
  };

  return (
    <div className="min-h-screen text-white overflow-x-hidden">
      <ParticleBackground />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-6 glass-effect border-b border-white/20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div 
              className="flex items-center space-x-4 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                setLocation("/");
                setSearchQuery("");
                clearTags();
              }}
            >
              <img src={headphonesImg} alt="headphones" className="w-8 h-8" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                iso playlists
              </h1>
            </div>

            <div className="flex-1 max-w-2xl mx-8">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:bg-red-500/20 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={clearTags}
                    className="px-2 py-1 text-gray-400 hover:text-white text-sm"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                className="text-gray-300 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {/* Back Button */}
            <BackButton currentFolderId={currentFolderId} />

            {/* AI Recommendation */}
            {!isSearching && (
              <AIRecommendation 
                onPlaylistClick={(playlist) => {
                  setLocation(`/playlist/${playlist.id}`);
                }} 
              />
            )}

            {/* Folders Section - Only on homepage */}
            {!isSearching && !currentFolderId && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  folders
                </h2>

                {foldersLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="glass-effect rounded-xl p-6 animate-pulse"
                      >
                        <div className="w-16 h-16 bg-gray-600 rounded-lg mx-auto mb-4"></div>
                        <div className="h-4 bg-gray-600 rounded mx-auto w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : folders && folders.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {folders.map((folder) => (
                      <FolderCard key={folder.id} folder={folder} onTagClick={handleTagClick} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No folders found</p>
                  </div>
                )}
              </section>
            )}

            {/* Tags Section - Always show tags */}
            {allTags.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`px-3 py-1 backdrop-blur-sm rounded-full text-sm transition-colors border ${
                        selectedTags.includes(tag)
                          ? 'bg-blue-500/30 text-blue-200 border-blue-400/50'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Search Results or Regular Content */}
            {isSearching ? (
              <>


                {/* Search Results - Playlists */}
                <section>
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    playlists
                  </h2>
                  {displayedPlaylists.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                      {displayedPlaylists.map((playlist) => (
                        <PlaylistCard
                          key={playlist.id}
                          playlist={playlist}
                          onTagClick={handleTagClick}
                          isHomepage={true}
                          folders={folders}
                        />
                      ))}
                    </div>
                  ) : displayedFolders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">no results found matching your search</p>
                    </div>
                  ) : null}
                </section>
              </>
            ) : (
              /* Regular Playlists Section */
              <section>
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  playlists
                </h2>

                {playlistsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-card rounded-lg overflow-hidden animate-pulse"
                      >
                        <div className="w-full aspect-square bg-gray-600"></div>
                        <div className="p-3">
                          <div className="h-3 bg-gray-600 rounded mb-2"></div>
                          <div className="h-2 bg-gray-600 rounded mb-2 w-3/4"></div>
                          <div className="flex gap-1">
                            <div className="h-4 bg-gray-600 rounded-full w-12"></div>
                            <div className="h-4 bg-gray-600 rounded-full w-16"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedPlaylists.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {displayedPlaylists.map((playlist) => (
                      <PlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        onTagClick={handleTagClick}
                        isHomepage={true}
                        folders={folders}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">no playlists found</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>

        {/* Admin Panel */}
        {role === "admin" && (
          <AdminPanel
            folders={folders || []}
            currentFolderId={currentFolderId}
          />
        )}
      </div>
    </div>
  );
}
