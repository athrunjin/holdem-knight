import { createFileRoute } from "@tanstack/react-router";
import { CallTimeScreen } from "@/components/call-time/CallTimeScreen";

export const Route = createFileRoute("/games/$gameId/call-time")({
  component: GameCallTimePage,
});

function GameCallTimePage() {
  const { gameId } = Route.useParams();
  return <CallTimeScreen gameId={gameId} />;
}
