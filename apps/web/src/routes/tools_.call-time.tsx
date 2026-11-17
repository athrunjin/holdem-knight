import { createFileRoute } from "@tanstack/react-router";
import { CallTimeScreen } from "@/components/call-time/CallTimeScreen";

export const Route = createFileRoute("/tools_/call-time")({
  component: () => <CallTimeScreen />,
});
