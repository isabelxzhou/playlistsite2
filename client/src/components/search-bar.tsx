import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <div className="gradient-border">
        <div className="gradient-border-inner">
          <input
            type="text"
            placeholder="Search playlists or tags..."
            className="w-full px-6 py-3 bg-transparent text-white placeholder-gray-300 focus:outline-none search-glow"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
    </div>
  );
}
