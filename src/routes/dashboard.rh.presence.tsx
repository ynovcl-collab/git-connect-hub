import { createFileRoute } from "@tanstack/react-router";
import { TeamPresenceView } from "@/components/dashboard/PresenceFake";

export const Route = createFileRoute("/dashboard/rh/presence")({
  component: () => <TeamPresenceView scope="rh" />,
});
