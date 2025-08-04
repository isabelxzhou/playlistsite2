import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  currentFolderId?: number;
}

export default function BackButton({ currentFolderId }: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (currentFolderId) {
      // Navigate to parent folder or root
      setLocation("/");
    } else {
      // Already at root, no back action needed
      return;
    }
  };

  // Don't show back button if we're at the root level
  if (!currentFolderId) {
    return null;
  }

  return (
    <Button
      onClick={handleBack}
      variant="ghost"
      className="mb-4 text-white hover:bg-white/10 transition-colors"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
  );
}