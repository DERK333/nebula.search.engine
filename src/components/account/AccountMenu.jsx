import React from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bookmark, KeyRound, LogOut, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

export default function AccountMenu() {
  const { user, isAuthenticated, logout, navigateToLogin } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={navigateToLogin}
        className="flex items-center gap-1.5 rounded-full px-4 font-body text-sm"
      >
        <LogIn className="w-4 h-4" />
        Sign in
      </Button>
    );
  }

  const initials = user.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
          <Avatar className="w-9 h-9 ring-2 ring-border hover:ring-primary/40 transition-all cursor-pointer">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-heading font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 p-2">
        {/* Profile summary */}
        <div className="px-2 py-3 flex items-center gap-3 border border-border rounded-lg mb-2 bg-muted/40">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-primary text-primary-foreground font-heading font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium font-heading truncate">{user.full_name || "My Account"}</p>
            <p className="text-xs text-muted-foreground font-body truncate">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <Link to="/bookmarks">
          <DropdownMenuItem className="cursor-pointer gap-2 font-body">
            <Bookmark className="w-4 h-4 text-muted-foreground" />
            Bookmarks
          </DropdownMenuItem>
        </Link>

        <Link to="/passwords">
          <DropdownMenuItem className="cursor-pointer gap-2 font-body">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            Saved passwords
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer gap-2 font-body text-destructive focus:text-destructive"
          onClick={() => logout(true)}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}