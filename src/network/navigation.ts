import { createContext } from "react";

/** Connect every existing header bell without changing header markup or positioning. */
export const NotificationNavigation = createContext<{
  open: () => void;
  unread: number;
} | null>(null);
