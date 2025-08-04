import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Playlist } from "@shared/schema";

export function useSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      // Combine regular search with selected tags
      if (selectedTags.length > 0) {
        const tagQuery = selectedTags.map(tag => `tag:${tag}`).join(" ");
        setDebouncedQuery(searchQuery ? `${searchQuery} ${tagQuery}` : tagQuery);
      } else {
        setDebouncedQuery(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedTags]);

  const { data: searchResults = { playlists: [], folders: [] }, isLoading } = useQuery<{playlists: Playlist[], folders: any[]}>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      let url = "/api/search";
      
      // Handle multiple tags and regular search
      if (selectedTags.length > 0) {
        // Search by multiple tags
        const tagQuery = selectedTags.join(",");
        url = `/api/search?tag=${encodeURIComponent(tagQuery)}`;
        if (searchQuery.trim()) {
          url += `&q=${encodeURIComponent(searchQuery)}`;
        }
      } else if (debouncedQuery.startsWith("tag:")) {
        const tag = debouncedQuery.slice(4); // Remove "tag:" prefix
        url = `/api/search?tag=${encodeURIComponent(tag)}`;
      } else {
        url = `/api/search?q=${encodeURIComponent(debouncedQuery)}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to search");
      }
      return response.json();
    },
    enabled: debouncedQuery.length > 0,
    retry: false,
  });

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedTags,
    addTag,
    removeTag,
    clearTags,
    searchResults,
    isSearching: debouncedQuery.length > 0,
    isLoading,
  };
}
