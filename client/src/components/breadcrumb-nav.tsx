import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import type { Folder } from "@shared/schema";

interface BreadcrumbNavProps {
  currentFolderId?: number;
}

export default function BreadcrumbNav({ currentFolderId }: BreadcrumbNavProps) {
  const [, setLocation] = useLocation();

  const { data: path } = useQuery<Folder[]>({
    queryKey: ["/api/folders", currentFolderId, "path"],
    queryFn: async () => {
      if (!currentFolderId) return [];
      const response = await fetch(`/api/folders/${currentFolderId}/path`);
      return response.json();
    },
    enabled: !!currentFolderId,
  });

  const handleNavigate = (folderId?: number) => {
    if (folderId) {
      setLocation(`/folder/${folderId}`);
    } else {
      setLocation("/");
    }
  };

  return (
    <nav className="p-6 glass-effect border-b border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => handleNavigate()}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Home
          </button>
          
          {path && path.map((folder, index) => (
            <div key={folder.id} className="flex items-center space-x-2">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                onClick={() => handleNavigate(folder.id)}
                className={`transition-colors ${
                  index === path.length - 1
                    ? "text-gray-300"
                    : "text-purple-400 hover:text-purple-300"
                }`}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
