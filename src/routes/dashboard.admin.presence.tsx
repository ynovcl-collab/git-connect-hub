import { createFileRoute } from "@tanstack/react-router";
import { TeamPresenceView } from "@/components/dashboard/PresenceFake";

export const Route = createFileRoute("/dashboard/admin/presence")({
  component: () => <TeamPresenceView scope="admin" />,
});
