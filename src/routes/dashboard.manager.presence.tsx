import { createFileRoute } from "@tanstack/react-router";
import { TeamPresenceView } from "@/components/dashboard/PresenceFake";

export const Route = createFileRoute("/dashboard/manager/presence")({
  component: () => <TeamPresenceView scope="manager" />,
});
