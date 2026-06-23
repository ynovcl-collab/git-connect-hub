import { createFileRoute } from "@tanstack/react-router";
import { CollabPresenceView } from "@/components/dashboard/PresenceFake";

export const Route = createFileRoute("/dashboard/collab/presence")({ component: CollabPresenceView });
